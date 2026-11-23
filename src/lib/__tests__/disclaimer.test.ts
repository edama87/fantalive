import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISCLAIMER_ITALIC_LINES,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_PENDING_CLASS,
  DISCLAIMER_STORAGE_KEY,
  DISCLAIMER_TITLE,
  DISCLAIMER_UPDATED_AT,
  DISCLAIMER_VERSION,
  acceptDisclaimer,
  getDisclaimerBootScript,
  hasAcceptedDisclaimer,
  isDisclaimerExemptPath,
} from '@/lib/disclaimer';

describe('disclaimer', () => {
  const store = new Map<string, string>();
  const classes = new Set<string>();

  beforeEach(() => {
    store.clear();
    classes.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
    vi.stubGlobal('document', {
      documentElement: {
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
          contains: (name: string) => classes.has(name),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a versioned storage key with date', () => {
    expect(DISCLAIMER_STORAGE_KEY).toBe(
      `fantalive_disclaimer_${DISCLAIMER_VERSION}_${DISCLAIMER_UPDATED_AT}`,
    );
    expect(DISCLAIMER_STORAGE_KEY).toBe('fantalive_disclaimer_v1_2026-11-23');
  });

  it('exempts admin routes and not public pages', () => {
    expect(isDisclaimerExemptPath('/admin')).toBe(true);
    expect(isDisclaimerExemptPath('/admin/login')).toBe(true);
    expect(isDisclaimerExemptPath('/admin/consigli')).toBe(true);
    expect(isDisclaimerExemptPath('/')).toBe(false);
    expect(isDisclaimerExemptPath('/classifica')).toBe(false);
    expect(isDisclaimerExemptPath('/disclaimer')).toBe(false);
  });

  it('records acceptance in localStorage and clears the pending class', () => {
    classes.add(DISCLAIMER_PENDING_CLASS);
    expect(hasAcceptedDisclaimer()).toBe(false);
    const now = new Date('2026-11-23T20:00:00.000Z');
    acceptDisclaimer(now);
    expect(store.get(DISCLAIMER_STORAGE_KEY)).toBe(now.toISOString());
    expect(hasAcceptedDisclaimer()).toBe(true);
    expect(classes.has(DISCLAIMER_PENDING_CLASS)).toBe(false);
  });

  it('boot script mentions the current key and skips /admin', () => {
    const script = getDisclaimerBootScript();
    expect(script).toContain(DISCLAIMER_STORAGE_KEY);
    expect(script).toContain('/admin');
    expect(script).toContain('disclaimer-pending');
  });

  it('includes the official and ironic lines', () => {
    expect(DISCLAIMER_TITLE).toBe('Prima di entrare');
    expect(DISCLAIMER_PARAGRAPHS.join(' ')).toContain('FMS Revo');
    expect(DISCLAIMER_ITALIC_LINES).toHaveLength(2);
    expect(DISCLAIMER_ITALIC_LINES[0]).toContain('puramente casuale');
    expect(DISCLAIMER_ITALIC_LINES[1]).toBe('Ricorda comunque: il pianto paga, sempre.');
  });
});
