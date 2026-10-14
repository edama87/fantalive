/**
 * Supabase Database Client
 * 
 * Production implementation using Supabase for reads and writes.
 * Uses public client for reads (RLS enforced), server client for writes.
 */

import { getPublicClient, getServerClient, isSupabaseServerConfigured } from './supabase';
import {
  DbTeam,
  DbPlayer,
  DbRosterVersion,
  DbMarketTransaction,
  DbRound,
  RosterWithPlayers,
  BulkMarketImport,
} from './types';

export interface SupabaseDbClient {
  teams: {
    getAll(): Promise<DbTeam[]>;
    getById(id: string): Promise<DbTeam | null>;
  };
  
  players: {
    getAll(): Promise<DbPlayer[]>;
    getById(id: string): Promise<DbPlayer | null>;
    getByTeamRoster(teamId: string, roundNumber?: number): Promise<DbPlayer[]>;
    search(query: string): Promise<DbPlayer[]>;
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
    getMatchPairings(roundNumber: number): Promise<Array<{ home_team_id: string; away_team_id: string }>>;
  };

  liveData: {
    getLiveVotes(roundNumber: number): Promise<Array<{
      player_id: string;
      estimated_vote: number | null;
      is_estimated: boolean;
      minutes_played: number;
      is_playing: boolean;
      is_subbed_out: boolean;
      updated_at: string;
    }>>;
    getLiveEvents(roundNumber: number): Promise<Array<{
      player_id: string;
      event_type: string;
      minute: number;
    }>>;
    getSerieAMatches(roundNumber: number): Promise<Array<{
      id: string;
      home_team: string;
      away_team: string;
      home_score: number;
      away_score: number;
      minute: number;
      status: string;
    }>>;
  };
  
  reset(): Promise<void>;
}

async function loadRosterPlayers(
  supabase: ReturnType<typeof getPublicClient>,
  version: DbRosterVersion
): Promise<RosterWithPlayers> {
  const { data: rosterPlayers, error } = await supabase
    .from('roster_players')
    .select(`
      *,
      player:players(*)
    `)
    .eq('roster_version_id', version.id);

  if (error) throw error;

  interface RosterPlayerRow {
    id: string;
    roster_version_id: string;
    player_id: string;
    acquisition_type: 'auction' | 'market' | 'initial';
    acquisition_price: number;
    acquired_at: string;
    player: DbPlayer;
  }

  return {
    ...version,
    players: ((rosterPlayers || []) as RosterPlayerRow[]).map((rp) => ({
      id: rp.id,
      roster_version_id: rp.roster_version_id,
      player_id: rp.player_id,
      acquisition_type: rp.acquisition_type,
      acquisition_price: rp.acquisition_price,
      acquired_at: rp.acquired_at,
      player: rp.player,
    })),
  };
}

async function getVersionForRound(
  supabase: ReturnType<typeof getPublicClient>,
  teamId: string,
  roundNumber: number
): Promise<RosterWithPlayers | null> {
  const round = await supabase
    .from('rounds')
    .select('kickoff_date, kickoff_time')
    .eq('number', roundNumber)
    .single();
  
  if (!round.data) return null;

  const kickoff = new Date(`${round.data.kickoff_date}T${round.data.kickoff_time || '00:00:00'}`);

  const { data: versions, error } = await supabase
    .from('roster_versions')
    .select('*')
    .eq('team_id', teamId)
    .lte('effective_from', kickoff.toISOString())
    .or(`effective_until.is.null,effective_until.gt.${kickoff.toISOString()}`)
    .order('effective_from', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!versions || versions.length === 0) return null;

  return loadRosterPlayers(supabase, versions[0]);
}

async function getCurrentVersion(
  supabase: ReturnType<typeof getPublicClient>,
  teamId: string
): Promise<RosterWithPlayers | null> {
  const { data: versions, error } = await supabase
    .from('roster_versions')
    .select('*')
    .eq('team_id', teamId)
    .is('effective_until', null)
    .order('version_number', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!versions || versions.length === 0) return null;

  return loadRosterPlayers(supabase, versions[0]);
}

export function createSupabaseDbClient(): SupabaseDbClient {
  const supabase = getPublicClient();

  return {
    teams: {
      async getAll() {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .order('name');
        
        if (error) throw error;
        return data || [];
      },

      async getById(id) {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
      },
    },

    players: {
      async getAll() {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        return data || [];
      },

      async getById(id) {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
      },

      async getByTeamRoster(teamId, roundNumber) {
        const roster = roundNumber
          ? await getVersionForRound(supabase, teamId, roundNumber)
          : await getCurrentVersion(supabase, teamId);
        
        if (!roster) return [];
        return roster.players.map(rp => rp.player);
      },

      async search(query) {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('is_active', true)
          .ilike('name', `%${query}%`)
          .limit(50);
        
        if (error) throw error;
        return data || [];
      },
    },

    rosters: {
      async getVersionForRound(teamId, roundNumber) {
        return getVersionForRound(supabase, teamId, roundNumber);
      },

      async getCurrentVersion(teamId) {
        return getCurrentVersion(supabase, teamId);
      },

      async createVersion(teamId, effectiveFrom, changes) {
        if (!isSupabaseServerConfigured()) {
          throw new Error('Server configuration required for write operations');
        }
        
        const serverSupabase = getServerClient();
        const current = await getCurrentVersion(supabase, teamId);
        if (!current) throw new Error(`No current roster for team ${teamId}`);

        const { error: closeError } = await serverSupabase
          .from('roster_versions')
          .update({ effective_until: effectiveFrom.toISOString() })
          .eq('id', current.id);

        if (closeError) throw closeError;

        const { data: newVersion, error: versionError } = await serverSupabase
          .from('roster_versions')
          .insert({
            team_id: teamId,
            version_number: current.version_number + 1,
            effective_from: effectiveFrom.toISOString(),
            effective_until: null,
            credits_remaining: current.credits_remaining,
            market_credits: current.market_credits - changes.creditsPaid,
            notes: `Market changes: +${changes.add.length}, -${changes.remove.length}`,
          })
          .select()
          .single();

        if (versionError) throw versionError;

        const keepPlayers = current.players
          .filter(p => !changes.remove.includes(p.player_id))
          .map(p => ({
            roster_version_id: newVersion.id,
            player_id: p.player_id,
            acquisition_type: p.acquisition_type,
            acquisition_price: p.acquisition_price,
            acquired_at: p.acquired_at,
          }));

        const newPlayers = changes.add.map(playerId => ({
          roster_version_id: newVersion.id,
          player_id: playerId,
          acquisition_type: 'market' as const,
          acquisition_price: changes.creditsPaid,
          acquired_at: effectiveFrom.toISOString(),
        }));

        const allPlayers = [...keepPlayers, ...newPlayers];
        
        if (allPlayers.length > 0) {
          const { error: playersError } = await serverSupabase
            .from('roster_players')
            .insert(allPlayers);

          if (playersError) throw playersError;
        }

        return newVersion;
      },
    },

    market: {
      async getTransactions(teamId) {
        let query = supabase
          .from('market_transactions')
          .select('*')
          .order('created_at', { ascending: false });

        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },

      async getCredits(teamId) {
        const { data: versions, error } = await supabase
          .from('roster_versions')
          .select('credits_remaining, market_credits')
          .eq('team_id', teamId)
          .is('effective_until', null)
          .order('version_number', { ascending: false })
          .limit(1);

        if (error) throw error;
        if (!versions || versions.length === 0) {
          return { remaining: 0, market: 60 };
        }

        return {
          remaining: versions[0].credits_remaining,
          market: versions[0].market_credits,
        };
      },

      async processBulkImport(imports, effectiveRound) {
        if (!isSupabaseServerConfigured()) {
          throw new Error('Server configuration required for write operations');
        }

        const serverSupabase = getServerClient();
        const round = await supabase
          .from('rounds')
          .select('kickoff_date')
          .eq('number', effectiveRound)
          .single();

        const effectiveFrom = round.data
          ? new Date(`${round.data.kickoff_date}T00:00:00Z`)
          : new Date();

        const byTeam = new Map<string, BulkMarketImport[]>();
        for (const imp of imports) {
          const existing = byTeam.get(imp.team_id) || [];
          existing.push(imp);
          byTeam.set(imp.team_id, existing);
        }

        for (const [teamId, teamImports] of byTeam) {
          const removes = teamImports.map(i => i.player_out_id);
          const adds = teamImports.map(i => i.player_in_id);
          const totalCredits = teamImports.reduce((sum, i) => sum + i.credits_paid, 0);

          const current = await getCurrentVersion(supabase, teamId);
          if (!current) continue;

          await serverSupabase
            .from('roster_versions')
            .update({ effective_until: effectiveFrom.toISOString() })
            .eq('id', current.id);

          const { data: newVersion, error: versionError } = await serverSupabase
            .from('roster_versions')
            .insert({
              team_id: teamId,
              version_number: current.version_number + 1,
              effective_from: effectiveFrom.toISOString(),
              effective_until: null,
              credits_remaining: current.credits_remaining,
              market_credits: current.market_credits - totalCredits,
              notes: `Bulk import round ${effectiveRound}`,
            })
            .select()
            .single();

          if (versionError) throw versionError;

          const keepPlayers = current.players
            .filter(p => !removes.includes(p.player_id))
            .map(p => ({
              roster_version_id: newVersion.id,
              player_id: p.player_id,
              acquisition_type: p.acquisition_type,
              acquisition_price: p.acquisition_price,
              acquired_at: p.acquired_at,
            }));

          const newPlayersData = adds.map(playerId => ({
            roster_version_id: newVersion.id,
            player_id: playerId,
            acquisition_type: 'market' as const,
            acquisition_price: 0,
            acquired_at: effectiveFrom.toISOString(),
          }));

          if ([...keepPlayers, ...newPlayersData].length > 0) {
            await serverSupabase
              .from('roster_players')
              .insert([...keepPlayers, ...newPlayersData]);
          }

          const transactions = teamImports.flatMap(imp => [
            {
              team_id: teamId,
              transaction_type: 'sell',
              player_id: imp.player_out_id,
              credits_paid: 0,
              credits_refunded: 0,
              effective_round: effectiveRound,
              release_reason: 'still_in_serie_a',
              is_loan: false,
              is_injured: false,
            },
            {
              team_id: teamId,
              transaction_type: 'buy',
              player_id: imp.player_in_id,
              credits_paid: imp.credits_paid,
              credits_refunded: 0,
              effective_round: effectiveRound,
              is_loan: false,
              is_injured: false,
            },
          ]);

          await serverSupabase
            .from('market_transactions')
            .insert(transactions);
        }
      },

      async buyPlayer(teamId, playerId, credits, marketWeek) {
        if (!isSupabaseServerConfigured()) {
          throw new Error('Server configuration required for write operations');
        }
        
        const serverSupabase = getServerClient();
        await serverSupabase
          .from('market_transactions')
          .insert({
            team_id: teamId,
            transaction_type: 'buy',
            player_id: playerId,
            credits_paid: credits,
            credits_refunded: 0,
            market_week: marketWeek,
            is_loan: false,
            is_injured: false,
          });
      },

      async sellPlayer(teamId, playerId, marketWeek) {
        if (!isSupabaseServerConfigured()) {
          throw new Error('Server configuration required for write operations');
        }
        
        const serverSupabase = getServerClient();
        await serverSupabase
          .from('market_transactions')
          .insert({
            team_id: teamId,
            transaction_type: 'sell',
            player_id: playerId,
            credits_paid: 0,
            credits_refunded: 0,
            market_week: marketWeek,
            release_reason: 'still_in_serie_a',
            is_loan: false,
            is_injured: false,
          });
      },
    },

    rounds: {
      async getAll() {
        const { data, error } = await supabase
          .from('rounds')
          .select('*')
          .order('number');
        
        if (error) throw error;
        return data || [];
      },

      async getByNumber(num) {
        const { data, error } = await supabase
          .from('rounds')
          .select('*')
          .eq('number', num)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
      },

      async getCurrent() {
        const now = new Date().toISOString().split('T')[0];
        
        const { data: liveRounds } = await supabase
          .from('rounds')
          .select('*')
          .eq('status', 'live')
          .limit(1);
        
        if (liveRounds && liveRounds.length > 0) {
          return liveRounds[0];
        }

        const { data: upcoming } = await supabase
          .from('rounds')
          .select('*')
          .gte('kickoff_date', now)
          .eq('status', 'scheduled')
          .order('kickoff_date')
          .limit(1);

        if (upcoming && upcoming.length > 0) {
          return upcoming[0];
        }

        const { data: first } = await supabase
          .from('rounds')
          .select('*')
          .order('number')
          .limit(1);

        return first?.[0] || null;
      },

      async getMatchPairings(roundNumber) {
        const { data, error } = await supabase
          .from('match_pairings')
          .select('home_team_id, away_team_id')
          .eq('round_number', roundNumber);
        
        if (error) throw error;
        return data || [];
      },
    },

    liveData: {
      async getLiveVotes(roundNumber) {
        const { data, error } = await supabase
          .from('live_votes')
          .select('player_id, estimated_vote, is_estimated, minutes_played, is_playing, is_subbed_out, updated_at')
          .eq('round_number', roundNumber);
        
        if (error) throw error;
        return data || [];
      },

      async getLiveEvents(roundNumber) {
        const { data, error } = await supabase
          .from('live_events')
          .select('player_id, event_type, minute')
          .eq('round_number', roundNumber)
          .order('minute');
        
        if (error) throw error;
        return data || [];
      },

      async getSerieAMatches(roundNumber) {
        const { data, error } = await supabase
          .from('serie_a_matches')
          .select('id, home_team, away_team, home_score, away_score, minute, status')
          .eq('round_number', roundNumber);
        
        if (error) throw error;
        return data || [];
      },
    },

    async reset() {
      console.warn('Cannot reset Supabase database from client');
    },
  };
}
