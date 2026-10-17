/**
 * Cambi di una partita di Serie A per il dettaglio voti (pagina Serie A):
 * chi entra e chi esce, con il minuto quando ESPN lo fornisce.
 */

import type { BonusBreakdown } from '@/types';
import type { FantacalcioBonus, FantacalcioVotePlayer } from '@/lib/fantacalcio-it';
import {
  classifyKeyEvent,
  normalizeEspnTeamName,
  type EspnKeyEvent,
  parseClockMinute,
  type EspnSummary,
} from '@/lib/espn-live';

export interface EspnSubstitution {
  minute: number;
  team: string;
  inName: string;
  outName: string;
}

export interface PlayerSubInfo {
  /** Entrato dalla panchina (minuto se noto). */
  in?: { minute: number | null };
  /** Uscito (minuto se noto). */
  out?: { minute: number | null };
}

/** Cambi dai keyEvents ESPN: participants[0] entra, [1] esce. */
export function extractEspnSubstitutions(summary: EspnSummary): EspnSubstitution[] {
  const subs: EspnSubstitution[] = [];
  const events: EspnKeyEvent[] = (summary as { keyEvents?: EspnKeyEvent[] }).keyEvents ?? [];
  for (const event of events) {
    if (classifyKeyEvent(event) !== 'substitution') continue;
    const [inP, outP] = event.participants ?? [];
    const inName = inP?.athlete?.displayName;
    const outName = outP?.athlete?.displayName;
    if (!inName || !outName) continue;
    subs.push({
      minute: parseClockMinute(event.clock?.displayValue, event.clock?.value),
      team: normalizeEspnTeamName(event.team?.displayName ?? ''),
      inName,
      outName,
    });
  }
  return subs;
}

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
}

/**
 * Nome fantacalcio.it ("Esposito Se.", "Dominguez B.", "Calò") contro nome
 * ESPN ("Sebastiano Esposito"): ogni parola lunga deve esserci, le iniziali
 * devono essere l'inizio di una parola.
 */
export function sameFootballer(fantacalcioName: string, espnName: string): boolean {
  const espn = tokens(espnName);
  const fc = tokens(fantacalcioName);
  const words = fc.filter((t) => t.length >= 3);
  if (words.length === 0) return false;
  return (
    words.every((w) => espn.includes(w)) &&
    fc.filter((t) => t.length < 3).every((initial) => espn.some((e) => e.startsWith(initial)))
  );
}

const sameTeam = (a: string, b: string) => tokens(a).join(' ') === tokens(normalizeEspnTeamName(b)).join(' ');

/**
 * Entrati/usciti per giocatore (chiave team|nome). Con i cambi ESPN si hanno
 * i minuti; senza, si usa l'ordine di fantacalcio.it, che mette chi entra
 * subito dopo il giocatore uscito (player-out).
 */
export function substitutionsByPlayer(
  players: readonly FantacalcioVotePlayer[],
  espnSubs: readonly EspnSubstitution[] = []
): Map<string, PlayerSubInfo> {
  const result = new Map<string, PlayerSubInfo>();
  const key = (p: FantacalcioVotePlayer) => `${p.team}|${p.name}`;
  const set = (p: FantacalcioVotePlayer, info: PlayerSubInfo) => result.set(key(p), { ...result.get(key(p)), ...info });

  if (espnSubs.length > 0) {
    for (const sub of espnSubs) {
      const teamPlayers = players.filter((p) => sameTeam(p.team, sub.team));
      const pool = teamPlayers.length > 0 ? teamPlayers : players;
      const inPlayer = pool.find((p) => sameFootballer(p.name, sub.inName));
      const outPlayer = pool.find((p) => sameFootballer(p.name, sub.outName));
      if (inPlayer) set(inPlayer, { in: { minute: sub.minute } });
      if (outPlayer) set(outPlayer, { out: { minute: sub.minute } });
    }
    // Uscite segnate da fantacalcio.it ma non trovate in ESPN: senza minuto.
    for (const p of players) if (p.substitutedOut && !result.get(key(p))?.out) set(p, { out: { minute: null } });
    return result;
  }

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (player.substitutedOut) set(player, { out: { minute: null } });
    const prev = players[i - 1];
    if (prev && prev.team === player.team && prev.substitutedOut) set(player, { in: { minute: null } });
  }
  return result;
}

const BONUS_KEYS: Record<FantacalcioBonus['type'], keyof BonusBreakdown> = {
  goal: 'goals',
  penalty_scored: 'penaltyGoals',
  penalty_missed: 'penaltyMissed',
  penalty_saved: 'penaltySaved',
  assist: 'assists',
  own_goal: 'ownGoals',
  yellow_card: 'yellowCards',
  red_card: 'redCards',
  goal_conceded: 'goalsConceded',
};

/** Bonus fantacalcio.it -> BonusBreakdown, per le emoji condivise. */
export function fantacalcioBonusBreakdown(bonuses: readonly FantacalcioBonus[]): BonusBreakdown {
  const out: BonusBreakdown = {
    goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
    assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
  };
  for (const bonus of bonuses) out[BONUS_KEYS[bonus.type]] += bonus.count;
  return out;
}
