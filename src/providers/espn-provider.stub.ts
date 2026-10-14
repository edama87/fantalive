/**
 * ESPN Live Data Provider (STUB)
 * 
 * This is a stub implementation for the ESPN API provider.
 * To wire this up:
 * 
 * 1. ESPN Soccer API endpoints:
 *    - Scoreboard: https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard
 *    - Summary: https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event={eventId}
 * 
 * 2. Key data points to extract:
 *    - competitions[].competitors[]: teams, scores
 *    - competitions[].status: match status, clock
 *    - boxscore.players[]: player stats, ratings
 *    - plays[]: match events (goals, cards, substitutions)
 * 
 * 3. Rating to vote conversion:
 *    - ESPN ratings are typically 1-10 scale
 *    - Use DefaultVoteEstimator or custom mapping
 * 
 * 4. Player ID matching:
 *    - ESPN uses numeric IDs
 *    - Need to map ESPN player names to internal player IDs
 *    - Consider fuzzy matching for name variations
 */

import {
  LiveDataProvider,
  ProviderType,
  NormalizedMatchData,
  NormalizedSerieAMatch,
  NormalizedPlayerData,
} from './types';
import { MatchStatus } from '@/types';

export class EspnProvider implements LiveDataProvider {
  readonly name = 'ESPN Provider';
  readonly type: ProviderType = 'espn';
  
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1';

  async initialize(): Promise<void> {
    console.warn('ESPN Provider is a stub. Implement fetchLiveData to use.');
  }

  async fetchLiveData(serieAMatchday: number): Promise<NormalizedMatchData> {
    // Stub: Return empty data
    // Real implementation would:
    // 1. Fetch scoreboard: GET ${baseUrl}/scoreboard
    // 2. For each live match, fetch summary: GET ${baseUrl}/summary?event={id}
    // 3. Parse player data, ratings, events
    // 4. Normalize to internal format
    
    throw new Error(
      'ESPN Provider not implemented. ' +
      'Set LIVE_PROVIDER=mock to use the mock provider, ' +
      'or implement this provider by following the comments in espn-provider.stub.ts'
    );
  }

  private parseMatchStatus(espnStatus: string): MatchStatus {
    const statusMap: Record<string, MatchStatus> = {
      'pre': 'scheduled',
      'in': 'live',
      'half': 'halftime',
      'post': 'finished',
    };
    return statusMap[espnStatus] || 'scheduled';
  }

  private mapEspnPlayerToInternal(espnName: string): string | null {
    // Implement fuzzy matching or exact name lookup
    // against getAllPlayers() from @/data/teams
    return null;
  }

  dispose(): void {
  }
}

export function createEspnProvider(): EspnProvider {
  return new EspnProvider();
}
