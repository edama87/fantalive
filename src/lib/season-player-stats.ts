/** Presenze e medie stagionali dai voti consolidati (Gazzetta testata master). */
export interface OfficialVoteRow {
  player_id: string;
  round_number: number;
  vote_gazzetta: number | null;
  vote_average: number | null;
  fanta_vote: number | null;
}

export interface SeasonPlayerStats {
  appearances: number;
  /** Media voto Gazzetta. */
  average: number | null;
  /** Fantamedia: voto Gazzetta + bonus/malus della giornata. */
  fantaAverage: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Presenza = voto Gazzetta presente (s.v. = null, non conta). */
export function aggregateSeasonStats(rows: readonly OfficialVoteRow[]): Map<string, SeasonPlayerStats> {
  const acc = new Map<string, { rounds: Set<number>; sum: number; fsum: number; fn: number }>();
  for (const r of rows) {
    if (r.vote_gazzetta == null || !Number.isFinite(Number(r.vote_gazzetta))) continue;
    const g = Number(r.vote_gazzetta);
    const a = acc.get(r.player_id) ?? { rounds: new Set<number>(), sum: 0, fsum: 0, fn: 0 };
    if (a.rounds.has(r.round_number)) continue;
    a.rounds.add(r.round_number);
    a.sum += g;
    if (r.fanta_vote != null && r.vote_average != null) {
      a.fsum += g + (Number(r.fanta_vote) - Number(r.vote_average));
      a.fn += 1;
    }
    acc.set(r.player_id, a);
  }
  const out = new Map<string, SeasonPlayerStats>();
  for (const [id, a] of acc) {
    const n = a.rounds.size;
    out.set(id, {
      appearances: n,
      average: n ? round2(a.sum / n) : null,
      fantaAverage: a.fn === n && n ? round2(a.fsum / n) : null,
    });
  }
  return out;
}
