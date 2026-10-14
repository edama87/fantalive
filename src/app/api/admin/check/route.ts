/**
 * Admin Auth Check API Route
 * GET /api/admin/check
 * 
 * Returns whether the current session is authenticated as admin.
 */

import { NextResponse } from 'next/server';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/auth/admin';

export async function GET() {
  try {
    const configured = isAdminConfigured();
    const authenticated = await isAdminAuthenticated();

    return NextResponse.json({
      configured,
      authenticated,
    });
  } catch (error) {
    console.error('[Admin Check] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
