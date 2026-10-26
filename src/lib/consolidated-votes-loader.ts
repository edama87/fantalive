import { canonicalTeamCode } from "@/lib/fantacalcio-it";
import { getPublicClient, isSupabaseConfigured } from "@/lib/db/supabase";
import type { ConsolidatedVoteEntry } from "@/lib/pianetafanta-url";
import { masterVote, paperVote } from "@/lib/vote-precision";
import { missingOutlets } from "@/lib/pianetafanta";

/**
 * Voti consolidati (import pianetafanta) di una partita di Serie A, o null se
 * la partita non è stata ancora consolidata.
 */
export async function loadConsolidatedMatchVotes(
  serieAMatchday: number,
  homeTeam: string,
  awayTeam: string,
): Promise<ConsolidatedVoteEntry[] | null> {
  if (!isSupabaseConfigured()) return null;
  const key = `${canonicalTeamCode(homeTeam) ?? homeTeam}-${canonicalTeamCode(awayTeam) ?? awayTeam}`;
  try {
    const { data, error } = await getPublicClient()
      .from("official_vote_imports")
      .select("players")
      .eq("serie_a_matchday", serieAMatchday)
      .eq("source", "pianetafanta")
      .eq("match_key", key)
      .order("imported_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data || !Array.isArray(data.players)) return null;
    const players = (
      data.players as Array<ConsolidatedVoteEntry & { excluded?: boolean }>
    ).filter((p) => !p.excluded);
    const gazzettaPublished = !missingOutlets(players).includes("gazzetta");
    return players
      .map((p) => {
        const votes = {
          gazzetta: paperVote(p.votes?.gazzetta),
          corriere: paperVote(p.votes?.corriere),
          tuttosport: paperVote(p.votes?.tuttosport),
        };
        return {
          name: p.name,
          team: p.team,
          votes,
          average: masterVote(votes, gazzettaPublished),
          minutesPlayed:
            typeof p.minutesPlayed === "number" ? p.minutesPlayed : null,
        };
      });
  } catch (error) {
    console.warn("[Serie A] voti consolidati non disponibili:", error);
    return null;
  }
}
