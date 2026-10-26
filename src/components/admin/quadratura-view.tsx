'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuadMatch, QuadNumbers, QuadPlayerRow, QuadPlayerSide, QuadTeam, Quadratura } from '@/lib/quadratura-server';

const fmt = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '–' : n.toLocaleString('it-IT', { maximumFractionDigits: 3 }));
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
const STATE_LABEL: Record<QuadPlayerSide['state'], string> = { conta: 'titolare', entrato: 'entrato', uscito: 'uscito', panchina: 'panchina', tribuna: 'tribuna' };

function formatRome(iso: string) {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

async function fetchQuadratura(round: number, refresh: boolean): Promise<{ data: Quadratura | null; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/quadratura?round=${round}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
    const json = await res.json();
    if (!json.success) return { data: null, error: json.error ?? 'Errore' };
    return { data: json.data, error: json.data.error ?? null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' };
  }
}

export function QuadraturaView({ round }: { round: number }) {
  const [data, setData] = useState<Quadratura | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((r: { data: Quadratura | null; error: string | null }) => {
    if (r.data) setData(r.data);
    setError(r.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchQuadratura(round, false).then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [round, apply]);

  const load = (refresh: boolean) => fetchQuadratura(round, refresh).then(apply);

  const okCount = data?.matches.filter((m) => m.ok).length ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
        <div className="text-gray-600">
          {data?.fetchedAt ? <>Tabellini FMS letti alle {formatRome(data.fetchedAt)}{data.cached ? ' (cache)' : ''}</> : 'Tabellini FMS non ancora letti'}
          {data && data.matches.length > 0 && <> · <b className="text-gray-900">{okCount}/{data.matches.length}</b> sfide quadrano</>}
        </div>
        <button type="button" onClick={() => { setLoading(true); setError(null); void load(true); }} disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-emerald-50 disabled:opacity-50">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Ricarica da FMS
        </button>
      </div>
      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
      {loading && !data && <div className="p-6 text-center text-sm text-gray-500">Lettura dei tabellini FMS…</div>}
      {data?.matches.map((m) => <MatchCard key={`${m.home.team}-${m.away.team}`} m={m} />)}
      <p className="text-xs text-gray-400">Sola lettura su FMS Revo: login e lettura dei tabellini, nessun invio di formazioni o altri dati.</p>
    </div>
  );
}

function Badge({ ok, sameResult }: { ok: boolean; sameResult: boolean }) {
  if (ok) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">OK</span>;
  return sameResult
    ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Totali diversi</span>
    : <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">Risultato diverso</span>;
}

function MatchCard({ m }: { m: QuadMatch }) {
  const [open, setOpen] = useState(!m.ok);
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-3 text-left">
        {open ? <ChevronDown size={16} className="shrink-0 text-gray-400" /> : <ChevronRight size={16} className="shrink-0 text-gray-400" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900">{m.home.team} – {m.away.team}</div>
          <div className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-gray-600">
            <span className="text-gray-400">FantaLive</span>
            <span><b className="text-gray-900">{m.home.ours.goals}-{m.away.ours.goals}</b> · {fmt(m.home.ours.total)} – {fmt(m.away.ours.total)}</span>
            <span className="text-gray-400">FMS</span>
            <span><b className="text-gray-900">{m.home.fms.goals}-{m.away.fms.goals}</b> · {fmt(m.home.fms.total)} – {fmt(m.away.fms.total)}</span>
          </div>
        </div>
        <Badge ok={m.ok} sameResult={m.sameResult} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-gray-100 p-3">
          <TeamDetail t={m.home} />
          <TeamDetail t={m.away} />
        </div>
      )}
    </div>
  );
}

const NUM_ROWS: [keyof QuadNumbers, string][] = [
  ['partial', 'Parziale (somma fantavoti)'], ['home', 'Fattore campo'], ['def', 'Mod. difesa'],
  ['mid', 'Mod. centrocampo'], ['att', 'Mod. attacco'], ['total', 'Totale'], ['goals', 'Gol'],
];

function TeamDetail({ t }: { t: QuadTeam }) {
  const diffs = t.players.filter((p) => p.diff.length > 0).length;
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-gray-900">{t.team}{diffs > 0 && <span className="ml-2 font-normal text-amber-700">{diffs} giocatori diversi</span>}</h3>
      <table className="mb-3 w-full text-sm">
        <thead><tr className="text-xs text-gray-400"><th className="text-left font-normal">Voce</th><th className="text-right font-normal">FantaLive</th><th className="text-right font-normal">FMS</th><th className="text-right font-normal">Diff</th></tr></thead>
        <tbody>
          {NUM_ROWS.map(([k, label]) => {
            const d = Math.round((t.ours[k] - t.fms[k]) * 1000) / 1000;
            const bad = Math.abs(d) >= 0.0015;
            return (
              <tr key={k} className={cn('border-t border-gray-100', bad && 'bg-amber-50', k === 'total' && 'font-semibold')}>
                <td className="py-1 text-gray-700">{label}</td>
                <td className="py-1 pl-3 text-right tabular-nums">{fmt(t.ours[k])}</td>
                <td className="py-1 pl-3 text-right tabular-nums">{fmt(t.fms[k])}</td>
                <td className={cn('py-1 pl-3 text-right tabular-nums', bad ? 'font-semibold text-amber-800' : 'text-gray-300')}>{bad ? signed(d) : '='}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left font-normal" rowSpan={2}>Giocatore</th>
              <th className="border-l border-gray-100 text-center font-normal" colSpan={4}>FantaLive</th>
              <th className="border-l border-gray-100 text-center font-normal" colSpan={4}>FMS</th>
            </tr>
            <tr className="text-gray-400">
              {['Voto', 'Bonus', 'FV', 'Stato', 'Voto', 'Bonus', 'FV', 'Stato'].map((h, i) => (
                <th key={i} className={cn('px-1 text-right font-normal', i % 4 === 0 && 'border-l border-gray-100')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{t.players.map((p, i) => <PlayerRow key={`${p.name}-${i}`} p={p} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Cells({ s, row, side }: { s: QuadPlayerSide | null; row: QuadPlayerRow; side: 'ours' | 'fms' }) {
  const hl = (field: string) => row.diff.includes(field) && 'bg-amber-100 font-semibold text-amber-900';
  if (!s) return <td colSpan={4} className="border-l border-gray-100 px-1 text-center italic text-rose-600">{side === 'ours' ? 'non in rosa/formazione' : 'assente su FMS'}</td>;
  return (
    <>
      <td className={cn('border-l border-gray-100 px-1 text-right tabular-nums', hl('voto'))}>{s.vote === null ? 's.v.' : fmt(s.vote)}</td>
      <td className={cn('px-1 text-right tabular-nums', hl('bonus'))}>{s.bonus === null ? '–' : signed(s.bonus)}</td>
      <td className={cn('px-1 text-right tabular-nums', hl('fantavoto'))}>{fmt(s.fantavoto)}</td>
      <td className={cn('px-1 text-right', hl('sostituzione'), (s.state === 'panchina' || s.state === 'tribuna') && 'text-gray-400')}>{STATE_LABEL[s.state]}</td>
    </>
  );
}

function PlayerRow({ p }: { p: QuadPlayerRow }) {
  const inactive = (p.ours?.state ?? p.fms?.state) === 'panchina' || (p.ours?.state ?? p.fms?.state) === 'tribuna';
  return (
    <Fragment>
      <tr className={cn('border-t border-gray-100', p.diff.length > 0 && 'bg-amber-50/60', inactive && p.diff.length === 0 && 'text-gray-400')}>
        <td className="py-1 pr-2">
          <span className="mr-1 inline-block w-4 font-semibold text-gray-400">{p.role ?? '·'}</span>{p.name}
        </td>
        <Cells s={p.ours} row={p} side="ours" />
        <Cells s={p.fms} row={p} side="fms" />
      </tr>
    </Fragment>
  );
}
