/**
 * Wrapper: seed solo G5. Preferire scripts/seed-match-comments.ts.
 * Uso: ALLOW_MATCH_COMMENTS_SEED=1 npx tsx --env-file=.env.local scripts/seed-match-comments-g5.ts
 */
import { spawnSync } from 'node:child_process';

if (process.env.ALLOW_MATCH_COMMENTS_SEED !== '1') {
  console.error(
    'Rifiuto: imposta ALLOW_MATCH_COMMENTS_SEED=1 solo dopo OK esplicito (e non su prod senza consenso).',
  );
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['tsx', '--env-file=.env.local', 'scripts/seed-match-comments.ts', '5'],
  { stdio: 'inherit', env: process.env },
);
process.exit(result.status ?? 1);
