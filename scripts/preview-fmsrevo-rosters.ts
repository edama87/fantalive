/**
 * Parse saved FMS Revo roster HTML files and print a summary.
 * Looks in uploads/fmsrevo/idFsqN.html (composed) then .raw.html.
 * Never prints credentials.
 *
 * Usage: npx tsx scripts/preview-fmsrevo-rosters.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseRosterFromHtml,
  validateTeamRoster,
  countRoles,
} from '../src/lib/fmsrevo-roster-parser';

const OUT_DIR = path.join(process.cwd(), 'uploads', 'fmsrevo');

async function main() {
  let files: string[] = [];
  try {
    files = await readdir(OUT_DIR);
  } catch {
    console.error(
      `Nessun file in ${OUT_DIR}. Esegui prima: npm run fmsrevo:download-rosters`
    );
    process.exit(1);
  }

  const ids = Array.from({ length: 12 }, (_, i) => i + 1);
  let found = 0;

  for (const id of ids) {
    const composed = path.join(OUT_DIR, `idFsq${id}.html`);
    const raw = path.join(OUT_DIR, `idFsq${id}.raw.html`);
    let html: string | null = null;
    let source = '';
    for (const [p, label] of [
      [composed, 'composed'],
      [raw, 'raw'],
    ] as const) {
      try {
        html = await readFile(p, 'utf8');
        source = label;
        break;
      } catch {
        // try next
      }
    }
    if (!html) continue;
    found += 1;

    const roster = parseRosterFromHtml(html, id);
    const validation = validateTeamRoster(roster);
    const roles = countRoles(roster.players);

    console.log(`\n=== idFsq${id} (${source}) — ${roster.teamName} ===`);
    console.log(
      `Giocatori: ${roster.players.length} | P/D/C/A: ${roles.P}/${roles.D}/${roles.C}/${roles.A} | valid=${validation.ok}`
    );
    if (!validation.ok) {
      for (const issue of validation.issues.slice(0, 5)) {
        console.log(`  ! ${issue.message}`);
      }
    }
    for (const role of ['P', 'D', 'C', 'A'] as const) {
      const list = roster.players
        .filter((p) => p.role === role)
        .map((p) => `${p.name} (${p.realTeam})`)
        .join(', ');
      console.log(`  ${role}: ${list || '(nessuno)'}`);
    }

    if (roster.players.length === 0 || !validation.ok) {
      if (roster.players.length === 0) {
        console.log('Stop: prima pagina senza giocatori.');
      } else if (id > 10) {
        console.log('Stop: pagina oltre le 10 squadre non valida.');
      }
      if (roster.players.length === 0 || id > 10) break;
    }
  }

  if (found === 0) {
    console.error('Nessun idFsq*.html trovato. Scarica prima le pagine.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
