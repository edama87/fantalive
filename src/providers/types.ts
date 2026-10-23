/**
 * Live Data Provider Interface
 * 
 * This module defines the contract that any live data provider must implement.
 * Providers can source data from ESPN, API-Football, FotMob, manual CSV, or mock data.
 * 
 * To add a new provider:
 * 1. Create a new file in src/providers/ (e.g., espn-provider.ts)
 * 2. Implement the LiveDataProvider interface
 * 3. Export the provider from src/providers/index.ts
 * 4. Add the provider to the factory in src/providers/factory.ts
 * 5. Set LIVE_PROVIDER env var to use your provider
 * 
 * The provider is responsible for:
 * - Fetching live match data from its source
 * - Normalizing data to the internal NormalizedMatchData format
 * - Estimating votes from ratings (if the source provides ratings)
 */

import { MatchStatus, EventType } from '@/types';

export type ProviderType = 'mock' | 'espn' | 'apifootball' | 'fotmob' | 'csv' | 'fantacalcio-it';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  pollingIntervalMs?: number;
}

export interface NormalizedPlayerEvent {
  playerId: string;
  playerName: string;
  type: EventType;
  minute: number;
  relatedPlayerId?: string;
  relatedPlayerName?: string;
}

export interface NormalizedPlayerData {
  playerId: string;
  playerName: string;
  realTeam: string;
  rating: number | null;
  estimatedVote: number | null;
  minutesPlayed: number;
  isPlaying: boolean;
  isSubstitutedOut: boolean;
  events: NormalizedPlayerEvent[];
}

export interface NormalizedSerieAMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  /** displayClock ESPN grezzo ("83'", "45'+2'"). */
  displayClock?: string;
  status: MatchStatus;
  kickoffTime?: string;
  venue?: string;
}

export interface NormalizedMatchData {
  serieAMatches: NormalizedSerieAMatch[];
  playerData: Map<string, NormalizedPlayerData>;
  lastUpdated: Date;
  isLive: boolean;
  /** Nomi della fonte non abbinati a giocatori del DB (solo log/diagnostica). */
  unmatchedPlayers?: Array<{ name: string; team: string | null }>;
}

export interface FetchLiveDataOptions {
  /** Giorni (yyyymmdd) della giornata di Serie A da leggere. Default: oggi. */
  dates?: string[];
}

export interface LiveDataProvider {
  readonly name: string;
  readonly type: ProviderType;

  initialize(): Promise<void>;
  
  fetchLiveData(serieAMatchday: number, options?: FetchLiveDataOptions): Promise<NormalizedMatchData>;
  
  fetchFinalVotes?(serieAMatchday: number): Promise<Map<string, number>>;
  
  dispose(): void;
}

export interface VoteEstimator {
  estimateVote(rating: number | null, events: NormalizedPlayerEvent[]): number | null;
}

export class DefaultVoteEstimator implements VoteEstimator {
  estimateVote(rating: number | null, events: NormalizedPlayerEvent[]): number | null {
    if (rating === null) return null;
    
    let vote = this.ratingToVote(rating);
    
    for (const event of events) {
      switch (event.type) {
        case 'goal':
          vote = Math.min(vote + 0.5, 10);
          break;
        case 'penalty_scored':
          vote = Math.min(vote + 0.3, 10);
          break;
        case 'assist':
          vote = Math.min(vote + 0.3, 10);
          break;
        case 'own_goal':
          vote = Math.max(vote - 0.5, 4);
          break;
        case 'penalty_missed':
          vote = Math.max(vote - 1, 4);
          break;
        case 'red_card':
          vote = Math.max(vote - 1, 4);
          break;
        case 'yellow_card':
          vote = Math.max(vote - 0.2, 4);
          break;
      }
    }
    
    return Math.round(vote * 2) / 2;
  }

  private ratingToVote(rating: number): number {
    if (rating >= 9) return 8;
    if (rating >= 8) return 7.5;
    if (rating >= 7.5) return 7;
    if (rating >= 7) return 6.5;
    if (rating >= 6.5) return 6;
    if (rating >= 6) return 5.5;
    if (rating >= 5.5) return 5;
    return 4.5;
  }
}
