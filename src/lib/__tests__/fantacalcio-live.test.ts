import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseFantacalcioVotes } from '@/lib/fantacalcio-it';
import { decodeLiveMessage, liveMatchToVotePlayers, mergeLiveNoGradeFlags, parseFantacalcioBridge, resolveMatchVotes } from '@/lib/fantacalcio-live';
import type { FantacalcioVotePlayer } from '@/lib/fantacalcio-it';

const dir = join(__dirname, 'fixtures');
const html = readFileSync(join(dir, 'fantacalcio-voti-live-torino-monza.html'), 'utf8');
const dat = new Uint8Array(readFileSync(join(dir, 'fantacalcio-live-8.dat')));

describe('fantacalcio.it voti live (Torino-Monza, 8ª, 54′ 1-1)', () => {
  it("la pagina /voti in partita non contiene voti nell'HTML", () => {
    expect(parseFantacalcioVotes(html).some((p) => p.vote != null)).toBe(false);
    expect(parseFantacalcioBridge(html)).toEqual({ seasonId: 21, matchweek: 8, matchId: 18033 });
  });

  it('decodifica il file live protobuf', () => {
    const t = decodeLiveMessage(dat).find((m) => m.matchId === 18033)!;
    expect(t).toMatchObject({ teamHome: 'Torino', teamAway: 'Monza', goalHome: 1, goalAway: 1 });
    const players = liveMatchToVotePlayers(t, 'Torino', 'Monza');
    const by = (n: string) => players.find((p) => p.name.startsWith(n))!;
    expect(by('Fitz-Jim')).toMatchObject({ team: 'Torino', role: 'C', vote: 7, fantaVote: 10 });
    expect(by('Simeone').bonuses.map((b) => b.type)).toEqual(['assist']);
    expect(by('Comuzzo').vote).toBe(5);
    expect(by('Varela')).toMatchObject({ team: 'Monza', vote: 7 });
    expect(by('Mota').vote).toBe(6);
    expect(by('Perri').fantaVote).toBe(5); // 6 - 1 gol subito
    expect(players.filter((p) => p.vote != null)).toHaveLength(23);
  });

  it('resolveMatchVotes usa il file live quando l’HTML è vuoto (firma + download)', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).endsWith('/api/v1/SignedUri')) {
        const key = 'https://api.fantacalcio.it/v1/st/21/matches/live/8.dat';
        return new Response(JSON.stringify({ [key]: { resources: [{ signedUri: key + '?sig=x' }] } }));
      }
      return new Response(dat);
    }) as unknown as typeof fetch;
    const r = await resolveMatchVotes(html, parseFantacalcioVotes(html), { homeTeam: 'Torino', awayTeam: 'Monza', matchId: '18033' }, fetchImpl);
    expect(r.source).toBe('live');
    expect(r.players.filter((p) => p.vote != null)).toHaveLength(23);
    expect(calls).toEqual(['https://www.fantacalcio.it/api/v1/SignedUri', 'https://api.fantacalcio.it/v1/st/21/matches/live/8.dat?sig=x']);
  });
});

const vp = (over: Partial<FantacalcioVotePlayer>): FantacalcioVotePlayer => ({
  name: 'X', role: 'D', team: 'Roma', vote: null, hiddenGrade: null, fantaVote: null, bonuses: [], substitutedOut: false, sourcePlayerId: null, ...over,
});

describe('s.v. dei subentrati a partita finita (HTML + file live)', () => {
  it('mergeLiveNoGradeFlags porta s.v. e ingresso sui senza voto, per id o per nome', () => {
    const html = [
      vp({ name: 'Ghilardi', sourcePlayerId: '6631' }),
      vp({ name: 'Esposito Se.', team: 'Sassuolo', role: 'A' }),
      vp({ name: 'Mancini', vote: 6.5 }),
      vp({ name: 'Panchina' }),
    ];
    const live = [
      vp({ name: 'Ghilardi', sourcePlayerId: '6631', noGrade: true, substitution: { in: 88 } }),
      vp({ name: 'Esposito Se.', team: 'Sassuolo', role: 'A', sourcePlayerId: '4463', noGrade: true }),
      vp({ name: 'Mancini', vote: 6.5 }),
      vp({ name: 'Panchina' }),
    ];
    const out = mergeLiveNoGradeFlags(html, live);
    expect(out[0]).toMatchObject({ noGrade: true, substitution: { in: 88 }, vote: null });
    expect(out[1]).toMatchObject({ noGrade: true, vote: null });
    expect(out[2]).toBe(html[2]);
    expect(out[3]).toBe(html[3]);
  });

  it('resolveMatchVotes a partita finita resta su HTML e legge il file live per i senza voto', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).endsWith('/api/v1/SignedUri')) {
        const key = 'https://api.fantacalcio.it/v1/st/21/matches/live/8.dat';
        return new Response(JSON.stringify({ [key]: { resources: [{ signedUri: key + '?sig=x' }] } }));
      }
      return new Response(dat);
    }) as unknown as typeof fetch;
    const parsed = [vp({ name: 'Fitz-Jim', team: 'Torino', vote: 7 }), vp({ name: 'Ignoto', team: 'Torino' })];
    const r = await resolveMatchVotes(html, parsed, { homeTeam: 'Torino', awayTeam: 'Monza', matchId: '18033' }, fetchImpl);
    expect(r.source).toBe('html');
    expect(r.players).toEqual(parsed);
    expect(calls).toHaveLength(2);
  });

  it('se il file live non si scarica restano i dati HTML', async () => {
    const fetchImpl = (async () => { throw new Error('rete'); }) as unknown as typeof fetch;
    const parsed = [vp({ name: 'A', vote: 6 }), vp({ name: 'B' })];
    const r = await resolveMatchVotes(html, parsed, { homeTeam: 'Torino', awayTeam: 'Monza', matchId: '18033' }, fetchImpl);
    expect(r).toEqual({ players: parsed, source: 'html' });
  });
});
