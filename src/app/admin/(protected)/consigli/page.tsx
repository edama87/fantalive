/**
 * Formazione consigliata: suggerimenti scritti dall'assistente via
 * /api/admin/lineup-suggestions, letti lato server con la chiave service role.
 */
import Link from 'next/link';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/auth/admin';
import { ArrowLeft, ExternalLink, Lightbulb } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { SimpleMarkdown } from '@/components/admin/simple-markdown';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { listSuggestions, type LineupSuggestion, type SuggestionPlayer } from '@/lib/lineup-suggestions';
import { cn } from '@/lib/utils';
import { shortName } from '@/lib/player-name';
import { loadDebriefs } from '@/lib/lineup-debrief-server';
import type { LineupDebrief } from '@/lib/lineup-debrief';
import { LineupDebriefPanel } from '@/components/admin/lineup-debrief-panel';

const ROLE_LABEL = { A: 'Attaccanti', C: 'Centrocampisti', D: 'Difensori', P: 'Portiere' } as const;
const ROLE_STYLE = {
  P: 'bg-amber-100 text-amber-800',
  D: 'bg-sky-100 text-sky-800',
  C: 'bg-emerald-100 text-emerald-800',
  A: 'bg-rose-100 text-rose-800',
} as const;
const STATUS_LABEL: Record<string, string> = {
  bozza: 'Bozza',
  proposta: 'Proposta',
  confermata: 'Confermata',
  scartata: 'Scartata',
};

function formatRome(iso: string) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function StartPct({ value }: { value: number | null }) {
  if (value === null) return null;
  const tone = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600" title="Probabilità di titolarità">
      <span className={cn('h-2 w-2 rounded-full', tone)} />
      {Math.round(value)}%
    </span>
  );
}

function PlayerChip({ p, index }: { p: SuggestionPlayer; index?: number }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      {index !== undefined && <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-semibold text-gray-400">{index}</span>}
      {p.role && (
        <span className={cn('mt-0.5 shrink-0 rounded px-1.5 text-xs font-bold', ROLE_STYLE[p.role])}>{p.role}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="truncate font-medium text-gray-900" title={p.name}>{shortName(p.name)}</span>
          <StartPct value={p.startPct} />
          {!p.matched && <span className="text-xs text-rose-600">non abbinato</span>}
        </div>
        <div className="text-xs text-gray-500">
          {[p.realTeam, p.fixture, p.homeAway === 'H' ? 'Casa' : p.homeAway === 'A' ? 'Trasferta' : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {p.note && <div className="mt-0.5 text-xs text-gray-600">{p.note}</div>}
      </div>
    </div>
  );
}

function Pitch({ s }: { s: LineupSuggestion }) {
  const order: (keyof typeof ROLE_LABEL)[] = ['A', 'C', 'D', 'P'];
  const unknown = s.starters.filter((p) => !p.role);
  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-3 space-y-3">
      {order.map((r) => {
        const players = s.starters.filter((p) => p.role === r);
        if (!players.length) return null;
        return (
          <div key={r}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {ROLE_LABEL[r]} ({players.length})
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p) => <PlayerChip key={p.playerId ?? p.name} p={p} />)}
            </div>
          </div>
        );
      })}
      {unknown.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{unknown.map((p) => <PlayerChip key={p.name} p={p} />)}</div>
      )}
    </div>
  );
}

function SuggestionCard({ s, teams, debrief }: { s: LineupSuggestion; teams: Map<string, string>; debrief: LineupDebrief | null }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">{s.formation}</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">{s.variant}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium',
              s.status === 'confermata' ? 'bg-emerald-100 text-emerald-800' : s.status === 'scartata' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-800')}>
              {STATUS_LABEL[s.status] ?? s.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {teams.get(s.teamId) ?? s.teamId}
            {s.opponentTeamId && <> vs <span className="font-medium text-gray-700">{teams.get(s.opponentTeamId) ?? s.opponentTeamId}</span></>}
          </p>
        </div>
        <div className="text-right">
          {s.expectedPoints !== null && (
            <div className="text-sm"><span className="text-gray-500">Punti attesi </span><span className="font-bold text-gray-900">{s.expectedPoints.toLocaleString('it-IT')}</span></div>
          )}
          <div className="text-xs text-gray-500">Aggiornata {formatRome(s.updatedAt)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">Titolari</h4>
          <Pitch s={s} />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">Panchina (in ordine)</h4>
          {s.bench.length ? (
            <ol className="space-y-1.5">{s.bench.map((p, i) => <li key={`${p.name}-${i}`}><PlayerChip p={p} index={i + 1} /></li>)}</ol>
          ) : <p className="text-sm text-gray-500">Nessuna panchina indicata.</p>}
        </div>
      </div>

      {s.rationale && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">Motivazione</h4>
          <div className="rounded-lg bg-gray-50 p-3"><SimpleMarkdown source={s.rationale} /></div>
        </div>
      )}

      {s.alternatives.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">Alternative</h4>
          <ul className="space-y-2">
            {s.alternatives.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-gray-200 p-2 text-sm">
                <span className="font-bold text-gray-900">{a.formation}</span>
                {a.expectedPoints !== null && <span className="text-gray-600">{a.expectedPoints.toLocaleString('it-IT')} punti attesi</span>}
                {a.note && <span className="basis-full text-gray-600 sm:basis-auto">{a.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.sources.length > 0 && (
        <div>
          <h4 className="mb-1 text-sm font-semibold text-gray-900">Fonti</h4>
          <ul className="flex flex-wrap gap-2">
            {s.sources.map((src) => {
              let label = src.label;
              if (!label) { try { label = new URL(src.url).hostname.replace(/^www\./, ''); } catch { label = src.url; } }
              return (
                <li key={src.url}>
                  <a href={src.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50">
                    {label}<ExternalLink size={12} />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <LineupDebriefPanel suggestionId={s.id} initial={debrief} />
    </section>
  );
}

export default async function ConsigliPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  await connection();
  // Il layout protetto renderizza in parallelo alla pagina: il controllo va
  // ripetuto qui, prima di leggere dati, per non servirli nell'HTML del redirect.
  if ((isAdminConfigured() || process.env.NODE_ENV === 'production') && !(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }
  const { round: roundParam } = await searchParams;
  const requested = Number(roundParam);
  let content: React.ReactNode;
  let rounds: number[] = [];
  let current: number | null = null;

  if (!isSupabaseServerConfigured()) {
    content = <p className="text-sm text-rose-600">SUPABASE_SECRET_KEY non configurata.</p>;
  } else {
    const sb = getServerClient();
    const [{ round, suggestions }, { data: teamRows }, { data: roundRows }] = await Promise.all([
      listSuggestions(sb, { round: Number.isInteger(requested) && requested > 0 ? requested : undefined }),
      sb.from('teams').select('id,name'),
      sb.from('lineup_suggestions').select('round_number').eq('team_id', 'ap'),
    ]);
    current = round;
    rounds = [...new Set((roundRows ?? []).map((r) => r.round_number as number))].sort((a, b) => b - a);
    const teams = new Map((teamRows ?? []).map((t) => [t.id as string, t.name as string]));
    const debriefs = await loadDebriefs(sb, suggestions.map((s) => s.id)).catch(() => new Map<string, LineupDebrief>());
    content = suggestions.length ? (
      <div className="space-y-4">
        {suggestions.map((s) => <SuggestionCard key={s.id} s={s} teams={teams} debrief={debriefs.get(s.id) ?? null} />)}
      </div>
    ) : (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        Nessuna formazione consigliata{current ? ` per la giornata ${current}` : ''}.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ADMIN" isLive={false} />
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700">
          <ArrowLeft size={16} /> Pannello
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Lightbulb size={22} className="text-emerald-600" />
            Formazione consigliata{current ? ` · Giornata ${current}` : ''}
          </h2>
          {rounds.length > 1 && (
            <nav className="flex flex-wrap gap-1" aria-label="Giornate">
              {rounds.map((r) => (
                <Link key={r} href={`/admin/consigli?round=${r}`}
                  className={cn('rounded-full px-3 py-1 text-sm', r === current ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50')}>
                  G{r}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {content}
      </div>
    </div>
  );
}
