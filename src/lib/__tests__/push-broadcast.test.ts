import { describe, expect, it, vi } from 'vitest';
import {
  articleBroadcastDefaults,
  deliverBroadcast,
  isSafeAppPath,
  parseBroadcastPayload,
  type BroadcastDeps,
  type BroadcastTarget,
} from '@/lib/push/broadcast';

const sub = (id: string): BroadcastTarget => ({ id, endpoint: `https://fcm.googleapis.com/fcm/send/${id}` });

function deps(overrides: Partial<BroadcastDeps> & Pick<BroadcastDeps, 'claimKeys' | 'sendPush'>): BroadcastDeps {
  return {
    deleteSubscription: vi.fn(async () => {}),
    markDelivered: vi.fn(async () => {}),
    markFailure: vi.fn(async () => {}),
    releaseKey: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('parseBroadcastPayload', () => {
  const valid = {
    title: 'Il Bundle Quotidiano — Giornata 6',
    body: 'È uscito il pezzo della giornata.',
    url: '/giornale/6',
    key: 'article:r6',
  };

  it('accepts a valid payload and aliases text/eventKey', () => {
    expect(parseBroadcastPayload(valid)).toEqual({ ok: true, value: valid });
    expect(
      parseBroadcastPayload({ title: valid.title, text: valid.body, url: valid.url, eventKey: valid.key }),
    ).toEqual({ ok: true, value: valid });
  });

  it('rejects empty, oversized or unsafe fields', () => {
    expect(parseBroadcastPayload(null).ok).toBe(false);
    expect(parseBroadcastPayload({ ...valid, title: '  ' }).ok).toBe(false);
    expect(parseBroadcastPayload({ ...valid, url: 'https://fantalive-mu.vercel.app/giornale/6' }).ok).toBe(false);
    expect(parseBroadcastPayload({ ...valid, url: '//evil.example/x' }).ok).toBe(false);
    expect(parseBroadcastPayload({ ...valid, url: '/giornale/6 yes' }).ok).toBe(false);
    expect(parseBroadcastPayload({ ...valid, key: 'article/r6' }).ok).toBe(false);
    expect(parseBroadcastPayload({ ...valid, key: 'article r6' }).ok).toBe(false);
    expect(parseBroadcastPayload({ ...valid, body: 'x'.repeat(301) }).ok).toBe(false);
  });
});

describe('isSafeAppPath and article defaults', () => {
  it('allows only relative app paths', () => {
    expect(isSafeAppPath('/giornale/6')).toBe(true);
    expect(isSafeAppPath('/')).toBe(true);
    expect(isSafeAppPath('//example.com')).toBe(false);
    expect(isSafeAppPath('javascript:alert(1)')).toBe(false);
    expect(isSafeAppPath('/giornale/6?x=1')).toBe(true);
  });

  it('builds the prefilled giornata payload', () => {
    expect(articleBroadcastDefaults(6)).toEqual({
      title: 'Il Bundle Quotidiano — Giornata 6',
      body: 'È uscito il pezzo della giornata: commenti, classifica e vignette. Il pianto, come sempre, paga.',
      url: '/giornale/6',
      key: 'article:r6',
    });
    expect(() => articleBroadcastDefaults(0)).toThrow(/giornata/i);
  });
});

describe('deliverBroadcast', () => {
  const payload = articleBroadcastDefaults(6);

  it('sends once, skips already claimed keys, removes gone subs and retries on failure', async () => {
    const claimed = new Set<string>();
    const sendPush = vi.fn(async (target: BroadcastTarget) => {
      if (target.id === 'gone') return { ok: false as const, gone: true, status: 410, error: 'gone' };
      if (target.id === 'fail') return { ok: false as const, gone: false, status: 500, error: 'timeout' };
      return { ok: true as const };
    });
    const d = deps({
      claimKeys: async (id, keys) => {
        const key = `${id}:${keys[0]}`;
        if (claimed.has(key)) return new Set();
        claimed.add(key);
        return new Set(keys);
      },
      sendPush,
    });

    const first = await deliverBroadcast([sub('ok'), sub('gone'), sub('fail'), sub('skip-later')], payload, d);
    expect(first).toEqual({ subscriptions: 4, sent: 2, skipped: 0, removed: 1, failed: 1 });
    expect(d.markDelivered).toHaveBeenCalledTimes(2);
    expect(d.deleteSubscription).toHaveBeenCalledTimes(1);
    expect(d.markFailure).toHaveBeenCalledTimes(1);
    expect(d.releaseKey).toHaveBeenCalledWith('fail', 'article:r6');

    const second = await deliverBroadcast([sub('ok'), sub('skip-later')], payload, d);
    expect(second).toEqual({ subscriptions: 2, sent: 0, skipped: 2, removed: 0, failed: 0 });
    expect(sendPush).toHaveBeenCalledTimes(4);
  });

  it('returns zero counts when there are no subscriptions', async () => {
    const d = deps({
      claimKeys: vi.fn(async () => new Set<string>()),
      sendPush: vi.fn(async () => ({ ok: true as const })),
    });
    await expect(deliverBroadcast([], payload, d)).resolves.toEqual({
      subscriptions: 0,
      sent: 0,
      skipped: 0,
      removed: 0,
      failed: 0,
    });
    expect(d.sendPush).not.toHaveBeenCalled();
  });
});
