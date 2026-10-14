import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LiveDataProvider, NormalizedMatchData } from '../types';
import { MockProvider } from '../mock-provider';

function runProviderContractTests(
  providerName: string,
  createProvider: () => LiveDataProvider
) {
  describe(`${providerName} Contract Tests`, () => {
    let provider: LiveDataProvider;

    beforeEach(async () => {
      provider = createProvider();
      await provider.initialize();
    });

    afterEach(() => {
      provider.dispose();
    });

    describe('Basic Interface', () => {
      it('has a name', () => {
        expect(provider.name).toBeTruthy();
        expect(typeof provider.name).toBe('string');
      });

      it('has a valid type', () => {
        expect(['mock', 'espn', 'apifootball', 'fotmob', 'csv']).toContain(provider.type);
      });
    });

    describe('fetchLiveData', () => {
      it('returns NormalizedMatchData', async () => {
        const data = await provider.fetchLiveData(7);
        
        expect(data).toHaveProperty('serieAMatches');
        expect(data).toHaveProperty('playerData');
        expect(data).toHaveProperty('lastUpdated');
        expect(data).toHaveProperty('isLive');
      });

      it('returns array of Serie A matches', async () => {
        const data = await provider.fetchLiveData(7);
        
        expect(Array.isArray(data.serieAMatches)).toBe(true);
      });

      it('returns Map of player data', async () => {
        const data = await provider.fetchLiveData(7);
        
        expect(data.playerData instanceof Map).toBe(true);
      });

      it('returns Date for lastUpdated', async () => {
        const data = await provider.fetchLiveData(7);
        
        expect(data.lastUpdated instanceof Date).toBe(true);
      });

      it('returns boolean for isLive', async () => {
        const data = await provider.fetchLiveData(7);
        
        expect(typeof data.isLive).toBe('boolean');
      });
    });

    describe('Match Data Validation', () => {
      it('matches have required fields', async () => {
        const data = await provider.fetchLiveData(7);
        
        for (const match of data.serieAMatches) {
          expect(match).toHaveProperty('matchId');
          expect(match).toHaveProperty('homeTeam');
          expect(match).toHaveProperty('awayTeam');
          expect(match).toHaveProperty('homeScore');
          expect(match).toHaveProperty('awayScore');
          expect(match).toHaveProperty('minute');
          expect(match).toHaveProperty('status');
        }
      });

      it('match statuses are valid', async () => {
        const data = await provider.fetchLiveData(7);
        const validStatuses = ['scheduled', 'live', 'halftime', 'finished'];
        
        for (const match of data.serieAMatches) {
          expect(validStatuses).toContain(match.status);
        }
      });

      it('scores are non-negative integers', async () => {
        const data = await provider.fetchLiveData(7);
        
        for (const match of data.serieAMatches) {
          expect(match.homeScore).toBeGreaterThanOrEqual(0);
          expect(match.awayScore).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(match.homeScore)).toBe(true);
          expect(Number.isInteger(match.awayScore)).toBe(true);
        }
      });

      it('minutes are in valid range', async () => {
        const data = await provider.fetchLiveData(7);
        
        for (const match of data.serieAMatches) {
          expect(match.minute).toBeGreaterThanOrEqual(0);
          expect(match.minute).toBeLessThanOrEqual(120);
        }
      });
    });

    describe('Player Data Validation', () => {
      it('player data has required fields', async () => {
        const data = await provider.fetchLiveData(7);
        
        for (const [_, player] of data.playerData) {
          expect(player).toHaveProperty('playerId');
          expect(player).toHaveProperty('playerName');
          expect(player).toHaveProperty('realTeam');
          expect(player).toHaveProperty('minutesPlayed');
          expect(player).toHaveProperty('isPlaying');
          expect(player).toHaveProperty('events');
        }
      });

      it('estimated votes are null or in valid range', async () => {
        const data = await provider.fetchLiveData(7);
        
        for (const [_, player] of data.playerData) {
          if (player.estimatedVote !== null) {
            expect(player.estimatedVote).toBeGreaterThanOrEqual(4);
            expect(player.estimatedVote).toBeLessThanOrEqual(10);
          }
        }
      });

      it('minutes played are non-negative', async () => {
        const data = await provider.fetchLiveData(7);
        
        for (const [_, player] of data.playerData) {
          expect(player.minutesPlayed).toBeGreaterThanOrEqual(0);
        }
      });

      it('events have valid types', async () => {
        const data = await provider.fetchLiveData(7);
        const validTypes = [
          'goal', 'penalty_scored', 'penalty_missed', 'penalty_saved',
          'assist', 'own_goal', 'yellow_card', 'red_card',
          'substitution_in', 'substitution_out',
        ];
        
        for (const [_, player] of data.playerData) {
          for (const event of player.events) {
            expect(validTypes).toContain(event.type);
            expect(event.minute).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });

    describe('dispose', () => {
      it('can be called multiple times safely', () => {
        expect(() => {
          provider.dispose();
          provider.dispose();
          provider.dispose();
        }).not.toThrow();
      });
    });
  });
}

runProviderContractTests('MockProvider', () => new MockProvider(12345));
