import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { hasMyTeamChoice, MY_TEAM_COOKIE, parseMyTeam, readCookie, safeNextPath } from '@/lib/my-team';
import { proxy } from '@/proxy';

describe('my team preference', () => {
  it('parses the stored choice', () => {
    expect(parseMyTeam('ap')).toBe('ap');
    expect(parseMyTeam('none')).toBeNull();
    expect(parseMyTeam(undefined)).toBeNull();
    expect(parseMyTeam('<script>')).toBeNull();
    expect(parseMyTeam('xx', ['ap', 'dc'])).toBeNull();
    expect(hasMyTeamChoice('none')).toBe(true);
    expect(hasMyTeamChoice('dc')).toBe(true);
    expect(hasMyTeamChoice(undefined)).toBe(false);
  });

  it('reads the cookie header', () => {
    expect(readCookie(`a=1; ${MY_TEAM_COOKIE}=dc; b=2`, MY_TEAM_COOKIE)).toBe('dc');
    expect(readCookie('a=1', MY_TEAM_COOKIE)).toBeNull();
  });

  it('only returns to internal paths', () => {
    expect(safeNextPath('/sfida/1/dc-ap')).toBe('/sfida/1/dc-ap');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/benvenuto')).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
  });
});

describe('first-visit redirect (proxy)', () => {
  const req = (path: string, cookie?: string) =>
    new NextRequest(new URL(path, 'https://fantalive.test'), { headers: cookie ? { cookie } : {} });

  it('sends first-time visitors to the landing page and back', () => {
    const res = proxy(req('/sfida/1/dc-ap'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://fantalive.test/benvenuto?next=%2Fsfida%2F1%2Fdc-ap');
    expect(proxy(req('/')).headers.get('location')).toBe('https://fantalive.test/benvenuto');
  });

  it('lets through visitors who chose a team or skipped', () => {
    expect(proxy(req('/', `${MY_TEAM_COOKIE}=dc`)).headers.get('location')).toBeNull();
    expect(proxy(req('/classifica', `${MY_TEAM_COOKIE}=none`)).headers.get('location')).toBeNull();
  });
});
