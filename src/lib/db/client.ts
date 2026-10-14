/**
 * Database Client Factory
 * 
 * Returns either a Supabase client or a local mock client based on
 * environment configuration. The local client uses in-memory storage
 * and localStorage for persistence.
 * 
 * Environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Supabase publishable key
 * - NEXT_PUBLIC_USE_LOCAL_DB: Set to 'true' to force local client
 */

import { createLocalClient, LocalDbClient } from './local-client';
import { createSupabaseDbClient, SupabaseDbClient } from './supabase-client';
import { isSupabaseConfigured } from './supabase';

export type DbClient = LocalDbClient | SupabaseDbClient;

let client: DbClient | null = null;

export function getDbClient(): DbClient {
  if (client) return client;

  const forceLocal = process.env.NEXT_PUBLIC_USE_LOCAL_DB === 'true';
  const supabaseReady = isSupabaseConfigured();

  if (forceLocal || !supabaseReady) {
    console.log('[DB] Using local mock database');
    client = createLocalClient();
  } else {
    console.log('[DB] Using Supabase');
    client = createSupabaseDbClient();
  }

  return client;
}

export function resetDbClient(): void {
  client = null;
}

export { createLocalClient } from './local-client';
export { createSupabaseDbClient } from './supabase-client';
