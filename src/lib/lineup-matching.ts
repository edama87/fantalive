/**
 * Pure helpers for FMS lineup review: alias rows, candidate order,
 * cross-roster confirmation, and which issues block "Procedi".
 */

import type { PlayerRole } from '@/types';

export const FMS_ALIAS_SOURCE = 'fms';

export interface FmsPlayerAlias {
  alias: string;
  playerId: string;
  playerName?: string | null;
}

export interface LineupPlayerCatalogEntry {
  id: string;
  name: string;
  role: PlayerRole;
  realTeam: string | null;
  rosterTeamIds: string[];
}

export interface PlayerAliasInsert {
  alias: string;
  player_id: string;
  source: string;
}

export function buildPlayerAliasInsert(
  alias: string,
  playerId: string
): PlayerAliasInsert {
  const trimmedAlias = alias.trim();
  const trimmedId = playerId.trim();
  if (!trimmedAlias) {
    throw new Error('Alias vuoto');
  }
  if (!trimmedId) {
    throw new Error('playerId mancante');
  }
  return {
    alias: trimmedAlias,
    player_id: trimmedId,
    source: FMS_ALIAS_SOURCE,
  };
}

export function normalizeSearchName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Order: same-role players on this team's active roster, then the rest of
 * that roster, then every other database player. Optional name filter.
 */
export function rankLineupCandidates(
  players: LineupPlayerCatalogEntry[],
  rosterPlayerIds: ReadonlySet<string>,
  role: PlayerRole | null,
  query: string
): LineupPlayerCatalogEntry[] {
  const needle = normalizeSearchName(query);
  const filtered = needle
    ? players.filter((player) => normalizeSearchName(player.name).includes(needle))
    : players;

  const groupOf = (player: LineupPlayerCatalogEntry): number => {
    const onRoster = rosterPlayerIds.has(player.id);
    if (onRoster && role && player.role === role) return 0;
    if (onRoster) return 1;
    return 2;
  };

  return [...filtered].sort((a, b) => {
    const byGroup = groupOf(a) - groupOf(b);
    if (byGroup !== 0) return byGroup;
    return a.name.localeCompare(b.name, 'it');
  });
}

/**
 * Fantasy teams, other than the lineup's team, that currently roster this player.
 * Empty when no confirmation is needed.
 */
export function otherRosterTeamIds(
  player: { rosterTeamIds: readonly string[] },
  lineupTeamId: string
): string[] {
  return player.rosterTeamIds.filter((teamId) => teamId !== lineupTeamId);
}

export function isStarterCountWarning(message: string): boolean {
  return (
    /titolari:\s*\d+\s*invece di 11/i.test(message) ||
    /expected 11 starters/i.test(message)
  );
}

const UNMATCHED_ERROR =
  /^(Titolari non riconosciuti:|Panchina non riconosciuta:|\d+ starter\(s\) not matched|\d+ bench player\(s\) not matched)/;

export function syncUnrecognizedPlayerErrors<
  T extends {
    starters: Array<{ matchedPlayerId: string | null; rawName: string }>;
    bench: Array<{ matchedPlayerId: string | null; rawName: string }>;
    errors: string[];
  },
>(lineup: T): T {
  const kept = lineup.errors.filter((error) => !UNMATCHED_ERROR.test(error));
  const unmatchedStarters = lineup.starters.filter((player) => !player.matchedPlayerId);
  const unmatchedBench = lineup.bench.filter((player) => !player.matchedPlayerId);

  if (unmatchedStarters.length > 0) {
    kept.push(
      `Titolari non riconosciuti: ${unmatchedStarters.map((player) => player.rawName).join(', ')}`
    );
  }
  if (unmatchedBench.length > 0) {
    kept.push(
      `Panchina non riconosciuta: ${unmatchedBench.map((player) => player.rawName).join(', ')}`
    );
  }

  return { ...lineup, errors: kept };
}

export function lineupBlocksProceed(lineup: {
  isSkipped: boolean;
  usePreviousLineup: boolean;
  hasLineup: boolean;
  errors: string[];
  starters: Array<{ matchedPlayerId: string | null }>;
  bench: Array<{ matchedPlayerId: string | null }>;
}): boolean {
  if (lineup.isSkipped || lineup.usePreviousLineup) return false;
  if (!lineup.hasLineup) return lineup.errors.length > 0;
  const unresolved =
    lineup.starters.some((player) => !player.matchedPlayerId) ||
    lineup.bench.some((player) => !player.matchedPlayerId);
  if (unresolved) return true;
  return lineup.errors.length > 0;
}
