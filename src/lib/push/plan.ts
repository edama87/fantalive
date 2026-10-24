/**
 * Cosa notificare via Web Push a una squadra, a partire dai dati della giornata.
 * Puro (niente DB): usato dal job /api/cron/push e dai test.
 */
import type { Lineup, Player, PlayerMatchData } from '@/types';
import type { RoundFixture } from '@/lib/serie-a-fixtures';
import { getTeamById } from '@/data/teams';
import { generateDefaultLineup } from '@/lib/lineup-utils';
import { buildMatchRecap } from '@/lib/match-recap';
import { collectLiveNotifications, LIVE_EVENT_TYPES, type LiveEventPrefs } from '@/lib/live-event-notify';
import { parseNotifySettings, planReminders, type NotifySettings } from '@/lib/notify-settings';

/** Preferenze salvate sul server (le stesse di NotifySettings, senza la squadra). */
export type PushPrefs = Omit<NotifySettings, 'teamId'>;

export function parsePushPrefs(value: unknown): PushPrefs {
  const { teamId: _ignored, ...prefs } = parseNotifySettings(JSON.stringify(value ?? {}));
  void _ignored;
  return prefs;
}

export interface PushMessage {
  /** Chiave di deduplica, sempre con il prefisso della giornata `r{n}:`. */
  key: string;
  title: string;
  body: string;
  url: string;
}

export interface RoundSnapshot {
  round: number;
  pairings: ReadonlyArray<{ homeTeamId: string; awayTeamId: string }>;
  lineups: Readonly<Record<string, Lineup>>;
  players: Readonly<Record<string, Player>>;
  playerData: ReadonlyMap<string, PlayerMatchData>;
  fixtures: readonly RoundFixture[];
}

const ALL_ON = Object.fromEntries(LIVE_EVENT_TYPES.map((t) => [t, { ours: true, opp: true }])) as LiveEventPrefs;

function lineupOf(s: RoundSnapshot, teamId: string): Lineup {
  return s.lineups[`${teamId}-${s.round}`] ?? generateDefaultLineup(teamId, s.round);
}

function playersFor(s: RoundSnapshot, teamIds: string[]): Record<string, Player> {
  const out: Record<string, Player> = {};
  for (const id of teamIds) for (const p of getTeamById(id)?.players ?? []) out[p.id] = p;
  return Object.assign(out, s.players);
}

/** Eventi live della sfida della squadra, secondo le preferenze (o tutti con `allTypes`). */
export function liveMessages(s: RoundSnapshot, teamId: string, prefs: PushPrefs | null, allTypes = false): PushMessage[] {
  const pairing = s.pairings.find((p) => p.homeTeamId === teamId || p.awayTeamId === teamId);
  if (!pairing) return [];
  if (!allTypes && !prefs?.liveEnabled) return [];
  const oppId = pairing.homeTeamId === teamId ? pairing.awayTeamId : pairing.homeTeamId;
  const side = (id: string) => {
    const l = lineupOf(s, id);
    return { teamName: getTeamById(id)?.name ?? id, starters: l.starters.map((x) => x.playerId), bench: l.bench.map((x) => x.playerId) };
  };
  const url = `/sfida/${s.round}/${pairing.homeTeamId}-${pairing.awayTeamId}`;
  return collectLiveNotifications({
    round: s.round,
    ours: side(teamId),
    opp: side(oppId),
    playerData: s.playerData,
    players: playersFor(s, [teamId, oppId]),
    fixtures: s.fixtures,
    prefs: allTypes || !prefs ? ALL_ON : prefs.live,
  }).map((n) => ({ ...n, url }));
}

/** Promemoria già "scaduti" (tra `minutesBefore` prima e il calcio d'inizio). */
export function dueReminders(s: RoundSnapshot, teamId: string, prefs: PushPrefs, now: number): PushMessage[] {
  if (!prefs.enabled) return [];
  const lineup = lineupOf(s, teamId);
  const roster = playersFor(s, [teamId]);
  const inputs = [...lineup.starters.map((x) => ({ x, starter: true })), ...lineup.bench.map((x) => ({ x, starter: false }))]
    .map(({ x, starter }) => ({ player: roster[x.playerId], isStarter: starter }))
    .filter((v): v is { player: Player; isStarter: boolean } => !!v.player);
  const recap = buildMatchRecap(s.fixtures, inputs, []);
  // planReminders tiene solo `at > now`: spostando `now` indietro di minutesBefore
  // restano i promemoria con calcio d'inizio futuro; poi teniamo quelli già dovuti.
  return planReminders(recap.map((e) => ({ fixture: e.fixture, players: e.home })), prefs.minutesBefore, now - prefs.minutesBefore * 60_000)
    .filter((r) => r.at <= now)
    .map((r) => ({ key: `r${s.round}:${r.tag}`, title: r.title, body: r.body, url: '/' }));
}

/** Tutto ciò che va inviato ora a un iscritto (prima della deduplica). */
export function messagesFor(s: RoundSnapshot, teamId: string, prefs: PushPrefs, now: number): PushMessage[] {
  return [...dueReminders(s, teamId, prefs, now), ...liveMessages(s, teamId, prefs)];
}
