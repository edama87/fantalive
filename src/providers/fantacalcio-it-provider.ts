/**
 * Fantacalcio.it live provider.
 *
 * Same LiveDataProvider contract as mock and ESPN.
 * Select it with LIVE_PROVIDER=fantacalcio-it.
 */

import type { EventType } from '@/types';
import {
  LiveDataProvider,
  type NormalizedMatchData,
  type NormalizedPlayerData,
  type NormalizedPlayerEvent,
  type ProviderType,
} from '@/providers/types';
import {
  bonusToEventType,
  matchFantacalcioPlayer,
  type FantacalcioAlias,
  type FantacalcioCatalogPlayer,
  type FantacalcioMatchContext,
} from '@/lib/fantacalcio-it';
import {
  loadFantacalcioCatalog,
  scrapeFantacalcioMatchday,
} from '@/lib/fantacalcio-it-client';

export interface FantacalcioItProviderOptions {
  fetchImpl?: typeof fetch;
  players?: FantacalcioCatalogPlayer[];
  aliases?: FantacalcioAlias[];
}

export class FantacalcioItProvider implements LiveDataProvider {
  readonly name = 'Fantacalcio.it';
  readonly type: ProviderType = 'fantacalcio-it';

  private players: FantacalcioCatalogPlayer[] = [];
  private aliases: FantacalcioAlias[] = [];
  private readonly fetchImpl: typeof fetch;

  constructor(options: FantacalcioItProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (options.players) {
      this.players = options.players;
      this.aliases = options.aliases ?? [];
    }
  }

  async initialize(): Promise<void> {
    if (this.players.length > 0) return;
    const catalog = await loadFantacalcioCatalog();
    this.players = catalog.players;
    this.aliases = catalog.aliases;
  }

  matchPlayer(name: string, context?: FantacalcioMatchContext): string | null {
    return matchFantacalcioPlayer(name, this.players, this.aliases, context)?.playerId ?? null;
  }

  async fetchLiveData(serieAMatchday: number): Promise<NormalizedMatchData> {
    const matchday = await scrapeFantacalcioMatchday(
      serieAMatchday,
      { players: this.players, aliases: this.aliases },
      this.fetchImpl
    );

    const playerData = new Map<string, NormalizedPlayerData>();
    const matchStatus = new Map(matchday.matches.map((match) => [match.matchId, match.status]));

    for (const player of matchday.players) {
      if (!player.playerId || player.vote == null) continue;
      const status = matchStatus.get(player.matchId) ?? 'scheduled';
      const events: NormalizedPlayerEvent[] = [];
      for (const bonus of player.bonuses) {
        const type = bonusToEventType(bonus.type);
        if (!type) continue;
        for (let index = 0; index < bonus.count; index += 1) {
          events.push({
            playerId: player.playerId,
            playerName: player.matchedName ?? player.name,
            type: type as EventType,
            minute: bonus.minute ?? 0,
          });
        }
      }

      playerData.set(player.playerId, {
        playerId: player.playerId,
        playerName: player.matchedName ?? player.name,
        realTeam: player.team,
        rating: player.vote,
        estimatedVote: player.fantaVote,
        minutesPlayed: player.substitutedOut ? 45 : 90,
        isPlaying: status === 'live' && !player.substitutedOut,
        isSubstitutedOut: player.substitutedOut,
        events,
      });
    }

    return {
      serieAMatches: matchday.matches.map((match) => ({
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        minute: match.minute,
        status: match.status,
        kickoffTime: match.kickoffTime,
        venue: match.venue,
      })),
      playerData,
      lastUpdated: new Date(),
      isLive: matchday.matches.some((match) => match.status === 'live' || match.status === 'halftime'),
    };
  }

  dispose(): void {}
}

export function createFantacalcioItProvider(
  options?: FantacalcioItProviderOptions
): FantacalcioItProvider {
  return new FantacalcioItProvider(options);
}
