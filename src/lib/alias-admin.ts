/**
 * Gestione alias in Admin: nomi non abbinati di una giornata (import
 * pianetafanta salvati + import automatico fantacalcio.it), con suggerimenti
 * tra i giocatori dello stesso club, e CRUD su player_aliases.
 */

import { getServerClient } from '@/lib/db/supabase';
import {
  canonicalTeamCode,
  looseClubMatch,
  matchFantacalcioPlayer,
  normalizePlayerName,
  type FantacalcioCatalogPlayer,
} from '@/lib/fantacalcio-it';
import type { RosterCandidate } from '@/lib/fantacalcio-auto-import';
import { FANTACALCIO_JOB } from '@/lib/fantacalcio-auto-import';
import type { PianetafantaMatchedPlayer } from '@/lib/pianetafanta';

export type AliasSource = 'pianetafanta' | 'fantacalcio';

export interface UnmatchedName {
  name: string;
  team: string;
  teamCode: string | null;
  role: string | null;
  vote: number | null;
  source: AliasSource;
  matchKey: string | null;
  /** Ha almeno un suggerimento tra i giocatori in rosa nella lega. */
  rostered: boolean;
  suggestions: Array<{ id: string; name: string; role: string; fantaTeam: string | null; best: boolean }>;
}

export interface CatalogEntry extends FantacalcioCatalogPlayer {
  /** Squadra della lega (id) se il giocatore è in rosa adesso. */
  fantaTeam: string | null;
}

/** Suggerimenti: stesso club e almeno una parola del cognome in comune (prima il match "largo"). */
export function suggestPlayers(
  name: string,
  team: string | null,
  role: string | null,
  catalog: readonly CatalogEntry[]
): UnmatchedName['suggestions'] {
  const code = canonicalTeamCode(team);
  if (!code) return [];
  const words = normalizePlayerName(name).split(' ').filter((word) => word.length >= 3);
  const clubPlayers = catalog.filter((player) => canonicalTeamCode(player.realTeam) === code);
  const loose = looseClubMatch(name, clubPlayers, { realTeam: team ?? undefined, role: (role as never) ?? undefined });
  const hits = clubPlayers.filter((player) => {
    if (player.id === loose?.playerId) return true;
    const tokens = normalizePlayerName(player.name).split(' ');
    return words.some((word) => tokens.some((token) => token.startsWith(word) || word.startsWith(token) && token.length >= 4));
  });
  return hits
    .map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      fantaTeam: player.fantaTeam,
      best: player.id === loose?.playerId,
    }))
    .sort((a, b) => Number(b.best) - Number(a.best) || Number(Boolean(b.fantaTeam)) - Number(Boolean(a.fantaTeam)) || a.name.localeCompare(b.name));
}

export function buildUnmatchedList(
  imports: ReadonlyArray<{ match_key: string; players: PianetafantaMatchedPlayer[] }>,
  autoCandidates: readonly RosterCandidate[],
  catalog: readonly CatalogEntry[]
): UnmatchedName[] {
  const out: UnmatchedName[] = [];
  const seen = new Set<string>();
  const push = (item: Omit<UnmatchedName, 'rostered' | 'suggestions' | 'teamCode'>) => {
    const key = `${item.source}|${canonicalTeamCode(item.team) ?? item.team}|${normalizePlayerName(item.name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const suggestions = suggestPlayers(item.name, item.team, item.role, catalog);
    out.push({
      ...item,
      teamCode: canonicalTeamCode(item.team),
      rostered: suggestions.some((suggestion) => suggestion.fantaTeam),
      suggestions,
    });
  };
  for (const stored of imports) {
    for (const player of stored.players ?? []) {
      if (player.playerId) continue;
      push({ name: player.name, team: player.team, role: player.role, vote: player.average ?? null, source: 'pianetafanta', matchKey: stored.match_key });
    }
  }
  for (const candidate of autoCandidates) {
    push({ name: candidate.name, team: candidate.team, role: candidate.role, vote: candidate.vote, source: 'fantacalcio', matchKey: null });
  }
  return out.sort((a, b) => Number(b.rostered) - Number(a.rostered) || (a.teamCode ?? '').localeCompare(b.teamCode ?? '') || a.name.localeCompare(b.name));
}

export async function loadAliasCatalog(): Promise<CatalogEntry[]> {
  const supabase = getServerClient();
  const [{ data: players, error }, { data: versions }] = await Promise.all([
    supabase.from('players').select('id, name, role, real_team').eq('is_active', true),
    supabase.from('roster_versions').select('id, team_id').is('effective_until', null),
  ]);
  if (error) throw new Error(error.message);
  const teamByVersion = new Map((versions ?? []).map((version) => [version.id as string, version.team_id as string]));
  const fantaTeam = new Map<string, string>();
  if (teamByVersion.size > 0) {
    const { data: rows } = await supabase
      .from('roster_players')
      .select('player_id, roster_version_id')
      .in('roster_version_id', [...teamByVersion.keys()]);
    for (const row of rows ?? []) fantaTeam.set(row.player_id as string, teamByVersion.get(row.roster_version_id as string)!);
  }
  return (players ?? []).map((player) => ({
    id: player.id as string,
    name: player.name as string,
    role: player.role as CatalogEntry['role'],
    realTeam: (player.real_team as string | null) ?? null,
    fantaTeam: fantaTeam.get(player.id as string) ?? null,
  }));
}

export async function loadUnmatchedForRound(round: number, catalog: readonly CatalogEntry[]): Promise<UnmatchedName[]> {
  const supabase = getServerClient();
  const [{ data: imports, error }, { data: runs }] = await Promise.all([
    supabase.from('official_vote_imports').select('match_key, players').eq('round_number', round).eq('source', 'pianetafanta'),
    supabase
      .from('cron_runs')
      .select('metadata')
      .eq('job_name', FANTACALCIO_JOB)
      .eq('round_number', round)
      .order('started_at', { ascending: false })
      .limit(60),
  ]);
  if (error) throw new Error(error.message);
  const { data: aliasRows } = await supabase.from('player_aliases').select('alias, player_id, source');
  const aliases = (aliasRows ?? []).map((row) => ({ alias: row.alias as string, playerId: row.player_id as string, source: row.source as string }));
  // I candidati dei run passati che il matcher attuale (o un alias) ora abbina non vanno più mostrati.
  const candidates = (runs ?? [])
    .flatMap((run) => (run.metadata as { roster_candidates?: RosterCandidate[] } | null)?.roster_candidates ?? [])
    .filter((candidate) => !matchFantacalcioPlayer(candidate.name, catalog, aliases, { realTeam: candidate.team, role: (candidate.role as never) ?? undefined }));
  return buildUnmatchedList((imports ?? []) as never, candidates, catalog);
}

export interface AliasRow {
  id: string;
  alias: string;
  source: string;
  playerId: string;
  playerName: string | null;
  realTeam: string | null;
  createdAt: string;
}

export async function listAliases(): Promise<AliasRow[]> {
  const { data, error } = await getServerClient()
    .from('player_aliases')
    .select('id, alias, source, player_id, created_at, player:players(name, real_team)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const player = (Array.isArray(row.player) ? row.player[0] : row.player) as { name?: string; real_team?: string } | null;
    return {
      id: row.id as string,
      alias: row.alias as string,
      source: row.source as string,
      playerId: row.player_id as string,
      playerName: player?.name ?? null,
      realTeam: player?.real_team ?? null,
      createdAt: row.created_at as string,
    };
  });
}
