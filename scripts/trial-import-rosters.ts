/**
 * Trial roster import against Supabase (service key) or local Postgres.
 *
 * Env (from .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY  → remote write
 *   DATABASE_URL                                    → local RPC via pg
 *
 * Usage:
 *   npx tsx scripts/trial-import-rosters.ts
 */

import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseRosterFromHtml,
  validateTeamRoster,
  type ParsedTeamRoster,
} from '../src/lib/fmsrevo-roster-parser';

const OUT_DIR = path.join(process.cwd(), 'uploads', 'fmsrevo');

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const i = line.indexOf('=');
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

// Must run before importing modules that capture env at load time
loadEnvLocal();

async function loadTeamsFromHtml(): Promise<ParsedTeamRoster[]> {
  const teams: ParsedTeamRoster[] = [];
  for (let id = 1; id <= 12; id++) {
    for (const name of [`idFsq${id}.html`, `idFsq${id}.raw.html`]) {
      try {
        const html = await readFile(path.join(OUT_DIR, name), 'utf8');
        const roster = parseRosterFromHtml(html, id);
        const validation = validateTeamRoster(roster);
        if (!validation.ok) {
          console.warn(
            `Skip idFsq${id} (${roster.teamName}): ${validation.issues
              .map((i) => i.message)
              .join('; ')}`
          );
          break;
        }
        teams.push(roster);
        break;
      } catch {
        // try next file
      }
    }
  }
  return teams;
}

async function importViaPg(teams: ParsedTeamRoster[]) {
  const { default: pg } = await import('pg');
  const { buildImportRostersPayload } = await import('../src/lib/roster-import');
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://fantalive:fantalive@localhost:5432/fantalive',
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT public.import_fms_rosters($1::jsonb) AS result',
      [JSON.stringify(buildImportRostersPayload(teams))]
    );
    return rows[0].result;
  } finally {
    await client.end();
  }
}

async function main() {
  const { importRostersViaRpc, readRosterDbCounts } = await import(
    '../src/lib/roster-import'
  );

  try {
    await readdir(OUT_DIR);
  } catch {
    console.error(`Nessun file in ${OUT_DIR}`);
    process.exit(1);
  }

  const teams = await loadTeamsFromHtml();
  console.log(`Squadre valide da importare: ${teams.length}`);
  for (const t of teams) {
    console.log(`  - ${t.teamName}: ${t.players.length} giocatori`);
  }

  if (teams.length === 0) {
    process.exit(1);
  }

  const useRemote = Boolean(process.env.SUPABASE_SECRET_KEY);
  const result = useRemote
    ? await importRostersViaRpc(teams)
    : await importViaPg(teams);

  console.log('\n=== Risultato import ===');
  console.log(JSON.stringify(result, null, 2));

  if (useRemote) {
    const verified = await readRosterDbCounts();
    console.log('\n=== Conteggi riletti dal DB remoto ===');
    console.log(JSON.stringify(verified, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
