import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

import { createAdminSession, verifyAdminPassword, verifyAdminSessionToken } from '@/lib/auth/admin';

describe('admin session token', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test-password';
    delete process.env.ADMIN_SESSION_SECRET;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('accepts a token it signed, until it expires', async () => {
    const now = 1_800_000_000_000;
    const token = await createAdminSession(now);
    expect(verifyAdminSessionToken(token, now + 1000)).toBe(true);
    expect(verifyAdminSessionToken(token, now + 25 * 60 * 60 * 1000)).toBe(false);
  });

  it('rejects the old forgeable unsigned base64 cookie and tampered tokens', async () => {
    const forged = Buffer.from(JSON.stringify({ admin: true, expiresAt: 9_999_999_999_999 })).toString('base64');
    expect(verifyAdminSessionToken(forged)).toBe(false);
    const token = await createAdminSession();
    const [, sig] = token.split('.');
    const longer = Buffer.from(JSON.stringify({ admin: true, expiresAt: 9_999_999_999_999 })).toString('base64url');
    expect(verifyAdminSessionToken(`${longer}.${sig}`)).toBe(false);
    expect(verifyAdminSessionToken(`${token}x`)).toBe(false);
    expect(verifyAdminSessionToken('')).toBe(false);
  });

  it('invalidates sessions when the password changes', async () => {
    const token = await createAdminSession();
    process.env.ADMIN_PASSWORD = 'another';
    expect(verifyAdminSessionToken(token)).toBe(false);
  });

  it('checks the password', async () => {
    expect(await verifyAdminPassword('test-password')).toBe(true);
    expect(await verifyAdminPassword('test-passwor')).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(await verifyAdminPassword('')).toBe(false);
    expect(verifyAdminSessionToken('a.b')).toBe(false);
  });
});
