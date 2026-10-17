import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveDataProvider, NormalizedMatchData } from '../types';
import { MockProvider } from '../mock-provider';
import { EspnProvider } from '../espn-provider';
import catalogPlayers from './fixtures/espn-catalog-players.json';
import scoreboard16 from './fixtures/espn-scoreboard-20261016.json';
import scoreboard17 from './fixtures/espn-scoreboard-20261017.json';
import summaryFroSas from './fixtures/espn-summary-fro-sas.json';
import type { FantacalcioCatalogPlayer } from '@/lib/fantacalcio-it';

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
        expect(['mock', 'espn', 'apifootball', 'fotmob', 'csv', 'fantacalcio-it']).toContain(provider.type);
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

describe('EspnProvider with real ESPN fixtures (giornata 7, 16-17 ottobre)', () => {
  const catalog = { players: catalogPlayers as FantacalcioCatalogPlayer[], aliases: [] };
  let fetchMock: ReturnType<typeof vi.fn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  function jsonResponse(body: unknown) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
  }

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/scoreboard') && url.includes('dates=20261016')) return jsonResponse(scoreboard16);
      if (url.includes('/scoreboard') && url.includes('dates=20261017')) return jsonResponse(scoreboard17);
      if (url.includes('/summary') && url.includes('event=401874959')) return jsonResponse(summaryFroSas);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  async function fetchRound() {
    const provider = new EspnProvider({ catalog, fetchImpl: fetchMock as unknown as typeof fetch });
    await provider.initialize();
    const data = await provider.fetchLiveData(7, { dates: ['20261016', '20261017'] });
    provider.dispose();
    return data;
  }

  it('fetches the scoreboard for every date and returns all fixtures with status and kickoff', async () => {
    const data = await fetchRound();
    const scoreboardCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/scoreboard'));
    expect(scoreboardCalls).toHaveLength(2);
    expect(data.serieAMatches.map((m) => m.matchId)).toEqual(['401874959', '401874760', '401874953', '401874935']);
    const froSas = data.serieAMatches[0];
    expect(froSas).toMatchObject({ homeTeam: 'Frosinone', awayTeam: 'Sassuolo', homeScore: 4, awayScore: 2, status: 'finished' });
    expect(data.serieAMatches[1]).toMatchObject({ homeTeam: 'Venezia', awayTeam: 'Napoli', status: 'scheduled' });
    expect(data.serieAMatches.every((m) => typeof m.kickoffTime === 'string')).toBe(true);
    expect(data.isLive).toBe(false);
  });

  it('only fetches summaries of matches that have started', async () => {
    await fetchRound();
    const summaryCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/summary'));
    expect(summaryCalls).toHaveLength(1);
    expect(summaryCalls[0]).toContain('event=401874959');
  });

  it('maps rosters and keyEvents to DB players (scorers, assists, GK conceded, cards, minutes)', async () => {
    const data = await fetchRound();
    const get = (id: string) => data.playerData.get(id);
    const types = (id: string) => get(id)?.events.map((e) => e.type);

    expect(data.playerData.size).toBe(19);
    expect(types('raimondo-antonio-a')).toEqual(['goal', 'goal', 'goal']);
    expect(get('raimondo-antonio-a')?.minutesPlayed).toBe(90);
    // "Giacomo Calò" (ESPN) -> "CALO' Giacomo" (DB), sostituito all'80'
    expect(types('calo-giacomo-c')).toEqual(['goal']);
    expect(get('calo-giacomo-c')?.minutesPlayed).toBe(80);
    expect(types('bakola-darryl-c')).toEqual(['assist']);
    expect(types('berardi-domenico-a')).toEqual(['goal']);
    expect(types('bowie-kieron-tom-a')).toEqual(['yellow_card']);
    expect(get('bowie-kieron-tom-a')?.minutesPlayed).toBe(32);

    const palmisani = get('palmisani-lorenzo-p')!;
    expect(palmisani.events.filter((e) => e.type === 'goal' && e.relatedPlayerId === 'opponent')).toHaveLength(2);
    const muric = get('muric-arijanet-anan-p')!;
    expect(muric.events.filter((e) => e.type === 'goal' && e.relatedPlayerId === 'opponent')).toHaveLength(4);
  });

  it('reports and logs players that are not in the DB', async () => {
    const data = await fetchRound();
    expect(data.unmatchedPlayers).toHaveLength(13);
    expect(data.unmatchedPlayers).toContainEqual({ name: 'Ilario Monterisi', team: 'FRO' });
    expect(infoSpy).toHaveBeenCalled();
    expect(String(infoSpy.mock.calls[0][0])).toContain('non abbinati');
  });
});
