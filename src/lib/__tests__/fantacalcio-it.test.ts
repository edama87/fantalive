import { readFileSync } from 'fs';
import { describe, expect, it, vi } from 'vitest';
import {
  fantavotoFromVote,
  matchFantacalcioPlayer,
  parseFantacalcioCalendar,
  parseFantacalcioVotes,
  resolveVisibleVote,
  type FantacalcioCatalogPlayer,
} from '../fantacalcio-it';
import { FantacalcioItProvider } from '@/providers/fantacalcio-it-provider';

const calendarHtml = readFileSync(
  'src/lib/__tests__/fixtures/fantacalcio-calendario-7.html',
  'utf8'
);
const votesHtml = readFileSync(
  'src/lib/__tests__/fixtures/fantacalcio-voti-inter-parma.html',
  'utf8'
);

const catalog: FantacalcioCatalogPlayer[] = [
  { id: 'martinez-josep-p', name: 'MARTINEZ Josep', role: 'P', realTeam: 'INT' },
  { id: 'martinez-lautaro-javier-a', name: 'MARTINEZ Lautaro Javier', role: 'A', realTeam: 'INT' },
  { id: 'thuram-marcus', name: 'THURAM Marcus Lilian', role: 'A', realTeam: 'INT' },
  { id: 'thuram-khephren', name: 'THURAM Khephren', role: 'C', realTeam: 'JUV' },
  { id: 'toure', name: "TOURE' El Bilal", role: 'A', realTeam: 'PAR' },
  { id: 'carlos', name: 'CARLOS AUGUSTO Zopolato Neves', role: 'D', realTeam: 'INT' },
  { id: 'calha', name: 'CALHANOGLU Hakan', role: 'C', realTeam: 'INT' },
  { id: 'sucic', name: 'SUCIC Petar', role: 'C', realTeam: 'INT' },
  { id: 'corvi', name: 'CORVI Edoardo', role: 'P', realTeam: 'PAR' },
  { id: 'dimarco', name: 'DIMARCO Federico', role: 'D', realTeam: 'INT' },
  { id: 'mkhi', name: 'MKHITARYAN Henrikh', role: 'C', realTeam: 'INT' },
  { id: 'pavard-alias', name: 'ALTRO', role: 'D', realTeam: 'INT' },
  { id: 'should-not-win', name: 'PAVARD Benjamin', role: 'D', realTeam: 'INT' },
  { id: 'esposito', name: 'ESPOSITO Francesco Pio', role: 'A', realTeam: 'INT' },
];

describe('fantacalcio.it HTML', () => {
  it('keeps the calendar order and points each match at /voti', () => {
    const matches = parseFantacalcioCalendar(calendarHtml);
    expect(matches.map((match) => match.matchId)).toEqual([
      '18017',
      '18024',
      '18015',
      '18022',
      '18023',
      '18016',
      '18019',
      '18018',
      '18020',
      '18021',
    ]);
    expect(matches[0]).toMatchObject({
      homeTeam: 'Frosinone',
      awayTeam: 'Sassuolo',
      homeScore: 4,
      awayScore: 2,
      status: 'finished',
      votesUrl: 'https://www.fantacalcio.it/serie-a/calendario/7/2026-27/frosinone-sassuolo/18017/voti',
    });
    expect(matches.every((match) => match.votesUrl.endsWith('/voti'))).toBe(true);
  });

  it('reads the visible pure vote and treats the other number as a decoy', () => {
    expect(resolveVisibleVote('6,5', '9,5')).toEqual({ vote: 6.5, hiddenGrade: 9.5 });
    expect(resolveVisibleVote('-6', '6')).toEqual({ vote: 6, hiddenGrade: 6 });
    expect(resolveVisibleVote('6', '-')).toEqual({ vote: 6, hiddenGrade: null });

    const players = parseFantacalcioVotes(votesHtml);
    const dimarco = players.find((player) => player.name === 'Dimarco');
    const sucic = players.find((player) => player.name === 'Sucic P.');
    const calhanoglu = players.find((player) => player.name === 'Calhanoglu');
    const corvi = players.find((player) => player.name === 'Corvi');
    const mkhitaryan = players.find((player) => player.name === 'Mkhitaryan');

    expect(players.some((player) => player.name === '')).toBe(false);
    expect(dimarco).toMatchObject({ vote: 6.5, hiddenGrade: 9.5, fantaVote: 6.5, bonuses: [] });
    expect(sucic?.vote).toBe(7);
    expect(sucic?.bonuses).toEqual([
      expect.objectContaining({ type: 'goal', count: 1 }),
    ]);
    expect(sucic?.fantaVote).toBe(10);
    expect(calhanoglu?.vote).toBe(7);
    expect(calhanoglu?.fantaVote).toBe(10);
    expect(corvi?.bonuses.find((bonus) => bonus.type === 'goal_conceded')?.count).toBe(3);
    expect(corvi?.fantaVote).toBe(2.5);
    expect(mkhitaryan?.fantaVote).toBe(7.5);
    expect(fantavotoFromVote(6, [{ type: 'goal', label: 'Gol segnato', count: 2, minute: 12 }])).toBe(12);
  });

  it('matches aliases, accents, initials and surname/name order', () => {
    const players = parseFantacalcioVotes(votesHtml);
    const match = (name: string, team: string, role: 'P' | 'D' | 'C' | 'A') =>
      matchFantacalcioPlayer(name, catalog, [
        { alias: 'Pavard', playerId: 'pavard-alias', source: 'espn' },
        { alias: 'Pavard', playerId: 'should-not-win', source: 'fantacalcio' },
      ], { realTeam: team, role })?.playerId;

    expect(match('Martinez L.', 'Inter', 'A')).toBe('martinez-lautaro-javier-a');
    expect(match('Martinez Jo.', 'Inter', 'P')).toBe('martinez-josep-p');
    expect(match('Thuram', 'Inter', 'A')).toBe('thuram-marcus');
    expect(match("Tourè E.", 'Parma', 'A')).toBe('toure');
    expect(match('Carlos Augusto', 'Inter', 'D')).toBe('carlos');
    expect(match('Esposito F.P.', 'Inter', 'A')).toBe('esposito');
    expect(match('Pavard', 'Inter', 'D')).toBe('should-not-win');

    const matchedIds = players
      .map((player) => matchFantacalcioPlayer(player.name, catalog, [
        { alias: 'Pavard', playerId: 'pavard-alias', source: 'fantacalcio' },
      ], { realTeam: player.team, role: player.role })?.playerId)
      .filter(Boolean);
    expect(matchedIds).toContain('martinez-lautaro-javier-a');
    expect(matchedIds).toContain('martinez-josep-p');
    expect(matchedIds).not.toContain('thuram-khephren');
  });
});

describe('FantacalcioItProvider', () => {
  it('returns matches in fantacalcio.it order', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const body = String(url).includes('/voti') ? votesHtml : calendarHtml;
      return { ok: true, text: async () => body, status: 200 };
    });
    const provider = new FantacalcioItProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      players: catalog,
      aliases: [{ alias: 'Pavard', playerId: 'pavard-alias', source: 'fantacalcio' }],
    });
    await provider.initialize();
    const data = await provider.fetchLiveData(7);

    expect(provider.type).toBe('fantacalcio-it');
    expect(data.serieAMatches.map((match) => match.matchId)[0]).toBe('18017');
    expect(data.serieAMatches).toHaveLength(10);
    expect(data.playerData.get('martinez-lautaro-javier-a')?.rating).toBe(6);
    expect(data.playerData.get('sucic')?.estimatedVote).toBe(10);
    expect(data.playerData.get('pavard-alias')?.playerName).toBe('ALTRO');
    expect(provider.matchPlayer('Thuram', { realTeam: 'Inter', role: 'A' })).toBe('thuram-marcus');
    provider.dispose();
    provider.dispose();
  });
});
