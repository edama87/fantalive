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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

let publicClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function getPublicClient(): SupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );
  }

  if (!publicClient) {
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
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      'Missing Supabase server configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY'
    );
  }

  if (!serverClient) {
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
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseSecretKey);
}

export { type SupabaseClient };
