/**
 * Mock Live Data Provider
 * 
 * Simulates a live Serie A matchday with realistic player data.
 * Used for development and testing without external API dependencies.
 */

import {
  LiveDataProvider,
  ProviderType,
  NormalizedMatchData,
  NormalizedSerieAMatch,
  NormalizedPlayerData,
  NormalizedPlayerEvent,
  DefaultVoteEstimator,
} from './types';
import { getAllPlayers } from '@/data/teams';
import { EventType, MatchStatus } from '@/types';

const SERIE_A_TEAMS = [
  'Inter', 'Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina',
  'Bologna', 'Torino', 'Udinese', 'Sassuolo', 'Empoli', 'Lecce', 'Cagliari',
  'Verona', 'Monza', 'Genoa', 'Como', 'Parma',
];

const MOCK_REAL_TEAM_MAPPING: Record<string, string> = {
  'Maignan': 'Milan', 'Dimarco': 'Inter', 'Bremer': 'Juventus', 'McTominay': 'Napoli',
  'Kone': 'Roma', 'Laurienté': 'Lazio', 'Kean': 'Fiorentina', 'Malen': 'Atalanta',
  'Orsolini': 'Bologna', 'Barella': 'Inter', 'Calhanoglu': 'Inter', 'Lautaro Martinez': 'Inter',
  'Pulisic': 'Milan', 'Zaccagni': 'Lazio', 'Dybala': 'Roma', 'Lobotka': 'Napoli',
  'De Bruyne': 'Napoli', 'M. Thuram': 'Inter', 'Bastoni': 'Inter', 'Tomori': 'Milan',
  'Neres': 'Napoli', 'Frattesi': 'Inter', 'Hojlund': 'Milan', 'Gudmundsson': 'Fiorentina',
  'De Ketelaere': 'Atalanta', 'Dovbyk': 'Roma', 'Krstovic': 'Lecce', 'Lucca': 'Udinese',
  'Svilar': 'Roma', 'Vicario': 'Fiorentina', 'Carnesecchi': 'Atalanta', 'Meret': 'Napoli',
  'Cambiaso': 'Juventus', 'Bellanova': 'Atalanta', 'Di Lorenzo': 'Napoli', 'Pavard': 'Inter',
  'Conceicao': 'Juventus', 'Yildiz': 'Juventus', 'Nico Gonzalez': 'Juventus', 'Vlahovic': 'Juventus',
  'Rabiot': 'Milan', 'Modric': 'Milan', 'Mkhitaryan': 'Inter', 'Zielinski': 'Inter',
};

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

export class MockProvider implements LiveDataProvider {
  readonly name = 'Mock Provider';
  readonly type: ProviderType = 'mock';
  
  private random: () => number;
  private voteEstimator = new DefaultVoteEstimator();
  private matchMinute: number = 0;
  private matchStatus: MatchStatus = 'scheduled';
  private simulationStartTime: number = 0;

  constructor(seed?: number) {
    this.random = seededRandom(seed ?? Date.now());
  }

  async initialize(): Promise<void> {
    this.simulationStartTime = Date.now();
  }

  async fetchLiveData(serieAMatchday: number): Promise<NormalizedMatchData> {
    const elapsedSeconds = Math.floor((Date.now() - this.simulationStartTime) / 1000);
    this.matchMinute = Math.min(Math.floor(elapsedSeconds / 6), 90);
    
    if (this.matchMinute === 0) {
      this.matchStatus = 'scheduled';
    } else if (this.matchMinute < 45) {
      this.matchStatus = 'live';
    } else if (this.matchMinute === 45) {
      this.matchStatus = 'halftime';
    } else if (this.matchMinute < 90) {
      this.matchStatus = 'live';
    } else {
      this.matchStatus = 'finished';
    }

    const serieAMatches = this.generateSerieAMatches();
    const playerData = this.generatePlayerData(serieAMatches);

    return {
      serieAMatches,
      playerData,
      lastUpdated: new Date(),
      isLive: this.matchStatus === 'live' || this.matchStatus === 'halftime',
    };
  }

  private generateSerieAMatches(): NormalizedSerieAMatch[] {
    const matches: NormalizedSerieAMatch[] = [];
    const shuffledTeams = [...SERIE_A_TEAMS].sort(() => this.random() - 0.5);

    for (let i = 0; i < 10; i++) {
      const homeTeam = shuffledTeams[i * 2];
      const awayTeam = shuffledTeams[i * 2 + 1];
      
      const homeScore = this.matchMinute > 0 ? Math.floor(this.random() * 3) : 0;
      const awayScore = this.matchMinute > 0 ? Math.floor(this.random() * 2) : 0;

      let matchMinute = this.matchMinute;
      let status = this.matchStatus;
      
      if (i < 2) {
        matchMinute = Math.min(this.matchMinute + 15, 90);
        if (matchMinute >= 90) status = 'finished';
      } else if (i > 7) {
        matchMinute = Math.max(this.matchMinute - 30, 0);
        if (matchMinute === 0) status = 'scheduled';
      }

      matches.push({
        matchId: `match-${i}`,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        minute: matchMinute,
        status,
      });
    }

    return matches;
  }

  private generatePlayerData(matches: NormalizedSerieAMatch[]): Map<string, NormalizedPlayerData> {
    const playerData = new Map<string, NormalizedPlayerData>();
    const allPlayers = getAllPlayers();

    for (const player of allPlayers) {
      const realTeam = MOCK_REAL_TEAM_MAPPING[player.name] || 
        SERIE_A_TEAMS[Math.floor(this.random() * SERIE_A_TEAMS.length)];
      
      const match = matches.find(m => m.homeTeam === realTeam || m.awayTeam === realTeam);
      
      if (!match || match.status === 'scheduled') {
        playerData.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          realTeam,
          rating: null,
          estimatedVote: null,
          minutesPlayed: 0,
          isPlaying: false,
          isSubstitutedOut: false,
          events: [],
        });
        continue;
      }

      const isStarter = this.random() > 0.15;
      const minutesPlayed = isStarter 
        ? Math.min(match.minute, 90)
        : (this.random() > 0.7 ? Math.max(0, match.minute - 60) : 0);
      
      const isPlaying = match.status === 'live' && minutesPlayed > 0 && this.random() > 0.1;
      const isSubstitutedOut = !isPlaying && minutesPlayed > 0 && minutesPlayed < match.minute;

      const events = this.generatePlayerEvents(player.id, player.name, minutesPlayed, match);
      
      const baseRating = 5.5 + this.random() * 3;
      const rating = minutesPlayed > 0 ? Math.round(baseRating * 10) / 10 : null;
      
      const estimatedVote = this.voteEstimator.estimateVote(rating, events);

      playerData.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        realTeam,
        rating,
        estimatedVote,
        minutesPlayed,
        isPlaying,
        isSubstitutedOut,
        events,
      });
    }

    return playerData;
  }

  private generatePlayerEvents(
    playerId: string,
    playerName: string,
    minutesPlayed: number,
    match: NormalizedSerieAMatch
  ): NormalizedPlayerEvent[] {
    const events: NormalizedPlayerEvent[] = [];
    
    if (minutesPlayed === 0) return events;

    if (this.random() > 0.85) {
      const isFromPenalty = this.random() > 0.85;
      events.push({
        playerId,
        playerName,
        type: isFromPenalty ? 'penalty_scored' : 'goal',
        minute: Math.floor(this.random() * minutesPlayed) + 1,
      });
    }

    if (this.random() > 0.88) {
      events.push({
        playerId,
        playerName,
        type: 'assist',
        minute: Math.floor(this.random() * minutesPlayed) + 1,
      });
    }

    if (this.random() > 0.92) {
      events.push({
        playerId,
        playerName,
        type: 'yellow_card',
        minute: Math.floor(this.random() * minutesPlayed) + 1,
      });
    }

    if (this.random() > 0.98) {
      events.push({
        playerId,
        playerName,
        type: 'red_card',
        minute: Math.floor(this.random() * minutesPlayed) + 1,
      });
    }

    if (this.random() > 0.98) {
      events.push({
        playerId,
        playerName,
        type: 'own_goal',
        minute: Math.floor(this.random() * minutesPlayed) + 1,
      });
    }

    if (this.random() > 0.97) {
      events.push({
        playerId,
        playerName,
        type: 'penalty_missed',
        minute: Math.floor(this.random() * minutesPlayed) + 1,
      });
    }

    if (this.random() > 0.95) {
      events.push({
        playerId,
        playerName,
        type: 'penalty_saved',
        minute: Math.floor(this.random() * minutesPlayed) + 1,
      });
    }

    return events;
  }

  dispose(): void {
  }
}

export function createMockProvider(seed?: number): MockProvider {
  return new MockProvider(seed);
}
