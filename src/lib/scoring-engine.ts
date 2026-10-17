import {
  Player,
  PlayerRole,
  Lineup,
  PlayerMatchData,
  FantasyMatchResult,
  ModifiersBreakdown,
  PlayerScore,
  BonusBreakdown,
  MatchStatus,
  ModifierVoteInput,
  DefenseModifierExplanation,
  MidfieldModifierExplanation,
  AttackModifierExplanation,
} from '@/types';
import { getTeamById, getPlayerById } from '@/data/teams';

export type PlayerDirectory = Record<string, Player>;

/** Stato della partita di Serie A per codice squadra (FRO, SAS, ...). */
export type TeamMatchStatuses = ReadonlyMap<string, MatchStatus>;

/**
 * Un titolare senza voto si sostituisce solo a partita della sua squadra finita.
 * Senza informazioni sulle partite (teamStatuses assente) o senza squadra nota
 * si mantiene il comportamento classico (sostituzione immediata).
 */
export function isAwaitingMatch(player: Player, teamStatuses?: TeamMatchStatuses): boolean {
  if (!teamStatuses || teamStatuses.size === 0 || !player.realTeam) return false;
  const status = teamStatuses.get(player.realTeam.toUpperCase());
  return status !== 'finished';
}

function findPlayer(playerId: string, directory?: PlayerDirectory): Player | undefined {
  return directory?.[playerId] ?? getPlayerById(playerId);
}

function withResolvedFormation(lineup: Lineup, directory?: PlayerDirectory): Lineup {
  const counts = { D: 0, C: 0, A: 0 };
  for (const slot of lineup.starters) {
    const player = findPlayer(slot.playerId, directory);
    if (!player || player.role === 'P') continue;
    counts[player.role] += 1;
  }
  const formation = `${counts.D}-${counts.C}-${counts.A}`;
  if (!ALLOWED_FORMATIONS.includes(formation)) return lineup;
  return { ...lineup, formation };
}

const ALLOWED_FORMATIONS = ['6-3-1', '5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-6-1', '3-5-2', '3-4-3'];

const GOAL_THRESHOLDS = [
  { min: 0, max: 65.99, goals: 0 },
  { min: 66, max: 71.99, goals: 1 },
  { min: 72, max: 76.99, goals: 2 },
  { min: 77, max: 80.99, goals: 3 },
  { min: 81, max: 84.99, goals: 4 },
  { min: 85, max: 88.99, goals: 5 },
];

/** Tabelle dei modificatori (regolamento Bundlesliga). */
export const DEFENSE_MODIFIER_TABLE: Array<{ maxAvg: number; modifier: number }> = [
  { maxAvg: 5.19, modifier: 4 },
  { maxAvg: 5.39, modifier: 3 },
  { maxAvg: 5.59, modifier: 2 },
  { maxAvg: 5.79, modifier: 1 },
  { maxAvg: 5.99, modifier: 0 },
  { maxAvg: 6.19, modifier: -1 },
  { maxAvg: 6.39, modifier: -2 },
  { maxAvg: 6.59, modifier: -3 },
  { maxAvg: 6.79, modifier: -4 },
  { maxAvg: Infinity, modifier: -5 },
];

export const MIDFIELD_MODIFIER_TABLE: Array<{ minDiff: number; bonus: number; malus: number }> = [
  { minDiff: 0, bonus: 0, malus: 0 },
  { minDiff: 0.75, bonus: 0.5, malus: -0.5 },
  { minDiff: 1.5, bonus: 1, malus: -1 },
  { minDiff: 2.25, bonus: 1.5, malus: -1.5 },
  { minDiff: 3, bonus: 2, malus: -2 },
  { minDiff: 3.75, bonus: 2.5, malus: -2.5 },
  { minDiff: 4.5, bonus: 3, malus: -3 },
  { minDiff: 5.25, bonus: 3.5, malus: -3.5 },
  { minDiff: 6, bonus: 4, malus: -4 },
];

export const ATTACK_MODIFIER_TABLE: Array<{ vote: number; bonus: number }> = [
  { vote: 6.5, bonus: 0.5 },
  { vote: 7, bonus: 1 },
  { vote: 7.5, bonus: 1.5 },
  { vote: 8, bonus: 2 },
];

export function isValidFormation(formation: string): boolean {
  return ALLOWED_FORMATIONS.includes(formation);
}

export function parseFormation(formation: string): { D: number; C: number; A: number } {
  const parts = formation.split('-').map(Number);
  return { D: parts[0], C: parts[1], A: parts[2] };
}

export function calculateBonuses(playerData: PlayerMatchData, player: Player): BonusBreakdown {
  const bonuses: BonusBreakdown = {
    goals: 0,
    penaltyGoals: 0,
    penaltyMissed: 0,
    penaltySaved: 0,
    assists: 0,
    ownGoals: 0,
    yellowCards: 0,
    redCards: 0,
    goalsConceded: 0,
  };

  for (const event of playerData.events) {
    switch (event.type) {
      case 'goal':
        // Gol dell'avversario sul portiere: malus gol subito, non bonus gol.
        if (event.relatedPlayerId === 'opponent') {
          bonuses.goalsConceded++;
          break;
        }
        bonuses.goals++;
        break;
      case 'penalty_scored':
        bonuses.penaltyGoals++;
        break;
      case 'penalty_missed':
        bonuses.penaltyMissed++;
        break;
      case 'penalty_saved':
        bonuses.penaltySaved++;
        break;
      case 'assist':
        bonuses.assists++;
        break;
      case 'own_goal':
        bonuses.ownGoals++;
        break;
      case 'yellow_card':
        bonuses.yellowCards++;
        break;
      case 'red_card':
        bonuses.redCards++;
        break;
    }
  }

  return bonuses;
}

export function calculateFantavoto(
  baseVote: number,
  bonuses: BonusBreakdown,
  isGoalkeeper: boolean
): number {
  let fantavoto = baseVote;

  fantavoto += bonuses.goals * 3;
  fantavoto += bonuses.penaltyGoals * 2;
  fantavoto -= bonuses.penaltyMissed * 3;
  fantavoto += bonuses.penaltySaved * 3;
  fantavoto += bonuses.assists * 1;
  fantavoto -= bonuses.ownGoals * 1;
  fantavoto -= bonuses.yellowCards * 0.5;
  fantavoto -= bonuses.redCards * 1;

  if (isGoalkeeper) {
    fantavoto -= bonuses.goalsConceded * 1;
  }

  return fantavoto;
}

export const HOME_BONUS = 2;

type VoteLike = number | { playerId?: string; name?: string; vote: number; riserva?: boolean };

function toInput(v: VoteLike): ModifierVoteInput {
  const base = typeof v === 'number' ? { vote: v } : v;
  return { ...base, usedVote: base.riserva || base.vote === 0 ? 5 : base.vote };
}

/** Correzione per numero di difensori: 3 dif -1, 5 dif +1, 6 dif +2. */
export function defenseFormationAdjustment(numDefenders: number): number {
  if (numDefenders === 3) return -1;
  if (numDefenders > 4) return numDefenders - 4;
  return 0;
}

/**
 * Modificatore difesa con il dettaglio del calcolo: media dei voti dei
 * difensori schierati (s.v. = 5), fascia della tabella, correzione modulo.
 */
export function explainDefenseModifier(
  defenders: readonly VoteLike[],
  numDefendersInFormation: number,
  teamId = ''
): DefenseModifierExplanation {
  const inputs = defenders.map(toInput);
  const formationAdjustment = defenseFormationAdjustment(numDefendersInFormation);
  if (inputs.length === 0) {
    return { teamId, inputs, average: null, band: null, numDefenders: numDefendersInFormation, formationAdjustment, modifier: 0 };
  }
  const average = inputs.reduce((sum, i) => sum + i.usedVote, 0) / inputs.length;
  let band: DefenseModifierExplanation['band'] = null;
  let minAvg = 0;
  for (const entry of DEFENSE_MODIFIER_TABLE) {
    if (average <= entry.maxAvg) {
      band = { minAvg, maxAvg: entry.maxAvg, modifier: entry.modifier };
      break;
    }
    minAvg = Math.round((entry.maxAvg + 0.01) * 100) / 100;
  }
  const modifier = (band?.modifier ?? 0) + formationAdjustment;
  return { teamId, inputs, average, band, numDefenders: numDefendersInFormation, formationAdjustment, modifier };
}

export function calculateDefenseModifier(
  defenderVotes: number[],
  numDefendersInFormation: number
): number {
  return explainDefenseModifier(defenderVotes, numDefendersInFormation).modifier;
}

/**
 * Modificatore centrocampo con il dettaglio: somma dei voti dei centrocampisti
 * (s.v. = 5, chi ne schiera meno aggiunge dei 5 fino al numero dell'altro),
 * differenza tra le due somme e fascia della tabella.
 */
export function explainMidfieldModifier(
  homeMidfielders: readonly VoteLike[],
  awayMidfielders: readonly VoteLike[],
  homeNumMidfielders: number,
  awayNumMidfielders: number
): MidfieldModifierExplanation {
  const maxMidfielders = Math.max(homeNumMidfielders, awayNumMidfielders);
  const normalize = (votes: readonly VoteLike[]): ModifierVoteInput[] => {
    const result = votes.map(toInput);
    while (result.length < maxMidfielders) result.push({ vote: 0, usedVote: 5, padded: true });
    return result;
  };
  const homeInputs = normalize(homeMidfielders);
  const awayInputs = normalize(awayMidfielders);
  const homeTotal = homeInputs.reduce((a, b) => a + b.usedVote, 0);
  const awayTotal = awayInputs.reduce((a, b) => a + b.usedVote, 0);
  const diff = Math.abs(homeTotal - awayTotal);

  let band = MIDFIELD_MODIFIER_TABLE[0];
  for (let i = MIDFIELD_MODIFIER_TABLE.length - 1; i >= 0; i--) {
    if (diff >= MIDFIELD_MODIFIER_TABLE[i].minDiff) {
      band = MIDFIELD_MODIFIER_TABLE[i];
      break;
    }
  }

  let homeModifier = 0;
  let awayModifier = 0;
  if (homeTotal > awayTotal) {
    homeModifier = band.bonus;
    awayModifier = band.malus;
  } else if (awayTotal > homeTotal) {
    homeModifier = band.malus;
    awayModifier = band.bonus;
  }
  return { homeInputs, awayInputs, homeTotal, awayTotal, diff, band, homeModifier, awayModifier };
}

export function calculateMidfieldModifier(
  homeMidfielderVotes: number[],
  awayMidfielderVotes: number[],
  homeNumMidfielders: number,
  awayNumMidfielders: number
): { homeModifier: number; awayModifier: number } {
  const { homeModifier, awayModifier } = explainMidfieldModifier(
    homeMidfielderVotes,
    awayMidfielderVotes,
    homeNumMidfielders,
    awayNumMidfielders
  );
  return { homeModifier, awayModifier };
}

/**
 * Modificatore attacco con il dettaglio: per ogni attaccante schierato che
 * NON ha segnato, bonus dalla fascia del suo voto base (6,5 / 7 / 7,5 / 8).
 */
export function explainAttackModifier(
  forwards: ReadonlyArray<{ playerId?: string; name?: string; vote: number; scored: boolean }>
): AttackModifierExplanation {
  let modifier = 0;
  const entries = forwards.map((forward) => {
    let minVote: number | null = null;
    let bonus = 0;
    if (!forward.scored) {
      for (let i = ATTACK_MODIFIER_TABLE.length - 1; i >= 0; i--) {
        if (forward.vote >= ATTACK_MODIFIER_TABLE[i].vote) {
          minVote = ATTACK_MODIFIER_TABLE[i].vote;
          bonus = ATTACK_MODIFIER_TABLE[i].bonus;
          break;
        }
      }
    }
    modifier += bonus;
    return { ...forward, minVote, bonus };
  });
  return { entries, modifier };
}

export function calculateAttackModifier(
  forwardVotes: Array<{ vote: number; scored: boolean }>
): number {
  return explainAttackModifier(forwardVotes).modifier;
}

export function calculateGoals(totalPoints: number): number {
  if (totalPoints >= 89) {
    const extraGoals = Math.floor((totalPoints - 85) / 4);
    return 5 + extraGoals;
  }

  for (const threshold of GOAL_THRESHOLDS) {
    if (totalPoints >= threshold.min && totalPoints <= threshold.max) {
      return threshold.goals;
    }
  }
  return 0;
}

export function applyGoalConversionRules(
  homePoints: number,
  awayPoints: number,
  homeGoals: number,
  awayGoals: number
): { homeGoals: number; awayGoals: number } {
  const diff = Math.abs(homePoints - awayPoints);
  const minPoints = Math.min(homePoints, awayPoints);
  const maxPoints = Math.max(homePoints, awayPoints);

  if (homeGoals !== awayGoals && diff < 3) {
    if (minPoints < 66) {
      return { homeGoals: 0, awayGoals: 0 };
    }
    const equalGoals = Math.min(homeGoals, awayGoals);
    return { homeGoals: equalGoals, awayGoals: equalGoals };
  }

  if (minPoints < 59 && maxPoints >= 59 && diff >= 3) {
    if (homePoints > awayPoints) {
      return { homeGoals: homeGoals + 1, awayGoals };
    } else {
      return { homeGoals, awayGoals: awayGoals + 1 };
    }
  }

  if (homeGoals === awayGoals && diff >= 4 && minPoints >= 66) {
    if (homePoints > awayPoints) {
      return { homeGoals: homeGoals + 1, awayGoals };
    } else {
      return { homeGoals, awayGoals: awayGoals + 1 };
    }
  }

  return { homeGoals, awayGoals };
}

export function processSubstitutions(
  lineup: Lineup,
  playerDataMap: Map<string, PlayerMatchData>,
  maxSubs: number = 5,
  playersById?: PlayerDirectory,
  teamStatuses?: TeamMatchStatuses
): {
  finalStarters: string[];
  subsUsed: number;
  riservaUfficio: string | null;
  /** Titolari senza voto la cui partita non è ancora finita: né sostituiti né contati. */
  pendingStarters: string[];
} {
  const team = getTeamById(lineup.teamId);
  if (!team) return { finalStarters: [], subsUsed: 0, riservaUfficio: null, pendingStarters: [] };

  const formation = parseFormation(lineup.formation);
  const roleSlots: Record<PlayerRole, number> = {
    P: 1,
    D: formation.D,
    C: formation.C,
    A: formation.A,
  };

  const finalStarters: string[] = [];
  const pendingStarters: string[] = [];
  const rolesFilled: Record<PlayerRole, number> = { P: 0, D: 0, C: 0, A: 0 };
  let subsUsed = 0;
  let riservaUfficio: string | null = null;

  const benchByRole: Record<PlayerRole, string[]> = { P: [], D: [], C: [], A: [] };
  for (const slot of lineup.bench.sort((a, b) => a.position - b.position)) {
    const player = findPlayer(slot.playerId, playersById);
    if (player) {
      benchByRole[player.role].push(slot.playerId);
    }
  }

  for (const slot of lineup.starters.sort((a, b) => a.position - b.position)) {
    const player = findPlayer(slot.playerId, playersById);
    if (!player) continue;

    const data = playerDataMap.get(slot.playerId);
    const hasVote = data && data.estimatedVote !== null;

    if (hasVote || (player.role === 'P' && data && data.minutesPlayed >= 30)) {
      finalStarters.push(slot.playerId);
      rolesFilled[player.role]++;
    } else if (isAwaitingMatch(player, teamStatuses)) {
      pendingStarters.push(slot.playerId);
    } else if (subsUsed < maxSubs) {
      const benchForRole = benchByRole[player.role];
      let substituted = false;

      for (const benchPlayerId of benchForRole) {
        const benchData = playerDataMap.get(benchPlayerId);
        if (benchData && benchData.estimatedVote !== null) {
          finalStarters.push(benchPlayerId);
          benchForRole.splice(benchForRole.indexOf(benchPlayerId), 1);
          rolesFilled[player.role]++;
          subsUsed++;
          substituted = true;
          break;
        }
      }

      if (!substituted && !riservaUfficio) {
        riservaUfficio = slot.playerId;
        finalStarters.push(slot.playerId);
        rolesFilled[player.role]++;
        subsUsed++;
      } else if (!substituted) {
        finalStarters.push(slot.playerId);
        rolesFilled[player.role]++;
      }
    } else {
      finalStarters.push(slot.playerId);
      rolesFilled[player.role]++;
    }
  }

  return { finalStarters, subsUsed, riservaUfficio, pendingStarters };
}

export const MAX_SUBSTITUTIONS = 5;

/**
 * Panchinari che di sicuro non possono più entrare, con le stesse regole di
 * processSubstitutions (cambi solo nello stesso ruolo, in ordine di panchina,
 * massimo 5 cambi). Un panchinaro non entrato è "certamente fuori" se:
 *  1. la sua partita è finita e non ha voto (non può contare);
 *  2. sono già stati fatti 5 cambi con panchinari;
 *  3. i titolari del suo ruolo che potrebbero ancora servire un cambio (senza
 *     voto e non già sostituiti) sono tutti coperti da panchinari dello stesso
 *     ruolo davanti a lui che hanno già un voto (es. tutti gli attaccanti
 *     titolari hanno votato -> attaccanti in panchina fuori).
 * I panchinari già entrati non sono mai "fuori". Senza stato delle partite
 * (teamStatuses) la regola 1 non si applica.
 */
export function benchCertainlyOut(
  lineup: Lineup,
  playerDataMap: Map<string, PlayerMatchData>,
  finalStarters: readonly string[],
  playersById?: PlayerDirectory,
  teamStatuses?: TeamMatchStatuses,
  maxSubs: number = MAX_SUBSTITUTIONS
): Set<string> {
  const out = new Set<string>();
  const hasVote = (id: string, role: PlayerRole) => {
    const data = playerDataMap.get(id);
    return Boolean(data && (data.estimatedVote !== null || (role === 'P' && data.minutesPlayed >= 30)));
  };
  const used = new Set(finalStarters);
  const benchSlots = [...lineup.bench].sort((a, b) => a.position - b.position);
  const usedBench = benchSlots.filter((slot) => used.has(slot.playerId));
  const subsMadeByRole: Record<PlayerRole, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const slot of usedBench) {
    const player = findPlayer(slot.playerId, playersById);
    if (player) subsMadeByRole[player.role]++;
  }

  // Titolari per ruolo che possono ancora aver bisogno di un cambio.
  const openNeeds: Record<PlayerRole, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const slot of lineup.starters) {
    const player = findPlayer(slot.playerId, playersById);
    if (player && !hasVote(slot.playerId, player.role)) openNeeds[player.role]++;
  }
  for (const role of Object.keys(openNeeds) as PlayerRole[]) {
    openNeeds[role] = Math.max(0, openNeeds[role] - subsMadeByRole[role]);
  }

  const votedAhead: Record<PlayerRole, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const slot of benchSlots) {
    if (used.has(slot.playerId)) continue;
    const player = findPlayer(slot.playerId, playersById);
    if (!player) continue;
    const voted = hasVote(slot.playerId, player.role);
    const team = player.realTeam?.toUpperCase();
    const matchFinished = Boolean(team && teamStatuses?.get(team) === 'finished');

    if (
      (!voted && matchFinished) ||
      usedBench.length >= maxSubs ||
      openNeeds[player.role] <= votedAhead[player.role]
    ) {
      out.add(slot.playerId);
    }
    if (voted) votedAhead[player.role]++;
  }
  return out;
}

export function calculateTeamScore(
  lineup: Lineup,
  playerDataMap: Map<string, PlayerMatchData>,
  isHome: boolean,
  opponentDefenseModifier: number,
  midfieldModifier: number,
  riservaUfficio: string | null,
  playersById?: PlayerDirectory,
  teamStatuses?: TeamMatchStatuses
): {
  total: number;
  playerScores: PlayerScore[];
  attackModifier: number;
  attackExplanation: AttackModifierExplanation;
} {
  const team = getTeamById(lineup.teamId);
  if (!team) {
    return { total: 0, playerScores: [], attackModifier: 0, attackExplanation: { entries: [], modifier: 0 } };
  }

  const { finalStarters, pendingStarters } = processSubstitutions(
    lineup,
    playerDataMap,
    5,
    playersById,
    teamStatuses
  );
  const playerScores: PlayerScore[] = [];
  let total = 0;

  const forwardData: Array<{ playerId: string; name: string; vote: number; scored: boolean }> = [];

  for (const playerId of finalStarters) {
    const player = findPlayer(playerId, playersById);
    if (!player) continue;

    const data = playerDataMap.get(playerId);
    let baseVote: number;
    let status: PlayerScore['status'];

    if (playerId === riservaUfficio) {
      baseVote = player.role === 'P' ? 3 : 4;
      status = 'sv';
    } else if (!data || data.estimatedVote === null) {
      if (player.role === 'P' && data && data.minutesPlayed >= 30) {
        baseVote = 6;
        status = 'played';
      } else {
        baseVote = 0;
        status = 'sv';
      }
    } else {
      baseVote = data.estimatedVote;
      status = data.isPlaying ? 'playing' : 'played';
    }

    const bonuses = data ? calculateBonuses(data, player) : {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };

    if (player.role === 'P' && data) {
      bonuses.goalsConceded = data.events.filter(e => e.type === 'goal' && e.relatedPlayerId === 'opponent').length;
    }

    const fantavoto = calculateFantavoto(baseVote, bonuses, player.role === 'P');
    total += fantavoto;

    if (player.role === 'A') {
      const scored = bonuses.goals > 0 || bonuses.penaltyGoals > 0;
      forwardData.push({ playerId: player.id, name: player.name, vote: baseVote, scored });
    }

    playerScores.push({
      player,
      baseVote,
      bonuses,
      fantavoto,
      status,
      minutesPlayed: data?.minutesPlayed,
      isStarter: lineup.starters.some(s => s.playerId === playerId),
    });
  }

  // Titolari in attesa della loro partita: mostrati come "da giocare", fuori dal totale.
  const pendingScores = new Map<string, PlayerScore>();
  for (const playerId of pendingStarters) {
    const player = findPlayer(playerId, playersById);
    if (!player) continue;
    const data = playerDataMap.get(playerId);
    pendingScores.set(playerId, {
      player,
      baseVote: 0,
      bonuses: data
        ? calculateBonuses(data, player)
        : {
            goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
            assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
          },
      fantavoto: 0,
      status: data?.isPlaying ? 'playing' : 'to_play',
      minutesPlayed: data?.minutesPlayed,
      isStarter: true,
    });
  }

  // Ordine di visualizzazione = ordine della formazione schierata (posizione dei
  // titolari). processSubstitutions produce un finalStarter per ogni titolare non
  // in attesa, nello stesso ordine (il subentrato prende il posto del titolare):
  // si reinseriscono i titolari in attesa al loro posto, senza riordinare.
  if (pendingScores.size > 0) {
    const scoredInOrder = [...playerScores];
    playerScores.length = 0;
    let next = 0;
    for (const slot of [...lineup.starters].sort((a, b) => a.position - b.position)) {
      const pending = pendingScores.get(slot.playerId);
      if (pending) {
        playerScores.push(pending);
        pendingScores.delete(slot.playerId);
      } else if (findPlayer(slot.playerId, playersById) && next < scoredInOrder.length) {
        playerScores.push(scoredInOrder[next++]);
      }
    }
    playerScores.push(...scoredInOrder.slice(next), ...pendingScores.values());
  }

  const attackExplanation = explainAttackModifier(forwardData);
  const attackModifier = attackExplanation.modifier;
  total += attackModifier;
  total += opponentDefenseModifier;
  total += midfieldModifier;

  if (isHome) {
    total += HOME_BONUS;
  }

  // Append unused bench players for display (do not affect total)
  const scoredIds = new Set(playerScores.map((ps) => ps.player.id));
  const certainlyOut = benchCertainlyOut(lineup, playerDataMap, finalStarters, playersById, teamStatuses);
  for (const slot of [...lineup.bench].sort((a, b) => a.position - b.position)) {
    if (scoredIds.has(slot.playerId)) continue;
    const player = findPlayer(slot.playerId, playersById);
    if (!player) continue;

    const data = playerDataMap.get(slot.playerId);
    const benchBonuses: BonusBreakdown = data
      ? calculateBonuses(data, player)
      : {
          goals: 0,
          penaltyGoals: 0,
          penaltyMissed: 0,
          penaltySaved: 0,
          assists: 0,
          ownGoals: 0,
          yellowCards: 0,
          redCards: 0,
          goalsConceded: 0,
        };
    const benchVote = data?.estimatedVote ?? null;
    playerScores.push({
      player,
      baseVote: benchVote ?? 0,
      bonuses: benchBonuses,
      // Solo visualizzazione: il fantavoto di un panchinaro non entrato non va nel totale.
      fantavoto:
        benchVote != null ? calculateFantavoto(benchVote, benchBonuses, player.role === 'P') : 0,
      status: data?.isPlaying
        ? 'playing'
        : data && data.minutesPlayed > 0
          ? 'played'
          : 'to_play',
      minutesPlayed: data?.minutesPlayed,
      isUnusedBench: true,
      isCertainlyOut: certainlyOut.has(slot.playerId),
      isStarter: false,
    });
  }

  for (const score of playerScores) {
    const voteSource = playerDataMap.get(score.player.id)?.voteSource;
    if (voteSource) score.voteSource = voteSource;
  }

  return { total, playerScores, attackModifier, attackExplanation };
}

export function calculateMatch(
  homeLineup: Lineup,
  awayLineup: Lineup,
  playerDataMap: Map<string, PlayerMatchData>,
  status: MatchStatus = 'live',
  playersById?: PlayerDirectory,
  teamStatuses?: TeamMatchStatuses
): FantasyMatchResult {
  const home = withResolvedFormation(homeLineup, playersById);
  const away = withResolvedFormation(awayLineup, playersById);
  const homeFormation = parseFormation(home.formation);
  const awayFormation = parseFormation(away.formation);

  const { finalStarters: homeStarters, riservaUfficio: homeRiserva } = 
    processSubstitutions(home, playerDataMap, 5, playersById, teamStatuses);
  const { finalStarters: awayStarters, riservaUfficio: awayRiserva } = 
    processSubstitutions(away, playerDataMap, 5, playersById, teamStatuses);

  const getVotesForRole = (starters: string[], role: PlayerRole, riserva: string | null) => {
    return starters
      .map(id => findPlayer(id, playersById))
      .filter((p): p is Player => p !== undefined && p !== null && p.role === role)
      .map((p: Player) => {
        if (riserva === p.id) return { playerId: p.id, name: p.name, vote: 0, riserva: true };
        const data = playerDataMap.get(p.id);
        return { playerId: p.id, name: p.name, vote: data?.estimatedVote ?? 0 };
      });
  };

  const homeDefVotes = getVotesForRole(homeStarters, 'D', homeRiserva);
  const awayDefVotes = getVotesForRole(awayStarters, 'D', awayRiserva);
  const homeMidVotes = getVotesForRole(homeStarters, 'C', homeRiserva);
  const awayMidVotes = getVotesForRole(awayStarters, 'C', awayRiserva);

  const homeDefense = explainDefenseModifier(homeDefVotes, homeFormation.D, home.teamId);
  const awayDefense = explainDefenseModifier(awayDefVotes, awayFormation.D, away.teamId);
  const homeDefMod = homeDefense.modifier;
  const awayDefMod = awayDefense.modifier;

  const midfield = explainMidfieldModifier(homeMidVotes, awayMidVotes, homeFormation.C, awayFormation.C);
  const { homeModifier: homeMidMod, awayModifier: awayMidMod } = midfield;

  const homeResult = calculateTeamScore(
    home,
    playerDataMap,
    true,
    awayDefMod,
    homeMidMod,
    homeRiserva,
    playersById,
    teamStatuses
  );

  const awayResult = calculateTeamScore(
    away,
    playerDataMap,
    false,
    homeDefMod,
    awayMidMod,
    awayRiserva,
    playersById,
    teamStatuses
  );

  let homeGoals = calculateGoals(homeResult.total);
  let awayGoals = calculateGoals(awayResult.total);

  const adjusted = applyGoalConversionRules(
    homeResult.total,
    awayResult.total,
    homeGoals,
    awayGoals
  );
  homeGoals = adjusted.homeGoals;
  awayGoals = adjusted.awayGoals;

  return {
    homeTeamId: home.teamId,
    awayTeamId: away.teamId,
    homeTotal: homeResult.total,
    awayTotal: awayResult.total,
    homeGoals,
    awayGoals,
    homeModifiers: {
      defenseModifier: awayDefMod,
      midfieldModifier: homeMidMod,
      attackModifier: homeResult.attackModifier,
      homeBonus: HOME_BONUS,
      total: awayDefMod + homeMidMod + homeResult.attackModifier + HOME_BONUS,
      details: {
        opponentDefense: awayDefense,
        midfield,
        isHome: true,
        attack: homeResult.attackExplanation,
        homeBonus: HOME_BONUS,
      },
    },
    awayModifiers: {
      defenseModifier: homeDefMod,
      midfieldModifier: awayMidMod,
      attackModifier: awayResult.attackModifier,
      homeBonus: 0,
      total: homeDefMod + awayMidMod + awayResult.attackModifier,
      details: {
        opponentDefense: homeDefense,
        midfield,
        isHome: false,
        attack: awayResult.attackExplanation,
        homeBonus: 0,
      },
    },
    homePlayerScores: homeResult.playerScores,
    awayPlayerScores: awayResult.playerScores,
    status,
  };
}
