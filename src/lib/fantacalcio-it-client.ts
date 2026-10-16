/**
 * HTTP access and matchday scrape for fantacalcio.it.
 * Parsing stays in fantacalcio-it.ts so tests can use saved HTML.
 */

import type { PlayerRole } from '@/types';
import { getPublicClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAllPlayers } from '@/data/teams';
import {
  fantacalcioCalendarUrl,
  matchFantacalcioPlayer,
  parseFantacalcioCalendar,
  parseFantacalcioVotes,
  type FantacalcioAlias,
  type FantacalcioCalendarMatch,
  type FantacalcioCatalogPlayer,
  type FantacalcioVotePlayer,
} from '@/lib/fantacalcio-it';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface FantacalcioScrapedPlayer extends FantacalcioVotePlayer {
  matchId: string;
  playerId: string | null;
  matchedName: string | null;
}

export interface FantacalcioMatchday {
  matches: FantacalcioCalendarMatch[];
  players: FantacalcioScrapedPlayer[];
  unmatched: FantacalcioScrapedPlayer[];
}

export async function fetchFantacalcioHtml(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
      'Accept-Language': 'it-IT,it;q=0.9',
    },
  });
  if (!response.ok) {
    throw new Error(`Fantacalcio.it ha risposto ${response.status} per ${url}`);
  }
  return response.text();
}

export async function loadFantacalcioCatalog(): Promise<{
  players: FantacalcioCatalogPlayer[];
  aliases: FantacalcioAlias[];
}> {
  if (!isSupabaseConfigured()) {
    return { players: staticCatalog(), aliases: [] };
  }

  const supabase = getPublicClient();
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, role, real_team')
    .eq('is_active', true);

  if (playersError || !players) {
    console.warn('[fantacalcio-it] Catalogo giocatori non disponibile, uso i dati statici');
    return { players: staticCatalog(), aliases: [] };
  }

  const { data: aliases, error: aliasError } = await supabase
    .from('player_aliases')
    .select('alias, player_id, source');

  if (aliasError) {
    console.warn('[fantacalcio-it] Alias non disponibili:', aliasError.message);
  }

  return {
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role as PlayerRole,
      realTeam: player.real_team,
    })),
    aliases: (aliases ?? []).map((alias) => ({
      alias: alias.alias,
      playerId: alias.player_id,
      source: alias.source,
    })),
  };
}

function staticCatalog(): FantacalcioCatalogPlayer[] {
  return getAllPlayers().map((player) => ({
    id: player.id,
    name: player.name,
    role: player.role,
    realTeam: player.realTeam ?? null,
  }));
}

export async function scrapeFantacalcioMatchday(
  matchday: number,
  catalog: { players: readonly FantacalcioCatalogPlayer[]; aliases: readonly FantacalcioAlias[] },
  fetchImpl: typeof fetch = fetch
): Promise<FantacalcioMatchday> {
  const calendarHtml = await fetchFantacalcioHtml(fantacalcioCalendarUrl(matchday), fetchImpl);
  const matches = parseFantacalcioCalendar(calendarHtml);
  const players: FantacalcioScrapedPlayer[] = [];

  const pages = await Promise.all(
    matches.map(async (match) => {
      try {
        const html = await fetchFantacalcioHtml(match.votesUrl, fetchImpl);
        return { match, rows: parseFantacalcioVotes(html), error: null as string | null };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Errore pagina voti';
        console.warn(`[fantacalcio-it] ${match.homeTeam}-${match.awayTeam}: ${message}`);
        return { match, rows: [] as FantacalcioVotePlayer[], error: message };
      }
    })
  );

  for (const page of pages) {
    for (const row of page.rows) {
      const hit = matchFantacalcioPlayer(row.name, catalog.players, catalog.aliases, {
        role: row.role,
        realTeam: row.team,
      });
      const scraped: FantacalcioScrapedPlayer = {
        ...row,
        matchId: page.match.matchId,
        playerId: hit?.playerId ?? null,
        matchedName: hit?.playerName ?? null,
      };
      if (!hit) {
        console.warn(
          `[fantacalcio-it] non abbinato: ${row.name} (${row.team}, ${row.role ?? '-'})`
        );
      }
      players.push(scraped);
    }
  }

  return {
    matches,
    players,
    unmatched: players.filter((player) => player.playerId == null && player.vote != null),
  };
}

export async function loadFantacalcioMatchVotes(
  matchday: number,
  matchId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ match: FantacalcioCalendarMatch | null; players: FantacalcioVotePlayer[] }> {
  const calendarHtml = await fetchFantacalcioHtml(fantacalcioCalendarUrl(matchday), fetchImpl);
  const match = parseFantacalcioCalendar(calendarHtml).find((item) => item.matchId === matchId) ?? null;
  if (!match) return { match: null, players: [] };
  const votesHtml = await fetchFantacalcioHtml(match.votesUrl, fetchImpl);
  return { match, players: parseFantacalcioVotes(votesHtml) };
}
