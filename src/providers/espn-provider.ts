/**
 * ESPN Live Data Provider (calcio, Serie A = ita.1)
 *
 * - Scoreboard per data: https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard?dates=YYYYMMDD
 *   (un intervallo di date non è supportato: si chiama una volta per giorno)
 * - Summary: .../summary?event={id} -> rosters[].roster[] e keyEvents[]
 *
 * ESPN non dà voti: il voto è stimato (vedi estimateEspnVote) e marcato come tale.
 * I giocatori sono abbinati ai giocatori del DB (players + player_aliases).
 */

import {
  LiveDataProvider,
  ProviderType,
  NormalizedMatchData,
  NormalizedPlayerData,
  NormalizedSerieAMatch,
  FetchLiveDataOptions,
} from './types';
import {
  createEspnPlayerMatcher,
  parseEspnScoreboard,
  parseEspnSummary,
  type EspnPlayerMatcher,
  type EspnScoreboard,
  type EspnSummary,
  type UnmatchedEspnPlayer,
} from '@/lib/espn-live';
import type { FantacalcioAlias, FantacalcioCatalogPlayer } from '@/lib/fantacalcio-it';
import type { PlayerRole } from '@/types';
import { getAllPlayers } from '@/data/teams';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1';

export interface EspnPlayerCatalog {
  players: FantacalcioCatalogPlayer[];
  aliases: FantacalcioAlias[];
}

export interface EspnProviderOptions {
  /** Catalogo giocatori; se assente viene letto dal DB (o dai dati statici). */
  catalog?: EspnPlayerCatalog;
  fetchImpl?: typeof fetch;
}

async function loadCatalogFromDb(): Promise<EspnPlayerCatalog | null> {
  const { getServerClient, isSupabaseServerConfigured } = await import('@/lib/db/supabase');
  if (!isSupabaseServerConfigured()) return null;
  const supabase = getServerClient();
  const players: FantacalcioCatalogPlayer[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, role, real_team')
      .eq('is_active', true)
      .range(from, from + 999);
    if (error) throw new Error(`players: ${error.message}`);
    for (const row of data ?? []) {
      players.push({ id: row.id, name: row.name, role: row.role as PlayerRole, realTeam: row.real_team });
    }
    if (!data || data.length < 1000) break;
  }
  const { data: aliasRows, error: aliasError } = await supabase
    .from('player_aliases')
    .select('alias, player_id, source');
  if (aliasError) throw new Error(`player_aliases: ${aliasError.message}`);
  const aliases = (aliasRows ?? []).map((row) => ({
    alias: row.alias as string,
    playerId: row.player_id as string,
    source: (row.source as string) ?? '',
  }));
  return { players, aliases };
}

function staticCatalog(): EspnPlayerCatalog {
  return {
    players: getAllPlayers().map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      realTeam: player.realTeam ?? null,
    })),
    aliases: [],
  };
}

function todayRome(): string {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return iso.replace(/-/g, '');
}

export class EspnProvider implements LiveDataProvider {
  readonly name = 'ESPN Provider';
  readonly type: ProviderType = 'espn';

  private matcher: EspnPlayerMatcher | null = null;
  private readonly options: EspnProviderOptions;

  constructor(options: EspnProviderOptions = {}) {
    this.options = options;
  }

  private get fetcher(): typeof fetch {
    return this.options.fetchImpl ?? fetch;
  }

  async initialize(): Promise<void> {
    let catalog = this.options.catalog ?? null;
    if (!catalog) {
      try {
        catalog = await loadCatalogFromDb();
      } catch (error) {
        console.warn('[ESPN] catalogo giocatori dal DB non disponibile:', error);
      }
    }
    catalog ??= staticCatalog();
    this.matcher = createEspnPlayerMatcher(catalog.players, catalog.aliases);
  }

  async fetchLiveData(_serieAMatchday: number, options?: FetchLiveDataOptions): Promise<NormalizedMatchData> {
    if (!this.matcher) await this.initialize();
    const matcher = this.matcher as EspnPlayerMatcher;
    const dates = options?.dates?.length ? options.dates : [todayRome()];

    const scoreboards = await Promise.all(dates.map((date) => this.fetchJson<EspnScoreboard>(`${ESPN_BASE_URL}/scoreboard?dates=${date}`)));
    const byId = new Map<string, NormalizedSerieAMatch>();
    for (const scoreboard of scoreboards) {
      for (const match of parseEspnScoreboard(scoreboard)) byId.set(match.matchId, match);
    }
    const serieAMatches = [...byId.values()];

    const started = serieAMatches.filter((m) => m.status !== 'scheduled');
    const summaries = await Promise.all(
      started.map(async (match) => {
        try {
          const summary = await this.fetchJson<EspnSummary>(`${ESPN_BASE_URL}/summary?event=${match.matchId}`);
          return { match, parsed: parseEspnSummary(summary, matcher, { status: match.status, minute: match.minute }) };
        } catch (error) {
          console.warn(`[ESPN] summary ${match.matchId} non disponibile:`, error);
          return null;
        }
      })
    );

    const playerData = new Map<string, NormalizedPlayerData>();
    const unmatchedPlayers: UnmatchedEspnPlayer[] = [];
    for (const entry of summaries) {
      if (!entry) continue;
      for (const player of entry.parsed.players) playerData.set(player.playerId, player);
      unmatchedPlayers.push(...entry.parsed.unmatched);
    }
    if (unmatchedPlayers.length > 0) {
      console.info(
        `[ESPN] ${unmatchedPlayers.length} giocatori non abbinati al DB (di solito non sono in nessuna rosa):`,
        unmatchedPlayers.map((p) => `${p.name} (${p.team ?? '?'})`).join(', ')
      );
    }

    return {
      serieAMatches,
      playerData,
      lastUpdated: new Date(),
      isLive: serieAMatches.some((m) => m.status === 'live' || m.status === 'halftime'),
      unmatchedPlayers,
    };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.fetcher(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`ESPN ${response.status} ${url}`);
    return (await response.json()) as T;
  }

  dispose(): void {
    this.matcher = null;
  }
}

export function createEspnProvider(options?: EspnProviderOptions): EspnProvider {
  return new EspnProvider(options);
}
