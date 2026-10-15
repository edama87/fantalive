/**
 * Supabase Client Configuration
 * 
 * Two clients:
 * - publicClient: Uses publishable key, for public reads (RLS enforced)
 * - serverClient: Uses secret key, for server-side writes (bypasses RLS)
 * 
 * Environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (public)
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Publishable anon key (public)
 * - SUPABASE_SECRET_KEY: Service role key (server only, never expose)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let publicClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

function ensureNodeWebSocket(): void {
  if (typeof globalThis.WebSocket === 'undefined') {
    // Node < 22: supabase-js realtime needs a WebSocket implementation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WS = require('ws');
    (globalThis as { WebSocket?: typeof WS }).WebSocket = WS;
  }
}

function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getPublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

function getSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY;
}

export function getPublicClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const supabasePublishableKey = getPublishableKey();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );
  }

  if (!publicClient) {
    ensureNodeWebSocket();
    publicClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return publicClient;
}

export function getServerClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const supabaseSecretKey = getSecretKey();
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      'Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY'
    );
  }

  if (!serverClient) {
    ensureNodeWebSocket();
    serverClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getPublishableKey());
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSecretKey());
}

export { type SupabaseClient };
