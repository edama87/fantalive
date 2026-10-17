/**
 * Admin Authentication
 * 
 * Simple password-based admin auth using a cookie session.
 * Protected routes check for the admin cookie on the server side.
 * 
 * Environment: ADMIN_PASSWORD (server only, never expose)
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const ADMIN_COOKIE_NAME = 'fantalive_admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminPassword());
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Chiave di firma della sessione: ADMIN_SESSION_SECRET se presente, altrimenti
 * derivata da ADMIN_PASSWORD (cambiare la password invalida le sessioni).
 */
function sessionKey(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET || getAdminPassword();
  return secret ? `fantalive-admin-session:${secret}` : null;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    console.warn('[Auth] ADMIN_PASSWORD not configured');
    return false;
  }
  return safeEqual(password, adminPassword);
}

/** Token firmato (HMAC-SHA256): payload.firma. Un token non firmato non vale. */
export async function createAdminSession(now: number = Date.now()): Promise<string> {
  const key = sessionKey();
  if (!key) throw new Error('ADMIN_PASSWORD not configured');
  const payload = Buffer.from(JSON.stringify({ admin: true, expiresAt: now + SESSION_DURATION_MS })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

/** Verifica firma e scadenza di un token di sessione admin. */
export function verifyAdminSessionToken(token: string | undefined | null, now: number = Date.now()): boolean {
  const key = sessionKey();
  if (!key || !token) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return false;
  if (!safeEqual(signature, sign(payload, key))) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded?.admin === true && typeof decoded.expiresAt === 'number' && now <= decoded.expiresAt;
  } catch {
    return false;
  }
}

export async function setAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  });
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  } catch {
    return false;
  }
}

export async function requireAdmin(): Promise<void> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    throw new Error('Admin authentication required');
  }
}
