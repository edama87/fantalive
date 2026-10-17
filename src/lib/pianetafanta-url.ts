/** Pagina voti pianetafanta della giornata di Serie A (da lì "Esporta Excel"). */
export function pianetafantaVotesUrl(serieAMatchday: number): string {
  return `https://www.pianetafanta.it/voti-fantacalcio?giornata=${serieAMatchday}`;
}

/** Riga di official_vote_imports.players (sottoinsieme usato dalla pagina Serie A). */
export interface ConsolidatedVoteEntry {
  name: string;
  team: string;
  votes: { gazzetta: number | null; corriere: number | null; tuttosport: number | null };
  average: number | null;
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
}

/**
 * Nome pianetafanta ("ESPOSITO S.", "FAYED O.") contro nome fantacalcio.it
 * ("Esposito Se.", "Omar Fayed"): le parole lunghe del primo ci sono tutte,
 * le iniziali sono compatibili con una parola del secondo.
 */
export function samePianetafantaName(pianetafantaName: string, otherName: string): boolean {
  const other = nameTokens(otherName);
  const pf = nameTokens(pianetafantaName);
  const words = pf.filter((t) => t.length >= 3);
  if (words.length === 0 || !words.every((w) => other.includes(w))) return false;
  const rest = other.filter((t) => !words.includes(t));
  return pf
    .filter((t) => t.length < 3)
    .every((initial) => rest.length === 0 || rest.some((t) => t.startsWith(initial) || initial.startsWith(t)));
}
