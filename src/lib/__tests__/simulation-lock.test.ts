// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { effectiveSimulation, isViewedRoundClosed, setSimulation, setViewedRoundClosed } from '@/lib/use-simulation';

describe('toggle simulazione su giornata definitiva', () => {
  beforeEach(() => { localStorage.clear(); setViewedRoundClosed(false); });
  it('giornata definitiva: simulazione effettiva spenta, preferenza intatta', () => {
    setSimulation(true);
    setViewedRoundClosed(true);
    expect(isViewedRoundClosed()).toBe(true);
    expect(effectiveSimulation(localStorage.getItem('fantalive_sim') === '1', isViewedRoundClosed())).toBe(false);
    expect(localStorage.getItem('fantalive_sim')).toBe('1');
    setViewedRoundClosed(false);
    expect(effectiveSimulation(true, isViewedRoundClosed())).toBe(true);
  });
  it('effectiveSimulation', () => {
    expect(effectiveSimulation(false, false)).toBe(false);
    expect(effectiveSimulation(true, true)).toBe(false);
    expect(effectiveSimulation(false, true)).toBe(false);
  });
});
