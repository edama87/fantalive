/**
 * Admin Logout API Route
 * POST /api/admin/logout
 * 
 * Clears admin session cookie.
 */

import { NextResponse } from 'next/server';
import { clearAdminCookie } from '@/lib/auth/admin';

export async function POST() {
  try {
    await clearAdminCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Logout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
