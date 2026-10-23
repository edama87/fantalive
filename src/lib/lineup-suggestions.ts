/**
 * Formazioni consigliate: schema del payload API, abbinamento nomi -> id
 * giocatore e accesso a public.lineup_suggestions (solo service role).
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const role = z.enum(['P', 'D', 'C', 'A']);

export const suggestionPlayerSchema = z
  .object({
    playerId: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    role: role.optional(),
    realTeam: z.string().trim().max(40).optional(),
    fixture: z.string().trim().max(60).optional(),
    homeAway: z.enum(['H', 'A']).optional(),
    startPct: z.number().min(0).max(100).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((p) => p.playerId || p.name, { message: 'Serve playerId o name' });

export const suggestionPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  teamId: z.string().trim().min(1).max(20).default('ap'),
  round: z.number().int().positive().max(60),
  variant: z.string().trim().min(1).max(60).default('principale'),
  status: z.enum(['bozza', 'proposta', 'confermata', 'scartata']).default('proposta'),
  formation: z.string().regex(/^[1-6]-[1-6](-[1-6]){0,2}$/, 'Modulo non valido (es. 4-5-1)'),
  opponentTeamId: z.string().trim().min(1).max(20).nullable().optional(),
  starters: z.array(suggestionPlayerSchema).min(1).max(11),
  bench: z.array(suggestionPlayerSchema).max(20).default([]),
  rationale: z.string().max(20000).nullable().optional(),
  alternatives: z
    .array(
      z.object({
        formation: z.string().regex(/^[1-6]-[1-6](-[1-6]){0,2}$/),
        expectedPoints: z.number().min(0).max(200).nullable().optional(),
        note: z.string().trim().max(1000).optional(),
      }),
    )
    .max(10)
    .default([]),
  expectedPoints: z.number().min(0).max(200).nullable().optional(),
  sources: z
    .array(z.union([z.string().url(), z.object({ url: z.string().url(), label: z.string().trim().max(120).optional() })]))
    .max(30)
    .default([]),
});

export type SuggestionPayload = z.infer<typeof suggestionPayloadSchema>;
export type SuggestionPlayerInput = z.infer<typeof suggestionPlayerSchema>;

export interface SuggestionPlayer {
  playerId: string | null;
  name: string;
  role: 'P' | 'D' | 'C' | 'A' | null;
  realTeam: string | null;
  fixture: string | null;
  homeAway: 'H' | 'A' | null;
  startPct: number | null;
  note: string | null;
  matched: boolean;
}

export interface CatalogPlayer {
  id: string;
  name: string;
  role: 'P' | 'D' | 'C' | 'A';
  realTeam: string | null;
  inTeam: boolean;
}

export interface LineupSuggestion {
  id: string;
  teamId: string;
  round: number;
  variant: string;
  status: string;
  formation: string;
  opponentTeamId: string | null;
  starters: SuggestionPlayer[];
  bench: SuggestionPlayer[];
  rationale: string | null;
  alternatives: { formation: string; expectedPoints: number | null; note: string | null }[];
  expectedPoints: number | null;
  sources: { url: string; label: string | null }[];
  createdAt: string;
  updatedAt: string;
}

/** "N'Dri", "Kessié", "LAURIENTE'" -> "NDRI", "KESSIE", "LAURIENTE". */
export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Abbina un nome al catalogo: id esatto, nome completo, poi cognome (prima
 * parola/e del nome DB) preferendo i giocatori della rosa e il ruolo indicato.
 * Ambiguità -> nessun abbinamento.
 */
export function resolvePlayer(input: SuggestionPlayerInput, catalog: CatalogPlayer[]): CatalogPlayer | null {
  if (input.playerId) {
    const byId = catalog.find((p) => p.id === input.playerId);
    if (byId) return byId;
  }
  if (!input.name) return null;
  const wanted = normalizePlayerName(input.name);
  if (!wanted) return null;
  const pools = [catalog.filter((p) => p.inTeam), catalog];
  for (const pool of pools) {
    const scoped = input.role ? pool.filter((p) => p.role === input.role) : pool;
    const exact = scoped.filter((p) => normalizePlayerName(p.name) === wanted);
    if (exact.length === 1) return exact[0];
    const bySurname = scoped.filter((p) => {
      const full = normalizePlayerName(p.name);
      return full === wanted || full.startsWith(`${wanted} `);
    });
    if (bySurname.length === 1) return bySurname[0];
    if (bySurname.length > 1) return null;
  }
  return null;
}

export function resolvePlayers(list: SuggestionPlayerInput[], catalog: CatalogPlayer[]): SuggestionPlayer[] {
  return list.map((input) => {
    const hit = resolvePlayer(input, catalog);
    return {
      playerId: hit?.id ?? input.playerId ?? null,
      name: hit?.name ?? input.name ?? input.playerId ?? '',
      role: input.role ?? hit?.role ?? null,
      realTeam: input.realTeam ?? hit?.realTeam ?? null,
      fixture: input.fixture ?? null,
      homeAway: input.homeAway ?? null,
      startPct: input.startPct ?? null,
      note: input.note ?? null,
      matched: Boolean(hit),
    };
  });
}

/** Controlli di coerenza tra modulo e titolari (portiere + somma reparti). */
export function formationIssues(formation: string, starters: SuggestionPlayer[]): string[] {
  const issues: string[] = [];
  const parts = formation.split('-').map(Number);
  const outfield = parts.reduce((a, b) => a + b, 0);
  if (outfield !== 10) issues.push(`Il modulo ${formation} non somma a 10 giocatori di movimento`);
  if (starters.length !== 11) issues.push(`Titolari: ${starters.length} invece di 11`);
  if (parts.length === 3 && starters.every((s) => s.role)) {
    const count = (r: string) => starters.filter((s) => s.role === r).length;
    const expected = { P: 1, D: parts[0], C: parts[1], A: parts[2] };
    for (const [r, n] of Object.entries(expected)) {
      if (count(r) !== n) issues.push(`Ruolo ${r}: ${count(r)} invece di ${n}`);
    }
  }
  return issues;
}

async function loadCatalog(sb: SupabaseClient, teamId: string): Promise<CatalogPlayer[]> {
  const [{ data: players, error }, { data: versions }] = await Promise.all([
    sb.from('players').select('id,name,role,real_team'),
    sb.from('roster_versions').select('id').eq('team_id', teamId).is('effective_until', null),
  ]);
  if (error) throw new Error(error.message);
  const versionIds = (versions ?? []).map((v) => v.id);
  let teamIds = new Set<string>();
  if (versionIds.length) {
    const { data: rp } = await sb.from('roster_players').select('player_id').in('roster_version_id', versionIds);
    teamIds = new Set((rp ?? []).map((r) => r.player_id as string));
  }
  return (players ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    realTeam: p.real_team ?? null,
    inTeam: teamIds.has(p.id),
  }));
}

function normalizeSources(sources: SuggestionPayload['sources']) {
  return sources.map((s) => (typeof s === 'string' ? { url: s, label: null } : { url: s.url, label: s.label ?? null }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): LineupSuggestion {
  return {
    id: row.id,
    teamId: row.team_id,
    round: row.round_number,
    variant: row.variant,
    status: row.status,
    formation: row.formation,
    opponentTeamId: row.opponent_team_id,
    starters: row.starters ?? [],
    bench: row.bench ?? [],
    rationale: row.rationale,
    alternatives: row.alternatives ?? [],
    expectedPoints: row.expected_points === null ? null : Number(row.expected_points),
    sources: row.sources ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Crea o aggiorna (per id, altrimenti per squadra+giornata+variante). */
export async function upsertSuggestion(sb: SupabaseClient, payload: SuggestionPayload) {
  const catalog = await loadCatalog(sb, payload.teamId);
  const starters = resolvePlayers(payload.starters, catalog);
  const bench = resolvePlayers(payload.bench, catalog);
  const warnings = [
    ...formationIssues(payload.formation, starters),
    ...[...starters, ...bench].filter((p) => !p.matched).map((p) => `Giocatore non abbinato: ${p.name}`),
    ...[...starters, ...bench]
      .filter((p) => p.matched && !catalog.find((c) => c.id === p.playerId)?.inTeam)
      .map((p) => `Non è nella rosa attuale: ${p.name}`),
  ];
  const row = {
    team_id: payload.teamId,
    round_number: payload.round,
    variant: payload.variant,
    status: payload.status,
    formation: payload.formation,
    opponent_team_id: payload.opponentTeamId ?? null,
    starters,
    bench,
    rationale: payload.rationale ?? null,
    alternatives: payload.alternatives.map((a) => ({
      formation: a.formation,
      expectedPoints: a.expectedPoints ?? null,
      note: a.note ?? null,
    })),
    expected_points: payload.expectedPoints ?? null,
    sources: normalizeSources(payload.sources),
  };
  const query = payload.id
    ? sb.from('lineup_suggestions').update(row).eq('id', payload.id).select('*').single()
    : sb.from('lineup_suggestions').upsert(row, { onConflict: 'team_id,round_number,variant' }).select('*').single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { suggestion: fromRow(data), warnings };
}

/** Suggerimenti di una giornata; senza giornata, quelli dell'ultima giornata presente. */
export async function listSuggestions(sb: SupabaseClient, opts: { teamId?: string; round?: number } = {}) {
  const teamId = opts.teamId ?? 'ap';
  let round = opts.round;
  if (!round) {
    const { data } = await sb
      .from('lineup_suggestions')
      .select('round_number')
      .eq('team_id', teamId)
      .order('round_number', { ascending: false })
      .limit(1);
    round = data?.[0]?.round_number;
    if (!round) return { round: null, suggestions: [] as LineupSuggestion[] };
  }
  const { data, error } = await sb
    .from('lineup_suggestions')
    .select('*')
    .eq('team_id', teamId)
    .eq('round_number', round)
    .order('variant', { ascending: true });
  if (error) throw new Error(error.message);
  const suggestions = (data ?? []).map(fromRow);
  // la principale per prima, poi per ultimo aggiornamento
  suggestions.sort((a, b) =>
    a.variant === 'principale' ? -1 : b.variant === 'principale' ? 1 : b.updatedAt.localeCompare(a.updatedAt),
  );
  return { round, suggestions };
}

export async function deleteSuggestion(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await sb.from('lineup_suggestions').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
