export type PlayerRole = 'P' | 'D' | 'C' | 'A';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  teamId: string;
  realTeam?: string;
}

export interface Team {
  id: string;
  name: string;
  managerName: string;
  players: Player[];
}

export interface MatchPairing {
  homeTeamId: string;
  awayTeamId: string;
}

export interface Round {
  number: number;
  serieAMatchday: number;
  date: string;
  pairings: MatchPairing[];
}

export interface LineupSlot {
  playerId: string;
  position: number;
}

export interface Lineup {
  teamId: string;
  roundNumber: number;
  starters: LineupSlot[];
  bench: LineupSlot[];
  formation: string;
}

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished';

export type EventType = 
  | 'goal'
  | 'penalty_scored'
  | 'penalty_missed'
  | 'penalty_saved'
  | 'assist'
  | 'own_goal'
  | 'yellow_card'
  | 'red_card'
  | 'substitution_in'
  | 'substitution_out';

export interface PlayerEvent {
  playerId: string;
  type: EventType;
  minute: number;
  relatedPlayerId?: string;
}

/**
 * Provenienza del voto: 'consolidated' = voti di testata pianetafanta
 * (definitivi), 'official' = fantacalcio.it (provvisorio), 'live' = stima live.
 */
export type VoteSource = 'consolidated' | 'official' | 'live';

export interface PlayerMatchData {
  playerId: string;
  estimatedVote: number | null;
  minutesPlayed: number;
  isPlaying: boolean;
  events: PlayerEvent[];
  finalVote?: number;
  voteSource?: VoteSource;
  /** Voto consolidato: testate (0-3) uscite per la partita del giocatore. */
  paperCount?: number;
  /** Voto FMS importato: totale bonus/malus FMS (fantavoto = voto + bonusOverride). */
  bonusOverride?: number;
  /** Voto d'ufficio della simulazione (non reale). */
  simulated?: boolean;
}

export interface SerieAMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: MatchStatus;
  playerData: Map<string, PlayerMatchData>;
}

export interface FantasyMatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeTotal: number;
  awayTotal: number;
  homeGoals: number;
  awayGoals: number;
  homeModifiers: ModifiersBreakdown;
  awayModifiers: ModifiersBreakdown;
  homePlayerScores: PlayerScore[];
  awayPlayerScores: PlayerScore[];
  status: MatchStatus;
}

export interface ModifiersBreakdown {
  defenseModifier: number;
  midfieldModifier: number;
  attackModifier: number;
  homeBonus: number;
  total: number;
  /** Come è stato calcolato ogni modificatore (per la spiegazione in Sfida). */
  details?: ModifierDetails;
}

/** Voto di un giocatore usato in un modificatore. */
export interface ModifierVoteInput {
  playerId?: string;
  name?: string;
  /** Voto base (senza bonus/malus); 0 = senza voto. */
  vote: number;
  /** Voto usato nel calcolo (s.v./riserva = 5). */
  usedVote: number;
  /** Aggiunto d'ufficio a 5 per pareggiare il numero di centrocampisti. */
  padded?: boolean;
  /** Riserva d'ufficio. */
  riserva?: boolean;
}

export interface DefenseModifierExplanation {
  teamId: string;
  inputs: ModifierVoteInput[];
  average: number | null;
  band: { minAvg: number; maxAvg: number; modifier: number } | null;
  numDefenders: number;
  formationAdjustment: number;
  modifier: number;
}

export interface MidfieldModifierExplanation {
  homeInputs: ModifierVoteInput[];
  awayInputs: ModifierVoteInput[];
  homeTotal: number;
  awayTotal: number;
  diff: number;
  band: { minDiff: number; bonus: number; malus: number };
  homeModifier: number;
  awayModifier: number;
}

export interface AttackModifierEntry {
  playerId?: string;
  name?: string;
  vote: number;
  scored: boolean;
  /** Fascia di voto raggiunta (null se sotto 6,5 o ha segnato). */
  minVote: number | null;
  bonus: number;
}

export interface AttackModifierExplanation {
  entries: AttackModifierEntry[];
  modifier: number;
}

export interface ModifierDetails {
  /** Modificatore difesa dell'avversario, applicato a questa squadra. */
  opponentDefense: DefenseModifierExplanation;
  midfield: MidfieldModifierExplanation;
  /** true se questa squadra è la "home" del confronto centrocampo. */
  isHome: boolean;
  attack: AttackModifierExplanation;
  homeBonus: number;
}

export interface PlayerScore {
  player: Player;
  baseVote: number;
  bonuses: BonusBreakdown;
  fantavoto: number;
  status: 'playing' | 'played' | 'to_play' | 'sv' | 'substituted';
  minutesPlayed?: number;
  isStarter: boolean;
  /** Titolare sostituito in automatico: chi è entrato al suo posto (non conta nel totale). */
  substitutedBy?: Player;
  /** Panchinaro entrato in automatico: il titolare che sostituisce. */
  substitutedFor?: Player;
  /** Posizione in panchina nella formazione schierata (solo panchinari): ordine della lista panchina. */
  benchPosition?: number;
  /** Panchinaro non entrato: mostrato per info, escluso dal totale. */
  isUnusedBench?: boolean;
  /**
   * Panchinaro che di sicuro non può più entrare (vedi benchCertainlyOut nello
   * scoring engine): mostrato in grigio.
   */
  isCertainlyOut?: boolean;
  /** Provenienza del voto (consolidato pianetafanta, fantacalcio.it o stima live). */
  voteSource?: VoteSource;
  /** Testate (0-3) uscite per la partita, per i consolidati. */
  paperCount?: number;
  /** Voto d'ufficio della simulazione ("6,0*"). */
  simulated?: boolean;
}

export interface BonusBreakdown {
  goals: number;
  penaltyGoals: number;
  penaltyMissed: number;
  penaltySaved: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
  goalsConceded: number;
}

export interface StandingsEntry {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  fantaPoints: number;
}

export interface LiveStandingsEntry extends StandingsEntry {
  liveFantaPoints: number;
  liveGoalsFor: number;
  currentMatchResult?: {
    opponentId: string;
    goalsFor: number;
    goalsAgainst: number;
    fantaPoints: number;
  };
}
