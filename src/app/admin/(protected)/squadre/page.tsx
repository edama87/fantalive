import Link from 'next/link';
import { aggregateSeasonStats, type OfficialVoteRow, type SeasonPlayerStats } from '@/lib/season-player-stats';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { fetchFmsMarketData, type FmsMarketData } from '@/lib/fms-market-server';
import { estimateTeamCredits, operationCost, type MarketOperation } from '@/lib/fms-market-report';
import { cn } from '@/lib/utils';

const ROLES = [
  ['P', 'Portieri'],
  ['D', 'Difensori'],
  ['C', 'Centrocampisti'],
  ['A', 'Attaccanti'],
] as const;

interface RosterRow {
  id: string;
  name: string;
  role: string;
  realTeam: string;
  price: number | null;
}

interface TeamRoster {
  id: string;
  name: string;
  since: string | null;
  players: RosterRow[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

async function loadSeasonStats(): Promise<{ stats: Map<string, SeasonPlayerStats>; rounds: number[] }> {
  const rows: OfficialVoteRow[] = [];
  const db = getServerClient();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('official_votes')
      .select('player_id, round_number, vote_gazzetta, vote_average, fanta_vote')
      .not('consolidated_at', 'is', null)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as OfficialVoteRow[]));
    if (!data || data.length < 1000) break;
  }
  const rounds = [...new Set(rows.filter((r) => r.vote_gazzetta != null).map((r) => r.round_number))].sort((a, b) => a - b);
  return { stats: aggregateSeasonStats(rows), rounds };
}

async function loadOpenRosters(): Promise<TeamRoster[]> {
  const sb = getServerClient();
  const [{ data: teams }, { data: versions }] = await Promise.all([
    sb.from('teams').select('id, name').order('name'),
    sb.from('roster_versions').select('id, team_id, effective_from').is('effective_until', null),
  ]);
  const ids = (versions ?? []).map((v) => v.id as string);
  const { data: rows } = ids.length
    ? await sb
        .from('roster_players')
        .select('roster_version_id, acquisition_price, player:players(id, name, role, real_team)')
        .in('roster_version_id', ids)
    : { data: [] };
  return (teams ?? []).map((t) => {
    const version = (versions ?? []).find((v) => v.team_id === t.id);
    const players = (rows ?? [])
      .filter((r) => r.roster_version_id === version?.id)
      .map((r) => {
        const p = r.player as unknown as { id: string; name: string; role: string; real_team: string };
        const price = Number(r.acquisition_price);
        return { id: p.id, name: p.name, role: p.role, realTeam: p.real_team, price: price > 0 ? price : null };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { id: t.id as string, name: t.name as string, since: (version?.effective_from as string) ?? null, players };
  });
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '—';
}

function CreditsBadge({ value, source }: { value: number | null; source: 'fms' | 'stima' | 'nd' }) {
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={cn('text-base font-semibold tabular-nums', value === null ? 'text-gray-400' : 'text-gray-900')}>
        {value ?? 'n/d'}
      </span>
      <span className={cn('text-[10px] uppercase tracking-wide', source === 'fms' ? 'text-emerald-600' : 'text-gray-400')}>
        {source === 'fms' ? 'crediti FMS' : source === 'stima' ? 'crediti stimati' : 'crediti'}
      </span>
    </span>
  );
}

function fmt(n: number | null): string {
  return n == null ? '—' : n.toFixed(2).replace('.', ',');
}

function TeamCard({ team, market, stats }: { team: TeamRoster; market: FmsMarketData | null; stats: Map<string, SeasonPlayerStats> | null }) {
  const estimate = market ? estimateTeamCredits(team.name, market.operations) : null;
  const fms = market?.signedUser && norm(market.signedUser.teamName) === norm(team.name) ? market.signedUser.credits : null;
  const credits = fms ?? estimate?.remaining ?? null;
  const source = fms !== null ? 'fms' : estimate ? 'stima' : 'nd';
  const opsByPlayer = new Map<string, MarketOperation>();
  for (const op of estimate?.operations ?? []) opsByPlayer.set(norm(op.player), op);

  return (
    <details className="group rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
        <span className="min-w-0">
          <span className="block truncate font-medium text-gray-900">{team.name}</span>
          <span className="block text-xs text-gray-500">
            {team.players.length} giocatori · rosa dal {formatDate(team.since)}
          </span>
        </span>
        <CreditsBadge value={credits} source={source} />
      </summary>
      <div className="space-y-3 border-t border-gray-100 p-3">
        {ROLES.map(([role, label]) => {
          const list = team.players.filter((p) => p.role === role);
          return (
            <section key={role}>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {label} <span className="text-gray-400">({list.length})</span>
              </h4>
              <ul className="divide-y divide-gray-50 text-sm">
                {list.map((p) => {
                  const op = opsByPlayer.get(norm(p.name));
                  const price = op ? operationCost(op) : p.price;
                  const st = stats?.get(p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                      <span className="min-w-0">
                        <span className="block truncate text-gray-800">
                          {p.name} <span className="text-xs text-gray-400">{p.realTeam}</span>
                        </span>
                        {stats && (
                          <span className="block text-[11px] tabular-nums text-gray-500">
                            {st ? (
                              <>
                                {st.appearances} pres · MV {fmt(st.average)} · FM {fmt(st.fantaAverage)}
                              </>
                            ) : (
                              '0 pres'
                            )}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs">
                        {op?.loan && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">prestito</span>}
                        {op && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">mercato</span>}
                        <span className="w-8 text-right tabular-nums text-gray-500" title={op ? `Mercato ${op.date}` : 'Prezzo d\'asta non disponibile'}>
                          {price ?? '—'}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {estimate && estimate.operations.length > 0 && (
          <section className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
            <h4 className="mb-1 font-medium text-gray-700">Operazioni di mercato</h4>
            <ul className="space-y-0.5">
              {estimate.operations.map((op) => (
                <li key={`${op.player}-${op.date}`} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    +{op.player} · −{op.released || '—'}
                    {op.loan ? ' · prestito' : ''}
                    {op.injured ? ' · inf.' : ''}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {operationCost(op)} · {op.date.slice(0, 6)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-gray-500">
              {estimate.initial} iniziali − {estimate.spent} spesi = {estimate.remaining}
            </p>
          </section>
        )}
      </div>
    </details>
  );
}

export default async function SquadrePage() {
  await connection();
  if ((isAdminConfigured() || process.env.NODE_ENV === 'production') && !(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  let teams: TeamRoster[] = [];
  let error: string | null = null;
  let market: FmsMarketData | null = null;
  let marketError: string | null = null;
  let season: { stats: Map<string, SeasonPlayerStats>; rounds: number[] } | null = null;
  if (!isSupabaseServerConfigured()) error = 'SUPABASE_SECRET_KEY non configurata.';
  else {
    const [rosters, mk, st] = await Promise.allSettled([loadOpenRosters(), fetchFmsMarketData(), loadSeasonStats()]);
    if (st.status === 'fulfilled') season = st.value;
    if (rosters.status === 'fulfilled') teams = rosters.value;
    else error = 'Impossibile leggere le rose dal database.';
    if (mk.status === 'fulfilled') market = mk.value;
    else marketError = 'Report mercato FMS non disponibile: crediti non calcolabili.';
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ADMIN" isLive={false} />
      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700">
          <ArrowLeft size={16} /> Pannello
        </Link>
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Wallet size={22} className="text-emerald-600" />
          Rose e crediti
        </h2>
        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <>
            <div className="space-y-2">
              {teams.map((t) => (
                <TeamCard key={t.id} team={t} market={market} stats={season?.stats ?? null} />
              ))}
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              {marketError && <p className="text-amber-700">{marketError}</p>}
              {season ? (
                <p>
                  Statistiche su {season.rounds.length} giornat{season.rounds.length === 1 ? 'a' : 'e'} FantaLive ({season.rounds.join(', ')}),
                  voti consolidati: pres = presenze con voto Gazzetta (s.v. non conta) · MV = media voto Gazzetta · FM = fantamedia
                  (voto Gazzetta + bonus/malus).
                </p>
              ) : (
                <p className="text-amber-700">Voti stagionali non disponibili.</p>
              )}
              <p>
                Crediti: FMS li mostra solo per la squadra collegata ({market?.signedUser?.teamName ?? '—'}). Per le altre è una
                stima: 60 crediti di mercato meno le operazioni aggiudicate su FMS (prestito a costo fisso 10).
              </p>
              <p>Prezzi: solo per gli acquisti di mercato; il prezzo d&apos;asta non è disponibile (—).</p>
              {market && (
                <p>
                  Sessioni lette: {market.sessions.join(', ') || 'nessuna'} · aggiornato {formatDate(market.fetchedAt)}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
