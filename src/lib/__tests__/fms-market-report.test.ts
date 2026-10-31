import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { estimateTeamCredits, parseMarketReportTable, parseMarketSessions, parseSignedUserCredits } from '@/lib/fms-market-report';

const fx = (n: string) => readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const ops = [...parseMarketReportTable(fx('fms-mercato-2210.html')), ...parseMarketReportTable(fx('fms-mercato-2910.html'))];

describe('report mercato FMS', () => {
  it('sessioni', () => {
    expect(parseMarketSessions(fx('fms-mercato-sessioni.html')).map((s) => s.label)).toEqual(['29-10-2026', '22-10-2026']);
  });
  it('operazioni con prezzo, taglio, prestito e infortunio', () => {
    expect(ops).toHaveLength(17);
    const zambo = ops.find((o) => o.player.startsWith('ZAMBO'))!;
    expect(zambo).toMatchObject({ teamName: 'Parisso San Gennaro', role: 'C', realTeam: 'NAP', released: 'Pasalic M.', price: 15, loan: false });
    expect(ops.find((o) => o.player === 'BELAHYANE Reda')).toMatchObject({ loan: true, injured: true, price: 0 });
  });
  it('Amatori ProSecco: 60 - (7+4+1) = 48, come FMS', () => {
    expect(estimateTeamCredits('Amatori ProSecco', ops).remaining).toBe(48);
  });
  it('prestito a costo fisso 10', () => {
    expect(estimateTeamCredits('Real Pedrotte', ops)).toMatchObject({ spent: 10, remaining: 50 });
    expect(estimateTeamCredits('Parisso San Gennaro', ops).remaining).toBe(34);
    expect(estimateTeamCredits('Salen Team', ops)).toMatchObject({ spent: 0, remaining: 60 });
  });
  it('crediti della squadra loggata', () => {
    const html = '<div class="signed-user__team-name">Amatori ProSecco</div><div class="signed-user__credits">Crediti residui: <span class="signed-user__credits-value">48</span></div>';
    expect(parseSignedUserCredits(html)).toEqual({ teamName: 'Amatori ProSecco', credits: 48 });
    expect(parseSignedUserCredits('<div></div>')).toBeNull();
  });
});
