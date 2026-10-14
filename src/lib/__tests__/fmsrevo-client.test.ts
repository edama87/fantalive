import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFMSRevoLineups, _testExports } from '../fmsrevo-client';

const { parseCookies, mergeCookieMaps, cookieMapToString } = _testExports;

describe('FMS Revo Client', () => {
  describe('cookie utilities', () => {
    it('parseCookies extracts name=value from Set-Cookie headers', () => {
      const headers = [
        'PHPSESSID=abc123; path=/; HttpOnly',
        'other_cookie=value456; expires=Thu, 01 Jan 2025 00:00:00 GMT',
      ];
      
      const cookies = parseCookies(headers);
      
      expect(cookies.get('PHPSESSID')).toBe('abc123');
      expect(cookies.get('other_cookie')).toBe('value456');
      expect(cookies.size).toBe(2);
    });

    it('parseCookies handles empty array', () => {
      const cookies = parseCookies([]);
      expect(cookies.size).toBe(0);
    });

    it('mergeCookieMaps combines two cookie maps', () => {
      const base = new Map([['a', '1'], ['b', '2']]);
      const additional = new Map([['b', '3'], ['c', '4']]);
      
      const merged = mergeCookieMaps(base, additional);
      
      expect(merged.get('a')).toBe('1');
      expect(merged.get('b')).toBe('3');
      expect(merged.get('c')).toBe('4');
      expect(merged.size).toBe(3);
    });

    it('cookieMapToString formats cookies for Cookie header', () => {
      const cookies = new Map([['PHPSESSID', 'abc'], ['token', 'xyz']]);
      
      const result = cookieMapToString(cookies);
      
      expect(result).toContain('PHPSESSID=abc');
      expect(result).toContain('token=xyz');
      expect(result).toContain('; ');
    });
  });

  describe('fetchFMSRevoLineups', () => {
    const originalFetch = global.fetch;
    const originalEnv = { ...process.env };

    beforeEach(() => {
      vi.resetAllMocks();
      process.env.FMSREVO_USERNAME = 'testuser';
      process.env.FMSREVO_PASSWORD = 'testpass';
    });

    afterEach(() => {
      global.fetch = originalFetch;
      process.env = originalEnv;
    });

    it('returns error when credentials not configured', async () => {
      delete process.env.FMSREVO_USERNAME;
      delete process.env.FMSREVO_PASSWORD;

      const result = await fetchFMSRevoLineups(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credenziali FMS Revo non configurate sul server');
    });

    it('returns error when initial GET fails with HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
      });

      const result = await fetchFMSRevoLineups(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sito FMS Revo non raggiungibile (HTTP 503)');
    });

    it('returns error when initial GET throws network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchFMSRevoLineups(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sito FMS Revo non raggiungibile (errore di rete)');
    });

    it('returns error when login returns KO (wrong credentials)', async () => {
      const mockHeaders = new Headers();
      mockHeaders.append('set-cookie', 'PHPSESSID=initial123; path=/');
      
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['PHPSESSID=initial123; path=/'] },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [] },
          text: () => Promise.resolve('{"esito":"KO"}'),
        });

      const result = await fetchFMSRevoLineups(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credenziali FMS Revo errate');
    });

    it('returns error when login response is not valid JSON', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['PHPSESSID=initial123'] },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [] },
          text: () => Promise.resolve('<html>Not JSON</html>'),
        });

      const result = await fetchFMSRevoLineups(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Risposta login non valida dal sito FMS Revo');
    });

    it('returns error when lineups page requires authentication', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['PHPSESSID=initial123'] },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['session=newvalue'] },
          text: () => Promise.resolve('{"esito":"OK"}'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [] },
          text: () => Promise.resolve('<html>Questa pagina è accessibile solo da utenti autenticati</html>'),
        });

      const result = await fetchFMSRevoLineups(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Login riuscito ma pagina formazioni non accessibile');
    });

    it('returns success with HTML when full flow works', async () => {
      const lineupsHtml = '<html><body><div class="formazioni">Team A: Player 1, Player 2</div></body></html>';
      
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['PHPSESSID=initial123'] },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['session=afterlogin'] },
          text: () => Promise.resolve('{"esito":"OK"}'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [] },
          text: () => Promise.resolve(lineupsHtml),
        });

      const result = await fetchFMSRevoLineups(7);

      expect(result.success).toBe(true);
      expect(result.html).toBe(lineupsHtml);
    });

    it('sends correct headers in login request', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['PHPSESSID=abc'] },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [] },
          text: () => Promise.resolve('{"esito":"KO"}'),
        });

      await fetchFMSRevoLineups(1);

      const loginCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
      const [url, options] = loginCall;
      
      expect(url).toBe('https://bundlesliga.fmsrevo.it/core_main/controller/ctrlLogin.php');
      expect(options.method).toBe('POST');
      expect(options.headers['X-Requested-With']).toBe('XMLHttpRequest');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded; charset=UTF-8');
      expect(options.headers['Cookie']).toBe('PHPSESSID=abc');
      expect(options.body).toContain('loginuser=testuser');
      expect(options.body).toContain('loginpwd=testpass');
      expect(options.body).toContain('RememberMe=on');
    });

    it('sends correct URL for lineups with matchday parameter', async () => {
      const lineupsHtml = '<html>lineups</html>';
      
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => ['PHPSESSID=abc'] },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [] },
          text: () => Promise.resolve('{"esito":"OK"}'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [] },
          text: () => Promise.resolve(lineupsHtml),
        });

      await fetchFMSRevoLineups(12);

      const lineupsCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[2];
      const [url] = lineupsCall;
      
      expect(url).toBe('https://bundlesliga.fmsrevo.it/home/statoformazioni/all_formaz.php?cGio=12');
    });
  });
});
