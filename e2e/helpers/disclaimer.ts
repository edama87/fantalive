import type { Page } from '@playwright/test';
import { DISCLAIMER_STORAGE_KEY } from '../../src/lib/disclaimer';
import { MY_TEAM_COOKIE, MY_TEAM_NONE } from '../../src/lib/my-team';

/** Precompila l'accettazione prima della navigazione, per i test che non coprono la modale. */
export async function seedDisclaimerAcceptance(page: Page) {
  await page.addInitScript((key: string) => {
    localStorage.setItem(key, new Date().toISOString());
  }, DISCLAIMER_STORAGE_KEY);
}

/** Evita il redirect a /benvenuto nei test delle pagine interne. */
export async function seedMyTeamChoice(page: Page, teamId: string = MY_TEAM_NONE) {
  await page.context().addCookies([
    { name: MY_TEAM_COOKIE, value: teamId, url: 'http://localhost:3000' },
  ]);
}
