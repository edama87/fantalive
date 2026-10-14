/**
 * Admin Authentication
 * 
 * Simple password-based admin auth using a cookie session.
 * Protected routes check for the admin cookie on the server side.
 * 
 * Environment: ADMIN_PASSWORD (server only, never expose)
 */

import { cookies } from 'next/headers';

const ADMIN_COOKIE_NAME = 'fantalive_admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminPassword());
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    console.warn('[Auth] ADMIN_PASSWORD not configured');
    return false;
  }
  return password === adminPassword;
}

export async function createAdminSession(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const token = Buffer.from(JSON.stringify({ admin: true, expiresAt })).toString('base64');
  return token;
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
    const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
    
    if (!sessionCookie?.value) {
      return false;
    }

    const decoded = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    
    if (!decoded.admin || !decoded.expiresAt) {
      return false;
    }

    if (Date.now() > decoded.expiresAt) {
      return false;
    }

    return true;
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
