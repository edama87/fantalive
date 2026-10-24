import type { EventType, Player, PlayerMatchData } from '@/types';
import { serieATeamCode, type RoundFixture } from '@/lib/serie-a-fixtures';

/** Eventi live notificabili. 'goal' esclude i gol subiti dal portiere (relatedPlayerId 'opponent'). */
export const LIVE_EVENT_TYPES = ['goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'penalty_saved', 'red_card'] as const;
export type LiveEventType = (typeof LIVE_EVENT_TYPES)[number];
export type LiveSide = 'ours' | 'opp';
export type LiveEventPrefs = Record<LiveEventType, Record<LiveSide, boolean>>;

export const DEFAULT_LIVE_EVENT_PREFS: LiveEventPrefs = {
  goal: { ours: true, opp: true },
  own_goal: { ours: true, opp: false },
  penalty_scored: { ours: true, opp: true },
  penalty_missed: { ours: true, opp: true },
  penalty_saved: { ours: true, opp: true },
  red_card: { ours: true, opp: true },
};

export const LIVE_EVENT_LABELS: Record<LiveEventType, { label: string; ours: string; opp: string }> = {
  goal: { label: 'Gol', ours: 'segnati da noi', opp: 'subiti (gol avversari)' },
  own_goal: { label: 'Autogol', ours: 'dei nostri', opp: 'degli avversari' },
  penalty_scored: { label: 'Rigore segnato', ours: 'nostro', opp: 'avversario' },
  penalty_missed: { label: 'Rigore sbagliato', ours: 'nostro', opp: 'avversario' },
  penalty_saved: { label: 'Rigore parato', ours: 'dal nostro portiere', opp: 'dal loro portiere' },
  red_card: { label: 'Espulsione', ours: 'nostra', opp: 'avversaria' },
};

export function parseLiveEventPrefs(value: unknown): LiveEventPrefs {
  const out = structuredClone(DEFAULT_LIVE_EVENT_PREFS);
  if (!value || typeof value !== 'object') return out;
  for (const type of LIVE_EVENT_TYPES) {
    const v = (value as Record<string, unknown>)[type];
    if (!v || typeof v !== 'object') continue;
    for (const side of ['ours', 'opp'] as const) {
      const flag = (v as Record<string, unknown>)[side];
      if (typeof flag === 'boolean') out[type][side] = flag;
    }
  }
  return out;
}

export interface LiveSideInput {
  teamName: string;
  starters: readonly string[];
  bench: readonly string[];
}

export interface LiveNotification {
  key: string;
  title: string;
  body: string;
}

const EMOJI: Record<LiveEventType, string> = {
  goal: '⚽', own_goal: '🔴⚽', penalty_scored: '🎯', penalty_missed: '❌', penalty_saved: '🧤', red_card: '🟥',
};

function text(type: LiveEventType, name: string, club: string | null, minute: number): string {
  const who = club ? `${name} (${club})` : name;
  const at = minute > 0 ? ` ${minute}′` : '';
  switch (type) {
    case 'goal': return `Gol di ${who}${at}`;
    case 'own_goal': return `Autogol di ${who}${at}`;
    case 'penalty_scored': return `Rigore segnato da ${who}${at}`;
    case 'penalty_missed': return `Rigore sbagliato da ${who}${at}`;
    case 'penalty_saved': return `Rigore parato da ${who}${at}`;
    case 'red_card': return `Espulso ${who}${at}`;
  }
}

/** Un panchinaro conta solo se è entrato (minuti, ingresso o eventi registrati). */
function benchPlayerOn(data: PlayerMatchData): boolean {
  return data.minutesPlayed > 0 || data.isPlaying || data.events.length > 0;
}

/**
 * Notifiche per gli eventi live dei giocatori in formazione delle due squadre della sfida.
 * La chiave è giocatore + tipo + numero progressivo (non il minuto, che tra ESPN e
 * fantacalcio.it può cambiare), così ogni evento scatta una volta sola per dispositivo.
 */
export function collectLiveNotifications(input: {
  round: number;
  ours: LiveSideInput;
  opp: LiveSideInput;
  playerData: ReadonlyMap<string, PlayerMatchData>;
  players: Readonly<Record<string, Pick<Player, 'name' | 'realTeam'>>>;
  fixtures: readonly RoundFixture[];
  prefs: LiveEventPrefs;
}): LiveNotification[] {
  const clubName = new Map<string, string>();
  for (const f of input.fixtures) {
    clubName.set(f.homeCode, f.homeTeam);
    clubName.set(f.awayCode, f.awayTeam);
  }
  const out: LiveNotification[] = [];
  for (const side of ['ours', 'opp'] as const) {
    const team = input[side];
    const ids = [...team.starters.map((id) => [id, true] as const), ...team.bench.map((id) => [id, false] as const)];
    for (const [playerId, starter] of ids) {
      const data = input.playerData.get(playerId);
      if (!data || (!starter && !benchPlayerOn(data))) continue;
      const player = input.players[playerId];
      const surname = player?.name.split(' ').filter((w, i, a) => a.slice(0, i + 1).every((x) => x === x.toUpperCase())).join(' ');
      const name = surname ? displaySurname(surname) : player?.name || playerId;
      const code = serieATeamCode(player?.realTeam);
      const club = code ? clubName.get(code) ?? player?.realTeam ?? null : null;
      const counts = new Map<EventType, number>();
      for (const event of data.events) {
        if (!(LIVE_EVENT_TYPES as readonly string[]).includes(event.type)) continue;
        if (event.type === 'goal' && event.relatedPlayerId === 'opponent') continue; // gol subito dal portiere
        const type = event.type as LiveEventType;
        const n = (counts.get(type) ?? 0) + 1;
        counts.set(type, n);
        if (!input.prefs[type][side]) continue;
        out.push({
          key: `r${input.round}:${playerId}:${type}:${n}`,
          title: `${EMOJI[type]} ${team.teamName}`,
          body: text(type, name, club, event.minute),
        });
      }
    }
  }
  return out;
}

/** 'MCTOMINAY' → 'McTominay', 'DE BRUYNE' → 'De Bruyne', "N'DICKA" → "N'Dicka". */
export function displaySurname(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (_, ch: string) => 'Mc' + ch.toUpperCase());
}
