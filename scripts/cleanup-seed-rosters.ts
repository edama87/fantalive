/**
 * One-shot cleanup: remove seed/test players from open rosters and
 * deactivate anyone not on an open FMS roster.
 *
 * Usage:
 *   npx tsx scripts/cleanup-seed-rosters.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const i = line.indexOf('=');
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

async function main() {
  const {
    cleanupSeedPlayersFromOpenRosters,
    readRosterDbCounts,
    readOpenRosterCountsByTeam,
    isSeedPlayerId,
  } = await import('../src/lib/roster-import');
  const { getServerClient } = await import('../src/lib/db/supabase');

  console.log('=== Pulizia seed/test dalle rose aperte ===');
  const result = await cleanupSeedPlayersFromOpenRosters();
  console.log(JSON.stringify(result, null, 2));

  const counts = await readRosterDbCounts();
  const byTeam = await readOpenRosterCountsByTeam();

  const sb = getServerClient();
  const { data: players } = await sb.from('players').select('id,is_active');
  const seedActive = (players || []).filter(
    (p) => isSeedPlayerId(p.id) && p.is_active
  ).length;
  const seedTotal = (players || []).filter((p) => isSeedPlayerId(p.id)).length;

  console.log('\n=== Conteggi post-pulizia ===');
  console.log(
    JSON.stringify(
      {
        playersTotal: players?.length ?? 0,
        playersActive: counts.playersActive,
        playersInactive: counts.playersInactive,
        openRosterPlayers: counts.rosterPlayers,
        seedPlayersTotal: seedTotal,
        seedPlayersActive: seedActive,
        rosterPlayersPerTeam: byTeam,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
