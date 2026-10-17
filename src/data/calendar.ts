import { Round, MatchPairing } from '@/types';

type PairingCycle = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

const pairingCycles: Record<PairingCycle, MatchPairing[]> = {
  A: [
    { homeTeamId: 'le', awayTeamId: 'st' },
    { homeTeamId: 'dc', awayTeamId: 'ap' },
    { homeTeamId: 'am', awayTeamId: 'ym' },
    { homeTeamId: 'rp', awayTeamId: 'sf' },
    { homeTeamId: 'fc', awayTeamId: 'psg' },
  ],
  B: [
    { homeTeamId: 'ym', awayTeamId: 'le' },
    { homeTeamId: 'st', awayTeamId: 'dc' },
    { homeTeamId: 'ap', awayTeamId: 'rp' },
    { homeTeamId: 'psg', awayTeamId: 'am' },
    { homeTeamId: 'sf', awayTeamId: 'fc' },
  ],
  C: [
    { homeTeamId: 'le', awayTeamId: 'dc' },
    { homeTeamId: 'rp', awayTeamId: 'st' },
    { homeTeamId: 'ym', awayTeamId: 'psg' },
    { homeTeamId: 'fc', awayTeamId: 'ap' },
    { homeTeamId: 'am', awayTeamId: 'sf' },
  ],
  D: [
    { homeTeamId: 'dc', awayTeamId: 'rp' },
    { homeTeamId: 'psg', awayTeamId: 'le' },
    { homeTeamId: 'st', awayTeamId: 'fc' },
    { homeTeamId: 'sf', awayTeamId: 'ym' },
    { homeTeamId: 'ap', awayTeamId: 'am' },
  ],
  E: [
    { homeTeamId: 'le', awayTeamId: 'rp' },
    { homeTeamId: 'fc', awayTeamId: 'dc' },
    { homeTeamId: 'psg', awayTeamId: 'sf' },
    { homeTeamId: 'am', awayTeamId: 'st' },
    { homeTeamId: 'ym', awayTeamId: 'ap' },
  ],
  F: [
    { homeTeamId: 'rp', awayTeamId: 'fc' },
    { homeTeamId: 'sf', awayTeamId: 'le' },
    { homeTeamId: 'dc', awayTeamId: 'am' },
    { homeTeamId: 'ap', awayTeamId: 'psg' },
    { homeTeamId: 'st', awayTeamId: 'ym' },
  ],
  G: [
    { homeTeamId: 'le', awayTeamId: 'fc' },
    { homeTeamId: 'am', awayTeamId: 'rp' },
    { homeTeamId: 'sf', awayTeamId: 'ap' },
    { homeTeamId: 'ym', awayTeamId: 'dc' },
    { homeTeamId: 'psg', awayTeamId: 'st' },
  ],
  H: [
    { homeTeamId: 'fc', awayTeamId: 'am' },
    { homeTeamId: 'ap', awayTeamId: 'le' },
    { homeTeamId: 'rp', awayTeamId: 'ym' },
    { homeTeamId: 'st', awayTeamId: 'sf' },
    { homeTeamId: 'dc', awayTeamId: 'psg' },
  ],
  I: [
    { homeTeamId: 'le', awayTeamId: 'am' },
    { homeTeamId: 'ym', awayTeamId: 'fc' },
    { homeTeamId: 'ap', awayTeamId: 'st' },
    { homeTeamId: 'psg', awayTeamId: 'rp' },
    { homeTeamId: 'sf', awayTeamId: 'dc' },
  ],
};

const cycleOrder: PairingCycle[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

const roundDates: Array<{ serieA: number; date: string }> = [
  { serieA: 7, date: '16/10/2026' },
  { serieA: 8, date: '23/10/2026' },
  { serieA: 9, date: '27/10/2026' },
  { serieA: 10, date: '31/10/2026' },
  { serieA: 11, date: '06/11/2026' },
  { serieA: 12, date: '21/11/2026' },
  { serieA: 13, date: '27/11/2026' },
  { serieA: 14, date: '04/12/2026' },
  { serieA: 15, date: '11/12/2026' },
  { serieA: 16, date: '18/12/2026' },
  { serieA: 17, date: '01/01/2027' },
  { serieA: 18, date: '05/01/2027' },
  { serieA: 19, date: '08/01/2027' },
  { serieA: 20, date: '15/01/2027' },
  { serieA: 21, date: '22/01/2027' },
  { serieA: 22, date: '29/01/2027' },
  { serieA: 23, date: '05/02/2027' },
  { serieA: 24, date: '12/02/2027' },
  { serieA: 25, date: '19/02/2027' },
  { serieA: 26, date: '26/02/2027' },
  { serieA: 27, date: '05/03/2027' },
  { serieA: 28, date: '12/03/2027' },
  { serieA: 29, date: '19/03/2027' },
  { serieA: 30, date: '02/04/2027' },
  { serieA: 31, date: '09/04/2027' },
  { serieA: 32, date: '16/04/2027' },
  { serieA: 33, date: '23/04/2027' },
];

function swapHomeAway(pairings: MatchPairing[]): MatchPairing[] {
  return pairings.map(p => ({
    homeTeamId: p.awayTeamId,
    awayTeamId: p.homeTeamId,
  }));
}

function generateRounds(): Round[] {
  const rounds: Round[] = [];
  
  for (let i = 0; i < 27; i++) {
    const roundNumber = i + 1;
    const cycleIndex = i % 9;
    const cycle = cycleOrder[cycleIndex];
    const basePairings = pairingCycles[cycle];
    
    const isSecondCycle = roundNumber >= 10 && roundNumber <= 18;
    const pairings = isSecondCycle ? swapHomeAway(basePairings) : basePairings;
    
    rounds.push({
      number: roundNumber,
      serieAMatchday: roundDates[i].serieA,
      date: roundDates[i].date,
      pairings,
    });
  }
  
  return rounds;
}

export const calendar: Round[] = generateRounds();

export function getRoundByNumber(num: number): Round | undefined {
  return calendar.find(r => r.number === num);
}

/** 'dd/mm/yyyy' -> numero yyyymmdd confrontabile. */
function roundDateKey(date: string): number {
  const [dd, mm, yyyy] = date.split('/').map((part) => Number.parseInt(part, 10));
  return yyyy * 10000 + mm * 100 + dd;
}

/** Data di oggi (fuso Europe/Rome) come yyyymmdd. */
function romeTodayKey(now: Date): number {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return Number.parseInt(iso.replace(/-/g, ''), 10);
}

/**
 * Giornata corrente: l'ultima già iniziata (data <= oggi, ora di Roma).
 * Prima dell'inizio del campionato restituisce la prima giornata.
 */
export function getCurrentRound(now: Date = new Date()): Round {
  const today = romeTodayKey(now);
  let current = calendar[0];
  for (const round of calendar) {
    if (roundDateKey(round.date) <= today) current = round;
  }
  return current;
}

export function getMatchForTeam(roundNumber: number, teamId: string): MatchPairing | undefined {
  const round = getRoundByNumber(roundNumber);
  if (!round) return undefined;
  
  return round.pairings.find(
    p => p.homeTeamId === teamId || p.awayTeamId === teamId
  );
}
