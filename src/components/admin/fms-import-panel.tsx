'use client';

import { useState } from 'react';
import { Download, Loader2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FmsImportPreview, FmsVoteValues } from '@/lib/fms-vote-import';

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? 's.v.' : n.toLocaleString('it-IT', { maximumFractionDigits: 3 }));
const vv = (v: FmsVoteValues) => (v.vote === null ? 's.v.' : `${fmt(v.vote)} ${v.bonus ? (v.bonus > 0 ? '+' : '') + fmt(v.bonus) : ''} = ${fmt(v.fantavoto)}`);
const score = (g: [number, number]) => `${g[0]}-${g[1]}`;

type Step = 'idle' | 'loading' | 'preview' | 'saving' | 'done';

async function call<T>(url: string, init?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init });
    const json = await res.json();
    return json.success ? { data: json.data as T, error: null } : { data: null, error: json.error ?? 'Errore' };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' };
  }
}

export function FmsImportPanel({ round, onChanged }: { round: number; onChanged?: () => void }) {
  const [step, setStep] = useState<Step>('idle');
  const [preview, setPreview] = useState<FmsImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    setStep('loading'); setError(null); setMessage(null);
    const r = await call<FmsImportPreview>(`/api/admin/quadratura/fms-import?round=${round}`);
    if (r.data) {
      setPreview(r.data);
      setSelected(new Set(r.data.items.map((i) => i.playerId)));
      setError(r.data.error);
    } else setError(r.error);
    setStep(r.data ? 'preview' : 'idle');
  };

  const confirm = async () => {
    setStep('saving'); setError(null);
    const r = await call<{ saved: number }>('/api/admin/quadratura/fms-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ round, playerIds: [...selected] }),
    });
    if (r.data) { setMessage(`Salvati ${r.data.saved} voti FMS: la giornata è ricalcolata.`); setStep('done'); onChanged?.(); }
    else { setError(r.error); setStep('preview'); }
  };

  const undo = async () => {
    if (!window.confirm(`Annullare l'import FMS della giornata ${round}?`)) return;
    setStep('saving'); setError(null);
    const r = await call<{ removed: number; restored: number }>(`/api/admin/quadratura/fms-import?round=${round}`, { method: 'DELETE' });
    if (r.data) { setMessage(`Import annullato: tolte ${r.data.removed} righe FMS, ripristinate ${r.data.restored}.`); setStep('idle'); setPreview(null); onChanged?.(); }
    else { setError(r.error); setStep('preview'); }
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const items = preview?.items ?? [];
  const allOn = items.length > 0 && items.every((i) => selected.has(i.playerId));

  return (
    <div className="rounded-lg border border-indigo-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b className="text-gray-900">Importa voti FMS</b>
          <span className="ml-2 text-gray-500">i voti FMS diventano i voti ufficiali (fonte &quot;fms&quot;, prevalgono su pianetafanta/live)</span>
          {preview && preview.imported > 0 && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800">{preview.imported} voti FMS già importati</span>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadPreview()} disabled={step === 'loading' || step === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50">
            {step === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Anteprima import
          </button>
          <button type="button" onClick={() => void undo()} disabled={step === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Undo2 size={15} /> Annulla import
          </button>
        </div>
      </div>
      {error && <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">{error}</div>}
      {message && <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">{message}</div>}
      {preview && step !== 'idle' && (
        <div className="mt-3 space-y-3">
          {preview.outcomes.length > 0 && (
            <table className="w-full text-xs">
              <thead className="text-left text-gray-500"><tr><th className="py-1">Sfida</th><th>Ora</th><th>Dopo import</th><th>FMS</th><th /></tr></thead>
              <tbody>
                {preview.outcomes.map((o) => (
                  <tr key={o.matchKey} className={cn('border-t border-gray-100', o.flips && 'bg-amber-50 font-semibold')}>
                    <td className="py-1">{o.home} – {o.away}</td>
                    <td>{score(o.current.goals)} <span className="text-gray-400">({fmt(o.current.totals[0])}–{fmt(o.current.totals[1])})</span></td>
                    <td>{score(o.after.goals)} <span className="text-gray-400">({fmt(o.after.totals[0])}–{fmt(o.after.totals[1])})</span></td>
                    <td>{score(o.fms.goals)} <span className="text-gray-400">({fmt(o.fms.totals[0])}–{fmt(o.fms.totals[1])})</span></td>
                    <td>{o.flips ? <span className="text-amber-700">cambia risultato</span> : ''}{o.matchesFms ? ' ✓' : ' ≠ FMS'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {items.length === 0 ? <div className="text-gray-500">Nessuna differenza di voto o bonus tra FantaLive e FMS.</div> : (
            <table className="w-full text-xs">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1"><input type="checkbox" aria-label="Tutti" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(items.map((i) => i.playerId)))} /></th>
                  <th>Giocatore</th><th>Squadra</th><th>FantaLive</th><th>FMS</th><th>Diff.</th><th>Eventi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.playerId} className="border-t border-gray-100">
                    <td className="py-1"><input type="checkbox" aria-label={i.name} checked={selected.has(i.playerId)} onChange={() => toggle(i.playerId)} /></td>
                    <td><span className="text-gray-400">{i.role}</span> {i.name}</td>
                    <td className="text-gray-600">{i.team}</td>
                    <td>{vv(i.ours)} <span className="text-gray-400">{i.ours.source ?? ''}</span></td>
                    <td className="font-medium">{vv(i.fms)}</td>
                    <td className="text-amber-700">{i.diff.join(', ')}</td>
                    <td className="text-gray-600">{i.eventChanges.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {items.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-gray-500">{selected.size}/{items.length} selezionati</span>
              <button type="button" onClick={() => void confirm()} disabled={step === 'saving' || selected.size === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {step === 'saving' && <Loader2 size={15} className="animate-spin" />} Conferma
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
