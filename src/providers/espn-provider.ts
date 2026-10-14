/**
 * ESPN Live Data Provider
 * 
 * Fetches live Serie A data from ESPN's free API endpoints.
 * ESPN provides scores, lineups, and events but NOT ratings.
 * 
 * Vote estimation heuristic (clearly marked as 'stimato'):
 * - Base vote: 6.0 for players with >= 45 minutes
 * - Base vote: 5.5 for players with 1-44 minutes
 * - Adjustments for events (goals, assists, cards, etc.)
 * - Capped between 4.0 and 10.0
 * 
 * API Endpoints:
 * - Scoreboard: https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard
 * - Summary: https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event={id}
 */

import {
  LiveDataProvider,
  ProviderType,
  NormalizedMatchData,
  NormalizedSerieAMatch,
  NormalizedPlayerData,
  NormalizedPlayerEvent,
} from './types';
import { MatchStatus, EventType } from '@/types';
import { getAllPlayers, teams } from '@/data/teams';
import { Player } from '@/types';

interface EspnScoreboardResponse {
  events: EspnEvent[];
}

interface EspnEvent {
  id: string;
  name: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
    };
    clock?: number;
    displayClock?: string;
    period?: number;
  };
  competitions: EspnCompetition[];
}

interface EspnCompetition {
  id: string;
  venue?: { fullName: string };
  competitors: EspnCompetitor[];
}

interface EspnCompetitor {
  id: string;
  team: {
    id: string;
    name: string;
    abbreviation: string;
    displayName: string;
  };
  homeAway: 'home' | 'away';
  score?: string;
  statistics?: Array<{ name: string; value: string }>;
}

interface EspnSummaryResponse {
  boxscore?: {
    players?: EspnBoxscorePlayer[];
    teams?: EspnBoxscoreTeam[];
  };
  plays?: EspnPlay[];
  gameInfo?: {
    venue?: { fullName: string };
  };
  rosters?: EspnRoster[];
  header?: {
    competitions?: Array<{
      competitors: EspnCompetitor[];
      status: {
        type: { state: string; completed: boolean };
        clock?: number;
        displayClock?: string;
      };
    }>;
  };
}

interface EspnBoxscoreTeam {
  team: { id: string; displayName: string };
  statistics?: Array<{ name: string; displayValue: string }>;
}

interface EspnBoxscorePlayer {
  team: { id: string };
  statistics: Array<{
    names: string[];
    athletes: Array<{
      athlete: { id: string; displayName: string; shortName?: string };
      stats: string[];
      starter?: boolean;
      didNotPlay?: boolean;
      subbedIn?: boolean;
      subbedOut?: boolean;
    }>;
  }>;
}

interface EspnPlay {
  id: string;
  type: { id: string; text: string };
  clock?: { displayValue: string };
  period?: { number: number };
  participants?: Array<{
    athlete: { id: string; displayName: string };
    type?: string;
  }>;
  text?: string;
  scoringPlay?: boolean;
  shootoutPlay?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
}

interface EspnRoster {
  team: { id: string; displayName: string };
  roster?: Array<{
    athlete: { id: string; displayName: string; shortName?: string };
    position?: { abbreviation: string };
    starter?: boolean;
  }>;
}

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1';

const SERIE_A_TEAM_MAPPING: Record<string, string> = {
  'Inter Milan': 'Inter',
  'Internazionale': 'Inter',
  'AC Milan': 'Milan',
  'Juventus FC': 'Juventus',
  'AS Roma': 'Roma',
  'SS Lazio': 'Lazio',
  'SSC Napoli': 'Napoli',
  'Atalanta BC': 'Atalanta',
  'ACF Fiorentina': 'Fiorentina',
  'Bologna FC 1909': 'Bologna',
  'Bologna FC': 'Bologna',
  'Torino FC': 'Torino',
  'Udinese Calcio': 'Udinese',
  'US Sassuolo Calcio': 'Sassuolo',
  'Empoli FC': 'Empoli',
  'US Lecce': 'Lecce',
  'Cagliari Calcio': 'Cagliari',
  'Hellas Verona FC': 'Verona',
  'AC Monza': 'Monza',
  'Genoa CFC': 'Genoa',
  'Como 1907': 'Como',
  'Parma Calcio 1913': 'Parma',
  'Venezia FC': 'Venezia',
};

export class EspnProvider implements LiveDataProvider {
  readonly name = 'ESPN Provider';
  readonly type: ProviderType = 'espn';
  
  private playerAliases: Map<string, string> = new Map();
  private allPlayers: Player[] = [];

  async initialize(): Promise<void> {
    this.allPlayers = getAllPlayers();
    this.loadPlayerAliases();
  }

  private loadPlayerAliases(): void {
    this.playerAliases.clear();
    
    for (const player of this.allPlayers) {
      const normalizedName = this.normalizeName(player.name);
      this.playerAliases.set(normalizedName, player.id);
      
      const simpleName = player.name.split(' ').pop() || player.name;
      const normalizedSimple = this.normalizeName(simpleName);
      if (!this.playerAliases.has(normalizedSimple)) {
        this.playerAliases.set(normalizedSimple, player.id);
      }
    }
    
    const manualAliases: Record<string, string> = {
      'lautaro': 'psg-lautaro-martinez',
      'l. martinez': 'psg-lautaro-martinez',
      'lautaro martinez': 'psg-lautaro-martinez',
      'marcus thuram': 'sf-m.-thuram',
      'thuram': 'sf-m.-thuram',
      'm. thuram': 'sf-m.-thuram',
      'khephren thuram': 'am-k.-thuram',
      'k. thuram': 'am-k.-thuram',
      'v. milinkovic-savic': 'ym-milinkovic-savic-v.',
      'vanja milinkovic-savic': 'ym-milinkovic-savic-v.',
      'nicolas gonzalez': 'ym-nico-gonzalez',
      'nico gonzalez': 'ym-nico-gonzalez',
      'j. martinez': 'rp-josep-martinez',
      'josep martinez': 'rp-josep-martinez',
      'salvatore esposito': 'dc-s.-esposito',
      's. esposito': 'dc-s.-esposito',
      'francesco pio esposito': 'rp-f.p.-esposito',
      'f. esposito': 'rp-f.p.-esposito',
      'daniel maldini': 'st-d.-maldini',
      'd. maldini': 'st-d.-maldini',
      'stephan el shaarawy': 'rp-el-shaarawy',
      'el shaarawy': 'rp-el-shaarawy',
      'charles de ketelaere': 'psg-de-ketelaere',
      'g. ramos': 'psg-goncalo-ramos',
      'goncalo ramos': 'psg-goncalo-ramos',
      'adams': 'rp-che-adams',
      'che adams': 'rp-che-adams',
      'randal kolo muani': 'le-kolo-muani',
      'kolo muani': 'le-kolo-muani',
      'scott mctominay': 'ap-mctominay',
      'mctominay': 'ap-mctominay',
    };

    for (const [alias, playerId] of Object.entries(manualAliases)) {
      this.playerAliases.set(this.normalizeName(alias), playerId);
    }
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  private normalizeTeamName(espnName: string): string {
    return SERIE_A_TEAM_MAPPING[espnName] || espnName.replace(/ FC$| Calcio$| BC$/g, '');
  }

  async fetchLiveData(serieAMatchday: number): Promise<NormalizedMatchData> {
    const scoreboard = await this.fetchScoreboard();
    const playerData = new Map<string, NormalizedPlayerData>();
    
    for (const player of this.allPlayers) {
      playerData.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        realTeam: player.realTeam || '',
        rating: null,
        estimatedVote: null,
        minutesPlayed: 0,
        isPlaying: false,
        isSubstitutedOut: false,
        events: [],
      });
    }

    const serieAMatches: NormalizedSerieAMatch[] = [];
    let anyLive = false;

    for (const event of scoreboard.events) {
      const competition = event.competitions[0];
      if (!competition) continue;

      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) continue;

      const status = this.parseMatchStatus(event.status.type.state, event.status.type.completed);
      const minute = this.parseMinute(event.status);

      if (status === 'live' || status === 'halftime') {
        anyLive = true;
      }

      serieAMatches.push({
        matchId: event.id,
        homeTeam: this.normalizeTeamName(homeTeam.team.displayName),
        awayTeam: this.normalizeTeamName(awayTeam.team.displayName),
        homeScore: parseInt(homeTeam.score || '0', 10),
        awayScore: parseInt(awayTeam.score || '0', 10),
        minute,
        status,
        kickoffTime: event.date,
        venue: competition.venue?.fullName,
      });

      if (status === 'live' || status === 'halftime' || status === 'finished') {
        try {
          await this.fetchAndProcessSummary(event.id, playerData);
        } catch (err) {
          console.warn(`[ESPN] Failed to fetch summary for ${event.id}:`, err);
        }
      }
    }

    return {
      serieAMatches,
      playerData,
      lastUpdated: new Date(),
      isLive: anyLive,
    };
  }

  private async fetchScoreboard(): Promise<EspnScoreboardResponse> {
    const response = await fetch(`${ESPN_BASE_URL}/scoreboard`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`ESPN scoreboard fetch failed: ${response.status}`);
    }

    return response.json();
  }

  private async fetchAndProcessSummary(
    eventId: string,
    playerData: Map<string, NormalizedPlayerData>
  ): Promise<void> {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${eventId}`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      throw new Error(`ESPN summary fetch failed: ${response.status}`);
    }

    const summary: EspnSummaryResponse = await response.json();
    
    this.processBoxscore(summary, playerData);
    this.processPlays(summary, playerData);
  }

  private processBoxscore(
    summary: EspnSummaryResponse,
    playerData: Map<string, NormalizedPlayerData>
  ): void {
    if (!summary.boxscore?.players) return;

    for (const teamPlayers of summary.boxscore.players) {
      for (const statGroup of teamPlayers.statistics) {
        const minutesIndex = statGroup.names.indexOf('MIN');
        
        for (const athlete of statGroup.athletes) {
          if (athlete.didNotPlay) continue;

          const playerId = this.matchPlayer(athlete.athlete.displayName);
          if (!playerId) continue;

          const existingData = playerData.get(playerId);
          if (!existingData) continue;

          const minutes = minutesIndex >= 0 
            ? parseInt(athlete.stats[minutesIndex] || '0', 10) 
            : 0;

          const isPlaying = !athlete.subbedOut && minutes > 0;
          const estimatedVote = this.estimateVote(minutes, existingData.events);

          playerData.set(playerId, {
            ...existingData,
            minutesPlayed: minutes,
            isPlaying,
            isSubstitutedOut: athlete.subbedOut || false,
            estimatedVote,
          });
        }
      }
    }
  }

  private processPlays(
    summary: EspnSummaryResponse,
    playerData: Map<string, NormalizedPlayerData>
  ): void {
    if (!summary.plays) return;

    for (const play of summary.plays) {
      const minute = this.parsePlayMinute(play);
      
      if (play.scoringPlay && play.participants?.length) {
        const scorer = play.participants.find(p => p.type === 'scorer');
        const assister = play.participants.find(p => p.type === 'assist');

        if (scorer) {
          const scorerId = this.matchPlayer(scorer.athlete.displayName);
          if (scorerId) {
            const eventType: EventType = play.penaltyKick 
              ? 'penalty_scored' 
              : play.ownGoal 
                ? 'own_goal' 
                : 'goal';
            
            this.addPlayerEvent(playerData, scorerId, eventType, minute, scorer.athlete.displayName);
          }
        }

        if (assister && !play.ownGoal && !play.penaltyKick) {
          const assisterId = this.matchPlayer(assister.athlete.displayName);
          if (assisterId) {
            this.addPlayerEvent(playerData, assisterId, 'assist', minute, assister.athlete.displayName);
          }
        }
      }

      if (play.yellowCard && play.participants?.length) {
        const carded = play.participants[0];
        const cardedId = this.matchPlayer(carded.athlete.displayName);
        if (cardedId) {
          this.addPlayerEvent(playerData, cardedId, 'yellow_card', minute, carded.athlete.displayName);
        }
      }

      if (play.redCard && play.participants?.length) {
        const carded = play.participants[0];
        const cardedId = this.matchPlayer(carded.athlete.displayName);
        if (cardedId) {
          this.addPlayerEvent(playerData, cardedId, 'red_card', minute, carded.athlete.displayName);
        }
      }
    }
  }

  private addPlayerEvent(
    playerData: Map<string, NormalizedPlayerData>,
    playerId: string,
    type: EventType,
    minute: number,
    playerName: string
  ): void {
    const existingData = playerData.get(playerId);
    if (!existingData) return;

    const isDuplicate = existingData.events.some(
      e => e.type === type && e.minute === minute
    );
    if (isDuplicate) return;

    const newEvent: NormalizedPlayerEvent = {
      playerId,
      playerName,
      type,
      minute,
    };

    const updatedEvents = [...existingData.events, newEvent];
    const estimatedVote = this.estimateVote(existingData.minutesPlayed, updatedEvents);

    playerData.set(playerId, {
      ...existingData,
      events: updatedEvents,
      estimatedVote,
    });
  }

  private matchPlayer(espnName: string): string | null {
    const normalized = this.normalizeName(espnName);
    
    if (this.playerAliases.has(normalized)) {
      return this.playerAliases.get(normalized)!;
    }

    const lastName = espnName.split(' ').pop() || espnName;
    const normalizedLast = this.normalizeName(lastName);
    if (this.playerAliases.has(normalizedLast)) {
      return this.playerAliases.get(normalizedLast)!;
    }

    for (const [alias, playerId] of this.playerAliases) {
      if (alias.includes(normalized) || normalized.includes(alias)) {
        return playerId;
      }
    }

    return null;
  }

  /**
   * Estimate vote heuristic (marked as 'stimato')
   * 
   * Base vote:
   * - 6.0 for >= 45 minutes
   * - 5.5 for 1-44 minutes
   * - null for 0 minutes
   * 
   * Adjustments:
   * - Goal: +1.0
   * - Penalty scored: +0.5
   * - Assist: +0.5
   * - Own goal: -1.0
   * - Penalty missed: -1.5
   * - Yellow card: -0.5
   * - Red card: -1.0
   * - Penalty saved (GK): +1.0
   * 
   * Capped: 4.0 - 10.0
   */
  private estimateVote(minutes: number, events: NormalizedPlayerEvent[]): number | null {
    if (minutes === 0) return null;

    let vote = minutes >= 45 ? 6.0 : 5.5;

    for (const event of events) {
      switch (event.type) {
        case 'goal':
          vote += 1.0;
          break;
        case 'penalty_scored':
          vote += 0.5;
          break;
        case 'assist':
          vote += 0.5;
          break;
        case 'own_goal':
          vote -= 1.0;
          break;
        case 'penalty_missed':
          vote -= 1.5;
          break;
        case 'yellow_card':
          vote -= 0.5;
          break;
        case 'red_card':
          vote -= 1.0;
          break;
        case 'penalty_saved':
          vote += 1.0;
          break;
      }
    }

    vote = Math.max(4.0, Math.min(10.0, vote));
    return Math.round(vote * 2) / 2;
  }

  private parseMatchStatus(state: string, completed: boolean): MatchStatus {
    if (completed) return 'finished';
    
    switch (state.toLowerCase()) {
      case 'pre':
        return 'scheduled';
      case 'in':
        return 'live';
      case 'post':
        return 'finished';
      default:
        return 'scheduled';
    }
  }

  private parseMinute(status: EspnEvent['status']): number {
    if (status.displayClock) {
      const match = status.displayClock.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    return status.clock ? Math.floor(status.clock / 60) : 0;
  }

  private parsePlayMinute(play: EspnPlay): number {
    if (play.clock?.displayValue) {
      const match = play.clock.displayValue.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    return 0;
  }

  dispose(): void {
    this.playerAliases.clear();
    this.allPlayers = [];
  }
}

export function createEspnProvider(): EspnProvider {
  return new EspnProvider();
}
