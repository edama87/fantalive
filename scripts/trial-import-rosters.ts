/**
 * Trial roster import against a Postgres DB (local or Supabase).
 *
 * Env:
 *   DATABASE_URL — postgres connection string
 *   or SUPABASE_SECRET_KEY + NEXT_PUBLIC_SUPABASE_URL for remote RPC
 *
 * Usage:
 *   DATABASE_URL=postgres://fantalive:fantalive@localhost:5432/fantalive \
 *     npx tsx scripts/trial-import-rosters.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseRosterFromHtml,
  validateTeamRoster,
  type ParsedTeamRoster,
} from '../src/lib/fmsrevo-roster-parser';
import { buildImportRostersPayload } from '../src/lib/roster-import';

const OUT_DIR = path.join(process.cwd(), 'uploads', 'fmsrevo');

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

async function importViaPg(payload: unknown) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://fantalive:fantalive@localhost:5432/fantalive',
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT public.import_fms_rosters($1::jsonb) AS result',
      [JSON.stringify(payload)]
    );
    return rows[0].result;
  } finally {
    await client.end();
  }
}

async function importViaSupabaseRpc(payload: unknown) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY richiesti');
  }
  const res = await fetch(`${url}/rest/v1/rpc/import_fms_rosters`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function main() {
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

  const payload = buildImportRostersPayload(teams);
  const useRemote = Boolean(process.env.SUPABASE_SECRET_KEY);
  const result = useRemote
    ? await importViaSupabaseRpc(payload)
    : await importViaPg(payload);

  console.log('\n=== Conteggi dopo import ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
