/**
 * FMS roster import helpers: payload shaping + Supabase RPC call.
 */

import type { ParsedTeamRoster } from '@/lib/fmsrevo-roster-parser';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';

export interface ImportRostersCounts {
  teams: number;
  playersActive: number;
  playersInactive: number;
  rosterPlayers: number;
  importedTeams: number;
  teamsDetail: Array<{
    teamId: string;
    teamName: string;
    rosterVersionId: string;
    playerCount: number;
  }>;
}

export function buildImportRostersPayload(teams: ParsedTeamRoster[]) {
  return {
    teams: teams.map((team) => ({
      teamName: team.teamName,
      managerName: 'TBD',
      players: team.players.map((p) => ({
        name: p.name,
        role: p.role,
        realTeam: p.realTeam,
        price: p.price ?? null,
      })),
    })),
  };
}

export async function importRostersViaRpc(
  teams: ParsedTeamRoster[]
): Promise<ImportRostersCounts> {
  if (!isSupabaseServerConfigured()) {
    throw new Error(
      'SUPABASE_SECRET_KEY non configurata: impossibile scrivere su Supabase'
    );
  }

  const supabase = getServerClient();
  const payload = buildImportRostersPayload(teams);

  const { data, error } = await supabase.rpc('import_fms_rosters', { payload });

  if (error) {
    throw new Error(`import_fms_rosters failed: ${error.message}`);
  }

  return data as ImportRostersCounts;
}

export async function readRosterDbCounts(): Promise<{
  teams: number;
  playersActive: number;
  playersInactive: number;
  rosterPlayers: number;
}> {
  const supabase = getServerClient();

  const [teams, active, inactive, rosterPlayers] = await Promise.all([
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false),
    supabase.from('roster_players').select('*', { count: 'exact', head: true }),
  ]);

  for (const res of [teams, active, inactive, rosterPlayers]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    teams: teams.count ?? 0,
    playersActive: active.count ?? 0,
    playersInactive: inactive.count ?? 0,
    rosterPlayers: rosterPlayers.count ?? 0,
  };
}
