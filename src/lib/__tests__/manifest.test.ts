import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('manifest PWA', () => {
  it('is installable as a standalone app with 192/512 and maskable icons', () => {
    const m = manifest();
    expect(m).toMatchObject({ display: 'standalone', start_url: '/', scope: '/', short_name: 'FantaLive' });
    const icons = m.icons ?? [];
    for (const size of ['192x192', '512x512']) {
      expect(icons.some((i) => i.sizes === size && i.purpose === 'any')).toBe(true);
      expect(icons.some((i) => i.sizes === size && i.purpose === 'maskable')).toBe(true);
    }
  });
});
