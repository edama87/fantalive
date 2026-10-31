/**
 * Report "Info sessioni precedenti" del mercato FMS Revo (sola lettura):
 * parsing delle operazioni aggiudicate e stima dei crediti residui.
 */
import * as cheerio from 'cheerio';
import { calculateTransactionCost, getLeagueRules } from '@/lib/league-rules';

export interface MarketOperation {
  player: string;
  role: string;
  realTeam: string;
  teamName: string;
  released: string;
  injured: boolean;
  loan: boolean;
  price: number;
  date: string;
}

export interface MarketSession {
  label: string;
  value: string;
}

export function parseMarketSessions(selectHtml: string): MarketSession[] {
  const $ = cheerio.load(`<select>${selectHtml}</select>`);
  return $('option')
    .toArray()
    .map((o) => ({ label: $(o).text().trim(), value: $(o).attr('value') ?? '' }))
    .filter((s) => s.value);
}

export function parseMarketReportTable(tableHtml: string): MarketOperation[] {
  const $ = cheerio.load(`<table>${tableHtml}</table>`);
  const ops: MarketOperation[] = [];
  $('tr').each((_, tr) => {
    const td = $(tr).find('td');
    if (td.length < 10) return;
    const cell = (i: number) => $(td[i]).text().trim();
    const check = (i: number) => $(td[i]).find('.fa-check').length > 0 || /^s[iì]$/i.test(cell(i));
    const player = cell(1);
    if (!player) return;
    ops.push({
      player,
      role: cell(2),
      realTeam: cell(3),
      teamName: cell(4),
      released: cell(5),
      injured: check(6),
      loan: check(7),
      price: Number(cell(8)) || 0,
      date: cell(9),
    });
  });
  return ops;
}

/** Costo effettivo dell'operazione secondo il regolamento (prestito = costo fisso). */
export function operationCost(op: MarketOperation): number {
  return calculateTransactionCost(op.price, op.loan, op.injured).totalCost;
}

export interface TeamCreditsEstimate {
  initial: number;
  spent: number;
  remaining: number;
  operations: MarketOperation[];
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Crediti mercato residui stimati: crediti mercato iniziali meno il costo delle operazioni. */
export function estimateTeamCredits(teamName: string, ops: MarketOperation[]): TeamCreditsEstimate {
  const initial = getLeagueRules().initialMarketCredits;
  const mine = ops.filter((o) => key(o.teamName) === key(teamName));
  const spent = mine.reduce((sum, o) => sum + operationCost(o), 0);
  return { initial, spent, remaining: initial - spent, operations: mine };
}

/** Crediti mostrati da FMS per la squadra loggata ("Crediti residui: N"). */
export function parseSignedUserCredits(html: string): { teamName: string; credits: number } | null {
  const $ = cheerio.load(html);
  const teamName = $('.signed-user__team-name').first().text().trim();
  const credits = Number($('.signed-user__credits-value').first().text().trim());
  return teamName && Number.isFinite(credits) && $('.signed-user__credits-value').length ? { teamName, credits } : null;
}
