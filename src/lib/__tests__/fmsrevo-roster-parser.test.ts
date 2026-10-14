import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseRosterFromHtml,
  validateTeamRoster,
  EXPECTED_ROSTER_TOTAL,
  EXPECTED_ROSTER_ROLES,
} from '../fmsrevo-roster-parser';

const fixturePath = path.join(
  __dirname,
  'fixtures',
  'idFsq1-roster.html'
);

describe('FMS Revo roster parser', () => {
  const html = readFileSync(fixturePath, 'utf8');

  it('parses team name and 25 players from real ultime_notizie HTML', () => {
    const roster = parseRosterFromHtml(html, 1);

    expect(roster.teamName).toBe('Yellow Mustard');
    expect(roster.players).toHaveLength(EXPECTED_ROSTER_TOTAL);
    expect(roster.players[0]).toMatchObject({
      name: 'MERET Alex',
      role: 'P',
      realTeam: 'NAP',
    });
    expect(roster.players.some((p) => p.name.includes('SVILAR'))).toBe(true);
    expect(roster.players.some((p) => p.name.includes('Ronaldo'))).toBe(false);
  });

  it('validates exact 3/8/8/6 role split', () => {
    const roster = parseRosterFromHtml(html, 1);
    const validation = validateTeamRoster(roster);

    expect(validation.actualRoles).toEqual(EXPECTED_ROSTER_ROLES);
    expect(validation.ok).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('does not treat CSS class junk as players', () => {
    const junk = `
      <html><body>
        <style>.top-flop__role--keeper{color:blue}.P-foo-BAR{}.A-x-Y{}</style>
        <div class="top-player__info"><div class="top-player__name">Cristiano Ronaldo - Real Madrid</div></div>
      </body></html>
    `;
    const roster = parseRosterFromHtml(junk, 1);
    expect(roster.players).toHaveLength(0);
  });

  it('marks incomplete roster as invalid', () => {
    const roster = parseRosterFromHtml(html, 1);
    roster.players = roster.players.slice(0, 20);
    const validation = validateTeamRoster(roster);
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((i) => i.code === 'wrong_total')).toBe(true);
  });
});
