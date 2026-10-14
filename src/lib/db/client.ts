/**
 * Database Client Factory
 * 
 * Returns either a Supabase client or a local mock client based on
 * environment configuration. The local client uses in-memory storage
 * and localStorage for persistence.
 * 
 * Environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key
 * - NEXT_PUBLIC_USE_LOCAL_DB: Set to 'true' to force local client
 */

import { createLocalClient, LocalDbClient } from './local-client';

export type DbClient = LocalDbClient;

let client: DbClient | null = null;

export function getDbClient(): DbClient {
  if (client) return client;

  const useLocal = 
    process.env.NEXT_PUBLIC_USE_LOCAL_DB === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (useLocal) {
    console.log('[DB] Using local mock database');
    client = createLocalClient();
  } else {
    console.log('[DB] Supabase client not implemented, using local');
    client = createLocalClient();
  }

  return client;
}

export function resetDbClient(): void {
  client = null;
}
