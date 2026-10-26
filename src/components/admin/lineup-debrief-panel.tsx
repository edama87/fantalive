'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, Loader2, RefreshCw } from 'lucide-react';
import type { DebriefFinding, DebriefPlayer, DebriefScenario, LineupDebrief, ScenarioKey } from '@/lib/lineup-debrief';
import { shortName } from '@/lib/player-name';
import { cn } from '@/lib/utils';

const ORDER: ScenarioKey[] = ['suggested', 'actual', 'best'];
const OUTCOME = {
  V: { label: 'Vittoria', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  N: { label: 'Pareggio', cls: 'bg-gray-50 text-gray-700 ring-gray-200' },
  P: { label: 'Sconfitta', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
} as const;
const KIND_LABEL: Record<DebriefFinding['kind'], string> = {
  sv: 'Senza voto',
  wrong_pick: 'Scelte',
  modifier: 'Modificatori',
  bench_order: 'Ordine panchina',
  points_lost: 'Punti persi',
  info: 'Note',
};
const KIND_ORDER: DebriefFinding['kind'][] = ['points_lost', 'sv', 'wrong_pick', 'bench_order', 'modifier', 'info'];

const num = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
const sgn = (n: number) => `${n > 0 ? '+' : ''}${num(n)}`;

function formatRome(iso: string) {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function PlayerRow({ p }: { p: DebriefPlayer }) {
  return (
    <li className={cn('flex items-center gap-2 py-0.5 text-xs', !p.counted && 'text-gray-400')}>
      <span className="w-3 shrink-0 font-semibold text-gray-400">{p.role}</span>
      <span className={cn('min-w-0 flex-1 truncate', p.counted ? 'text-gray-800' : 'line-through decoration-gray-300')}>
        {shortName(p.name)}
        {p.replaces && <span className="ml-1 text-emerald-600 no-underline">↑</span>}
      </span>
      <span className="tabular-nums">{p.fantavoto === null ? 's.v.' : num(p.fantavoto)}</span>
    </li>
  );
}

function ScenarioCard({ sc, best }: { sc: DebriefScenario; best?: DebriefScenario }) {
  const o = OUTCOME[sc.outcome];
  const gap = best && best.key !== sc.key ? best.total - sc.total : null;
  const entered = sc.bench.filter((b) => b.replaces);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900">{sc.label}</div>
        <div className="text-xs text-gray-500">{sc.formation}</div>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="tabular-nums">
          <span className="text-2xl font-bold text-gray-900">{num(sc.total)}</span>
          <span className="text-sm text-gray-500"> – {num(sc.opponentTotal)}</span>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium ring-1', o.cls)}>
          {sc.goalsFor}-{sc.goalsAgainst} · {o.label}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Mod. {sgn(sc.modifiers.total)} (dif {sgn(sc.modifiers.defense)}, cen {sgn(sc.modifiers.midfield)}, att {sgn(sc.modifiers.attack)}
        {sc.modifiers.home ? `, casa ${sgn(sc.modifiers.home)}` : ''})
        {gap !== null && gap > 0 && <span className="text-rose-600"> · −{num(gap)} dalla migliore</span>}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer select-none text-xs text-gray-600">
          Giocatori{entered.length ? ` · ${entered.length} cambi` : ''}
        </summary>
        <ul className="mt-1 divide-y divide-gray-100">
          {sc.starters.map((p) => <PlayerRow key={p.id} p={p} />)}
        </ul>
        {entered.length > 0 && (
          <ul className="mt-1 border-t border-dashed border-gray-200 pt-1">
            {entered.map((p) => <PlayerRow key={p.id} p={p} />)}
          </ul>
        )}
      </details>
    </div>
  );
}

export function DebriefView({ debrief }: { debrief: LineupDebrief }) {
  const scenarios = ORDER.map((k) => debrief.scenarios[k]).filter((s): s is DebriefScenario => !!s);
  const groups = KIND_ORDER.map((k) => [k, debrief.findings.filter((f) => f.kind === k)] as const).filter(([, f]) => f.length);
  return (
    <div className="space-y-3">
      {debrief.warnings.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800" role="status">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Voti non del tutto consolidati: il debrief può cambiare.</div>
            <ul className="mt-0.5 list-disc pl-4">{debrief.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {scenarios.map((sc) => <ScenarioCard key={sc.key} sc={sc} best={debrief.scenarios.best} />)}
      </div>
      <div className="space-y-2">
        {groups.map(([kind, items]) => (
          <div key={kind}>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{KIND_LABEL[kind]}</div>
            <ul className="mt-0.5 space-y-0.5 text-sm text-gray-700">
              {items.map((f, i) => <li key={i} className="leading-snug">{f.text}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">
        {debrief.isHome ? 'In casa' : 'In trasferta'} · generato {formatRome(debrief.generatedAt)}. Migliore possibile: ricerca su tutti i moduli ammessi col motore completo.
      </p>
    </div>
  );
}

export function LineupDebriefPanel({ suggestionId, initial }: { suggestionId: string; initial: LineupDebrief | null }) {
  const [debrief, setDebrief] = useState<LineupDebrief | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/lineup-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? `Errore ${res.status}`);
      setDebrief(json.debrief);
      setNotice(json.notice ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ClipboardCheck size={16} className="text-gray-500" /> Debrief
        </h4>
        <button type="button" onClick={generate} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : debrief ? <RefreshCw size={14} /> : null}
          {debrief ? 'Rigenera debrief' : 'Genera debrief'}
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
      {notice && <p className="mb-2 text-xs text-gray-500">{notice}</p>}
      {debrief ? <DebriefView debrief={debrief} /> : !busy && <p className="text-xs text-gray-500">Calcola, a giornata giocata, consigliata vs schierata vs migliore possibile.</p>}
    </div>
  );
}
