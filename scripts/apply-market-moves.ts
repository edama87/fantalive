/**
 * Applica le operazioni di mercato assegnate su FMS Revo quando le pagine
 * squadra non sono ancora aggiornate: parte dalle rose scaricate
 * (uploads/fmsrevo/idFsqN.html), sostituisce i giocatori e reimporta con
 * import_fms_rosters (stessa RPC dell'import normale).
 * Uso: npx tsx --tsconfig tsconfig.json --env-file=.env.local scripts/apply-market-moves.ts [--dry]
 */
import { readFileSync } from 'node:fs';
import { parseRosterFromHtml, validateTeamRoster, type ParsedRosterPlayer } from '@/lib/fmsrevo-roster-parser';
import { importRostersViaRpc } from '@/lib/roster-import';
import { getServerClient } from '@/lib/db/supabase';

// Mercato chiuso il 22/10/2026 19:05.
const MOVES: Record<string, Array<{ out: RegExp; in: ParsedRosterPlayer }>> = {
  'amatori prosecco': [
    { out: /^FITZ-JIM/, in: { name: 'BERNARDESCHI Federico', role: 'C', realTeam: 'BOL' } },
    { out: /^BASIC /, in: { name: 'THORSTVEDT Kristian', role: 'C', realTeam: 'SAS' } },
    { out: /^COLOMBO /, in: { name: "N'DRI Konan", role: 'A', realTeam: 'LEC' } },
  ],
  'little eagles': [
    { out: /^ORSOLINI /, in: { name: 'MILLA Lorenzo', role: 'C', realTeam: 'COM' } },
    { out: /^TERRACCIANO /, in: { name: 'STANKOVIC Filip', role: 'P', realTeam: 'VEN' } },
  ],
  'atletico magari': [{ out: /^THURAM Khephren/, in: { name: 'CAQUERET Maxence', role: 'C', realTeam: 'COM' } }],
  sfortonia: [{ out: /^LEYSEN /, in: { name: 'ISMAJLI Ardian', role: 'D', realTeam: 'TOR' } }],
  'yellow mustard': [{ out: /^GUEYE /, in: { name: 'CAMARDA Francesco', role: 'A', realTeam: 'MIL' } }],
  'dinamo cecchignola 1927': [{ out: /^FAGIOLI /, in: { name: "PISILLI Niccolo'", role: 'C', realTeam: 'ROM' } }],
  'real pedrotte': [{ out: /^LOCATELLI /, in: { name: 'BELAHYANE Reda', role: 'C', realTeam: 'LAZ' } }],
};

(async () => {
  const teams = [];
  const changed = new Set<string>();
  for (let id = 1; id <= 10; id++) {
    const roster = parseRosterFromHtml(readFileSync(`uploads/fmsrevo/idFsq${id}.html`, 'utf8'), id);
    for (const move of MOVES[roster.teamName.toLowerCase()] ?? []) {
      if (roster.players.some((p) => p.name === move.in.name)) continue; // già aggiornata su FMS
      const hits = roster.players.filter((p) => move.out.test(p.name));
      if (hits.length !== 1) throw new Error(`${roster.teamName}: ${move.out} trovato ${hits.length} volte`);
      if (hits[0].role !== move.in.role) throw new Error(`${roster.teamName}: ruolo diverso per ${hits[0].name}`);
      roster.players[roster.players.indexOf(hits[0])] = move.in;
      changed.add(roster.teamName.toLowerCase());
      console.log(`${roster.teamName}: +${move.in.name} -${hits[0].name}`);
    }
    const check = validateTeamRoster(roster);
    if (!check.ok) throw new Error(`${roster.teamName}: ${check.issues.map((i) => i.message).join('; ')}`);
    teams.push(roster);
  }
  if (process.argv.includes('--dry')) return;
  // Chiude la versione aperta delle squadre cambiate: la rosa della giornata 1
  // resta consultabile (getVersionForRound) e l'import crea la versione nuova.
  const supabase = getServerClient();
  const { data: teamRows } = await supabase.from('teams').select('id, name');
  const now = new Date().toISOString();
  const previous = new Map<string, { credits_remaining: number; market_credits: number }>();
  for (const team of teamRows ?? []) {
    if (!changed.has(String(team.name).toLowerCase())) continue;
    const { data: open } = await supabase
      .from('roster_versions')
      .update({ effective_until: now })
      .eq('team_id', team.id)
      .is('effective_until', null)
      .select('credits_remaining, market_credits');
    if (open?.[0]) previous.set(team.id, open[0]);
  }
  const result = await importRostersViaRpc(teams);
  for (const [teamId, credits] of previous) {
    await supabase
      .from('roster_versions')
      .update({ ...credits, notes: 'Mercato FMS Revo 22/10/2026' })
      .eq('team_id', teamId)
      .is('effective_until', null);
  }
  console.log(JSON.stringify({ ...result, teamsDetail: undefined }));
})();
