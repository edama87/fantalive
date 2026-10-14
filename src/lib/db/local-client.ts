/**
 * Local Database Client
 * 
 * In-memory implementation of the database layer for development
 * and testing without Supabase. Persists to localStorage when available.
 */

import {
  DbTeam,
  DbPlayer,
  DbRosterVersion,
  DbRosterPlayer,
  DbMarketTransaction,
  DbRound,
  DbMarketWindow,
  RosterWithPlayers,
  BulkMarketImport,
} from './types';
import { teams as seedTeams } from '@/data/teams';
import { calendar as seedCalendar } from '@/data/calendar';

const STORAGE_KEY = 'fantalive-local-db';

interface LocalDb {
  teams: DbTeam[];
  players: DbPlayer[];
  rosterVersions: DbRosterVersion[];
  rosterPlayers: DbRosterPlayer[];
  marketTransactions: DbMarketTransaction[];
  rounds: DbRound[];
  marketWindows: DbMarketWindow[];
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createInitialDb(): LocalDb {
  const now = new Date().toISOString();
  const seasonStart = '2026-10-01T00:00:00Z';

  const teams: DbTeam[] = seedTeams.map(t => ({
    id: t.id,
    name: t.name,
    manager_name: t.managerName,
    manager_email: null,
    created_at: now,
    updated_at: now,
  }));

  const players: DbPlayer[] = seedTeams.flatMap(t =>
    t.players.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      real_team: p.realTeam || null,
      is_active: true,
      created_at: now,
      updated_at: now,
    }))
  );

  const rosterVersions: DbRosterVersion[] = seedTeams.map(t => ({
    id: generateUUID(),
    team_id: t.id,
    version_number: 1,
    effective_from: seasonStart,
    effective_until: null,
    credits_remaining: 0,
    market_credits: 60,
    notes: 'Initial roster from auction',
    created_at: now,
  }));

  const rosterPlayers: DbRosterPlayer[] = [];
  for (const team of seedTeams) {
    const version = rosterVersions.find(v => v.team_id === team.id)!;
    for (const player of team.players) {
      rosterPlayers.push({
        id: generateUUID(),
        roster_version_id: version.id,
        player_id: player.id,
        acquisition_type: 'auction',
        acquisition_price: 0,
        acquired_at: seasonStart,
      });
    }
  }

  const rounds: DbRound[] = seedCalendar.map(r => ({
    number: r.number,
    serie_a_matchday: r.serieAMatchday,
    kickoff_date: r.date.split('/').reverse().join('-'),
    kickoff_time: '18:00:00',
    pairing_cycle: String.fromCharCode(65 + ((r.number - 1) % 9)),
    is_home_swapped: r.number >= 10 && r.number <= 18,
    lineup_deadline: null,
    status: 'scheduled',
    created_at: now,
  }));

  const marketWindows: DbMarketWindow[] = [];

  return {
    teams,
    players,
    rosterVersions,
    rosterPlayers,
    marketTransactions: [],
    rounds,
    marketWindows,
  };
}

function loadDb(): LocalDb {
  if (typeof window === 'undefined') {
    return createInitialDb();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[LocalDB] Failed to load from localStorage:', e);
  }

  return createInitialDb();
}

function saveDb(db: LocalDb): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('[LocalDB] Failed to save to localStorage:', e);
  }
}

export interface LocalDbClient {
  teams: {
    getAll(): Promise<DbTeam[]>;
    getById(id: string): Promise<DbTeam | null>;
  };
  
  players: {
    getAll(): Promise<DbPlayer[]>;
    getById(id: string): Promise<DbPlayer | null>;
    getByTeamRoster(teamId: string, roundNumber?: number): Promise<DbPlayer[]>;
  };
  
  rosters: {
    getVersionForRound(teamId: string, roundNumber: number): Promise<RosterWithPlayers | null>;
    getCurrentVersion(teamId: string): Promise<RosterWithPlayers | null>;
    createVersion(
      teamId: string,
      effectiveFrom: Date,
      changes: { add: string[]; remove: string[]; creditsPaid: number }
    ): Promise<DbRosterVersion>;
  };
  
  market: {
    getTransactions(teamId?: string): Promise<DbMarketTransaction[]>;
    getCredits(teamId: string): Promise<{ remaining: number; market: number }>;
    processBulkImport(imports: BulkMarketImport[], effectiveRound: number): Promise<void>;
    buyPlayer(teamId: string, playerId: string, credits: number, marketWeek: number): Promise<void>;
    sellPlayer(teamId: string, playerId: string, marketWeek: number): Promise<void>;
  };
  
  rounds: {
    getAll(): Promise<DbRound[]>;
    getByNumber(num: number): Promise<DbRound | null>;
    getCurrent(): Promise<DbRound | null>;
  };
  
  reset(): Promise<void>;
}

export function createLocalClient(): LocalDbClient {
  let db = loadDb();

  const persist = () => saveDb(db);

  return {
    teams: {
      async getAll() {
        return db.teams;
      },
      async getById(id) {
        return db.teams.find(t => t.id === id) || null;
      },
    },

    players: {
      async getAll() {
        return db.players.filter(p => p.is_active);
      },
      async getById(id) {
        return db.players.find(p => p.id === id) || null;
      },
      async getByTeamRoster(teamId, roundNumber) {
        return db.players.filter(p => {
          const roster = db.rosterVersions.find(v => v.team_id === teamId && !v.effective_until);
          if (!roster) return false;
          return db.rosterPlayers.some(rp => rp.roster_version_id === roster.id && rp.player_id === p.id);
        });
      },
    },

    rosters: {
      async getVersionForRound(teamId, roundNumber) {
        const round = db.rounds.find(r => r.number === roundNumber);
        if (!round) return null;

        const kickoff = new Date(`${round.kickoff_date}T${round.kickoff_time || '00:00:00'}Z`);
        
        const version = db.rosterVersions
          .filter(v => v.team_id === teamId)
          .filter(v => new Date(v.effective_from) <= kickoff)
          .filter(v => !v.effective_until || new Date(v.effective_until) > kickoff)
          .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0];

        if (!version) return null;

        const players = db.rosterPlayers
          .filter(rp => rp.roster_version_id === version.id)
          .map(rp => ({
            ...rp,
            player: db.players.find(p => p.id === rp.player_id)!,
          }));

        return { ...version, players };
      },

      async getCurrentVersion(teamId) {
        const version = db.rosterVersions
          .filter(v => v.team_id === teamId && !v.effective_until)
          .sort((a, b) => b.version_number - a.version_number)[0];

        if (!version) return null;

        const players = db.rosterPlayers
          .filter(rp => rp.roster_version_id === version.id)
          .map(rp => ({
            ...rp,
            player: db.players.find(p => p.id === rp.player_id)!,
          }));

        return { ...version, players };
      },

      async createVersion(teamId, effectiveFrom, changes) {
        const current = await this.getCurrentVersion(teamId);
        if (!current) throw new Error(`No current roster for team ${teamId}`);

        current.effective_until = effectiveFrom.toISOString();

        const newVersion: DbRosterVersion = {
          id: generateUUID(),
          team_id: teamId,
          version_number: current.version_number + 1,
          effective_from: effectiveFrom.toISOString(),
          effective_until: null,
          credits_remaining: current.credits_remaining,
          market_credits: current.market_credits - changes.creditsPaid,
          notes: `Market changes: +${changes.add.length}, -${changes.remove.length}`,
          created_at: new Date().toISOString(),
        };

        db.rosterVersions.push(newVersion);

        const existingPlayers = current.players
          .filter(p => !changes.remove.includes(p.player_id))
          .map(p => p.player_id);

        const allPlayerIds = [...existingPlayers, ...changes.add];

        for (const playerId of allPlayerIds) {
          const isNew = changes.add.includes(playerId);
          db.rosterPlayers.push({
            id: generateUUID(),
            roster_version_id: newVersion.id,
            player_id: playerId,
            acquisition_type: isNew ? 'market' : 'auction',
            acquisition_price: isNew ? changes.creditsPaid : 0,
            acquired_at: effectiveFrom.toISOString(),
          });
        }

        persist();
        return newVersion;
      },
    },

    market: {
      async getTransactions(teamId) {
        let txs = db.marketTransactions;
        if (teamId) {
          txs = txs.filter(t => t.team_id === teamId);
        }
        return txs.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      },

      async getCredits(teamId) {
        const version = db.rosterVersions
          .filter(v => v.team_id === teamId && !v.effective_until)
          .sort((a, b) => b.version_number - a.version_number)[0];

        return {
          remaining: version?.credits_remaining ?? 0,
          market: version?.market_credits ?? 60,
        };
      },

      async processBulkImport(imports, effectiveRound) {
        const now = new Date();
        const round = db.rounds.find(r => r.number === effectiveRound);
        const effectiveFrom = round 
          ? new Date(`${round.kickoff_date}T00:00:00Z`)
          : now;

        const groupedByTeam = new Map<string, BulkMarketImport[]>();
        for (const imp of imports) {
          const existing = groupedByTeam.get(imp.team_id) || [];
          existing.push(imp);
          groupedByTeam.set(imp.team_id, existing);
        }

        for (const [teamId, teamImports] of groupedByTeam) {
          const removes = teamImports.map(i => i.player_out_id);
          const totalCredits = teamImports.reduce((sum, i) => sum + i.credits_paid, 0);

          const current = db.rosterVersions
            .filter(v => v.team_id === teamId && !v.effective_until)
            .sort((a, b) => b.version_number - a.version_number)[0];
          if (!current) continue;

          current.effective_until = effectiveFrom.toISOString();

          const newVersion: DbRosterVersion = {
            id: generateUUID(),
            team_id: teamId,
            version_number: current.version_number + 1,
            effective_from: effectiveFrom.toISOString(),
            effective_until: null,
            credits_remaining: current.credits_remaining,
            market_credits: current.market_credits - totalCredits,
            notes: `Bulk import round ${effectiveRound}`,
            created_at: now.toISOString(),
          };

          db.rosterVersions.push(newVersion);

          const currentPlayers = db.rosterPlayers.filter(rp => rp.roster_version_id === current.id);
          const keepPlayers = currentPlayers.filter(p => !removes.includes(p.player_id));

          for (const p of keepPlayers) {
            db.rosterPlayers.push({
              id: generateUUID(),
              roster_version_id: newVersion.id,
              player_id: p.player_id,
              acquisition_type: p.acquisition_type,
              acquisition_price: p.acquisition_price,
              acquired_at: p.acquired_at,
            });
          }

          for (const imp of teamImports) {
            db.rosterPlayers.push({
              id: generateUUID(),
              roster_version_id: newVersion.id,
              player_id: imp.player_in_id,
              acquisition_type: 'market',
              acquisition_price: imp.credits_paid,
              acquired_at: now.toISOString(),
            });

            db.marketTransactions.push({
              id: generateUUID(),
              team_id: teamId,
              transaction_type: 'sell',
              player_id: imp.player_out_id,
              credits_paid: 0,
              credits_refunded: 0,
              market_week: null,
              effective_round: effectiveRound,
              release_reason: 'still_in_serie_a',
              is_loan: false,
              is_injured: false,
              loan_return_round: null,
              raw_import_data: null,
              notes: null,
              created_at: now.toISOString(),
            });

            db.marketTransactions.push({
              id: generateUUID(),
              team_id: teamId,
              transaction_type: 'buy',
              player_id: imp.player_in_id,
              credits_paid: imp.credits_paid,
              credits_refunded: 0,
              market_week: null,
              effective_round: effectiveRound,
              release_reason: null,
              is_loan: false,
              is_injured: false,
              loan_return_round: null,
              raw_import_data: null,
              notes: null,
              created_at: now.toISOString(),
            });
          }
        }

        persist();
      },

      async buyPlayer(teamId, playerId, credits, marketWeek) {
        const tx: DbMarketTransaction = {
          id: generateUUID(),
          team_id: teamId,
          transaction_type: 'buy',
          player_id: playerId,
          credits_paid: credits,
          credits_refunded: 0,
          market_week: marketWeek,
          effective_round: null,
          release_reason: null,
          is_loan: false,
          is_injured: false,
          loan_return_round: null,
          raw_import_data: null,
          notes: null,
          created_at: new Date().toISOString(),
        };
        db.marketTransactions.push(tx);
        persist();
      },

      async sellPlayer(teamId, playerId, marketWeek) {
        const tx: DbMarketTransaction = {
          id: generateUUID(),
          team_id: teamId,
          transaction_type: 'sell',
          player_id: playerId,
          credits_paid: 0,
          credits_refunded: 0,
          market_week: marketWeek,
          effective_round: null,
          release_reason: 'still_in_serie_a',
          is_loan: false,
          is_injured: false,
          loan_return_round: null,
          raw_import_data: null,
          notes: null,
          created_at: new Date().toISOString(),
        };
        db.marketTransactions.push(tx);
        persist();
      },
    },

    rounds: {
      async getAll() {
        return db.rounds.sort((a, b) => a.number - b.number);
      },
      async getByNumber(num) {
        return db.rounds.find(r => r.number === num) || null;
      },
      async getCurrent() {
        const now = new Date();
        const upcoming = db.rounds
          .filter(r => new Date(r.kickoff_date) >= now || r.status === 'live')
          .sort((a, b) => new Date(a.kickoff_date).getTime() - new Date(b.kickoff_date).getTime());
        return upcoming[0] || db.rounds[0] || null;
      },
    },

    async reset() {
      db = createInitialDb();
      persist();
    },
  };
}

