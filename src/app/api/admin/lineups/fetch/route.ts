/**
 * Admin Lineups Fetch API Route
 * POST /api/admin/lineups/fetch
 * 
 * Fetches lineups from FMS Revo for a given fantasy round.
 * Admin-only: requires valid admin session cookie.
 * 
 * Body: { roundNumber: number }
 * 
 * Uses FMSREVO_USERNAME and FMSREVO_PASSWORD env vars (server-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getRoundByNumber } from '@/data/calendar';

const FMSREVO_BASE_URL = 'https://bundlesliga.fmsrevo.it';
const FMSREVO_LOGIN_URL = `${FMSREVO_BASE_URL}/accedi.php`;
const FMSREVO_LINEUPS_URL = `${FMSREVO_BASE_URL}/home/statoformazioni/all_formaz.php`;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface LoginFormFields {
  action: string;
  usernameField: string;
  passwordField: string;
  extraFields: Record<string, string>;
}

async function discoverLoginForm(): Promise<LoginFormFields> {
  const response = await fetch(FMSREVO_LOGIN_URL, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch login page: ${response.status}`);
  }

  const html = await response.text();

  const formMatch = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);
  const action = formMatch ? formMatch[1] : FMSREVO_LOGIN_URL;

  let usernameField = 'username';
  let passwordField = 'password';
  const extraFields: Record<string, string> = {};

  const inputRegex = /<input[^>]*>/gi;
  let inputMatch;
  
  while ((inputMatch = inputRegex.exec(html)) !== null) {
    const inputTag = inputMatch[0];
    
    const nameMatch = inputTag.match(/name=["']([^"']+)["']/i);
    const typeMatch = inputTag.match(/type=["']([^"']+)["']/i);
    const valueMatch = inputTag.match(/value=["']([^"']*?)["']/i);
    
    if (!nameMatch) continue;
    
    const name = nameMatch[1];
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
    const value = valueMatch ? valueMatch[1] : '';

    if (type === 'text' || type === 'email') {
      if (name.toLowerCase().includes('user') || name.toLowerCase().includes('email') || name.toLowerCase().includes('login')) {
        usernameField = name;
      }
    } else if (type === 'password') {
      passwordField = name;
    } else if (type === 'hidden' && value) {
      extraFields[name] = value;
    }
  }

  return {
    action: action.startsWith('http') ? action : `${FMSREVO_BASE_URL}${action.startsWith('/') ? '' : '/'}${action}`,
    usernameField,
    passwordField,
    extraFields,
  };
}

async function loginAndGetSession(): Promise<string> {
  const username = process.env.FMSREVO_USERNAME;
  const password = process.env.FMSREVO_PASSWORD;

  if (!username || !password) {
    throw new Error('FMSREVO_USERNAME and FMSREVO_PASSWORD must be configured');
  }

  const formFields = await discoverLoginForm();

  const formData = new URLSearchParams();
  formData.append(formFields.usernameField, username);
  formData.append(formFields.passwordField, password);
  
  for (const [key, value] of Object.entries(formFields.extraFields)) {
    formData.append(key, value);
  }

  const loginResponse = await fetch(formFields.action, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': FMSREVO_LOGIN_URL,
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  const setCookieHeaders = loginResponse.headers.getSetCookie?.() || 
    (loginResponse.headers.get('set-cookie')?.split(',') || []);
  
  const cookies: string[] = [];
  for (const cookieStr of setCookieHeaders) {
    const cookiePart = cookieStr.split(';')[0];
    if (cookiePart) {
      cookies.push(cookiePart);
    }
  }

  if (cookies.length === 0) {
    const responseText = await loginResponse.text();
    if (responseText.includes('password') && responseText.includes('errat')) {
      throw new Error('Invalid FMS Revo credentials');
    }
    throw new Error('Login failed: no session cookie received');
  }

  return cookies.join('; ');
}

async function fetchLineupsPage(sessionCookie: string, serieAMatchday: number): Promise<string> {
  const url = `${FMSREVO_LINEUPS_URL}?cGio=${serieAMatchday}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Cookie': sessionCookie,
      'Referer': FMSREVO_BASE_URL,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lineups page: ${response.status}`);
  }

  const html = await response.text();

  if (html.includes('Questa pagina è accessibile solo da utenti autenticati')) {
    throw new Error('Session expired or invalid: page requires authentication');
  }

  return html;
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { roundNumber } = body;

    if (!roundNumber || typeof roundNumber !== 'number') {
      return NextResponse.json(
        { error: 'roundNumber is required' },
        { status: 400 }
      );
    }

    const round = getRoundByNumber(roundNumber);
    if (!round) {
      return NextResponse.json(
        { error: `Round ${roundNumber} not found` },
        { status: 404 }
      );
    }

    const serieAMatchday = round.serieAMatchday;

    const sessionCookie = await loginAndGetSession();
    const html = await fetchLineupsPage(sessionCookie, serieAMatchday);

    return NextResponse.json({
      success: true,
      html,
      serieAMatchday,
      roundNumber,
    });

  } catch (error) {
    console.error('[Admin Lineups Fetch] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.includes('credentials') || message.includes('password')) {
      return NextResponse.json(
        { error: 'Invalid FMS Revo credentials', details: message },
        { status: 401 }
      );
    }
    
    if (message.includes('authentication') || message.includes('Session')) {
      return NextResponse.json(
        { error: 'FMS Revo session error', details: message },
        { status: 401 }
      );
    }
    
    if (message.includes('FMSREVO_')) {
      return NextResponse.json(
        { error: 'FMS Revo not configured', details: message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch lineups', details: message },
      { status: 500 }
    );
  }
}
