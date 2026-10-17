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

export interface PlayerMatchData {
  playerId: string;
  estimatedVote: number | null;
  minutesPlayed: number;
  isPlaying: boolean;
  events: PlayerEvent[];
  finalVote?: number;
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
}

export interface PlayerScore {
  player: Player;
  baseVote: number;
  bonuses: BonusBreakdown;
  fantavoto: number;
  status: 'playing' | 'played' | 'to_play' | 'sv' | 'substituted';
  minutesPlayed?: number;
  isStarter: boolean;
  substitutedBy?: Player;
  /** Panchinaro non entrato: mostrato per info, escluso dal totale. */
  isUnusedBench?: boolean;
  /**
   * Panchinaro che di sicuro non può più entrare (vedi benchCertainlyOut nello
   * scoring engine): mostrato in grigio.
   */
  isCertainlyOut?: boolean;
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
