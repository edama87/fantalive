/**
 * Admin Login API Route
 * POST /api/admin/login
 * 
 * Accepts password in body, returns session cookie if correct.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, createAdminSession, setAdminCookie, isAdminConfigured } from '@/lib/auth/admin';

export async function POST(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { error: 'Admin authentication not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password required' },
        { status: 400 }
      );
    }

    const isValid = await verifyAdminPassword(password);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const token = await createAdminSession();
    await setAdminCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
