'use client';

import { cn, formatNumber, formatSignedPoints, formatVote } from '@/lib/utils';
import {
  ATTACK_MODIFIER_TABLE,
  DEFENSE_MODIFIER_TABLE,
  MIDFIELD_MODIFIER_TABLE,
} from '@/lib/scoring-engine';
import { getTeamById } from '@/data/teams';
import type { ModifierDetails, ModifierVoteInput } from '@/types';

export type ModifierKind = 'defense' | 'midfield' | 'attack' | 'home';

export const MODIFIER_TITLES: Record<ModifierKind, string> = {
  defense: 'Modificatore difesa avversaria',
  midfield: 'Modificatore centrocampo',
  attack: 'Modificatore attacco',
  home: 'Fattore campo',
};

const signed = formatSignedPoints;
const vote = (n: number) => formatVote(n, { integerWithoutDecimals: true });
const teamName = (id: string) => getTeamById(id)?.name ?? id;

function Result({ value }: { value: number }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
      <span className="font-medium text-gray-700">Risultato</span>
      <span className={cn('font-bold', value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-900')}>
        {signed(value)}
      </span>
    </div>
  );
}

function VoteList({ inputs, label }: { inputs: ModifierVoteInput[]; label?: string }) {
  return (
    <div>
      {label && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>}
      <ul className="divide-y divide-gray-100">
        {inputs.map((input, index) => (
          <li key={input.playerId ?? `pad-${index}`} className="flex justify-between py-1.5">
            <span className={cn('truncate', input.padded && 'italic text-gray-400')}>
              {input.padded ? 'Mancante o da giocare' : input.name ?? '—'}
              {input.riserva && <span className="text-gray-400"> (riserva d&apos;ufficio)</span>}
              {!input.padded && !input.riserva && input.vote === 0 && <span className="text-gray-400"> (s.v.)</span>}
            </span>
            <span className="tabular-nums text-gray-900">
              {input.usedVote !== input.vote || input.padded ? `${vote(input.usedVote)}*` : vote(input.usedVote)}
            </span>
          </li>
        ))}
      </ul>
      {inputs.some((i) => i.usedVote !== i.vote || i.padded) && (
        <p className="mt-1 text-xs text-gray-400">* s.v., riserva d&apos;ufficio o giocatore mancante contano 5</p>
      )}
    </div>
  );
}

function Table({ rows }: { rows: Array<{ label: string; value: string; active: boolean }> }) {
  return (
    <table className="mt-3 w-full text-xs">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className={cn(row.active ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-500')}>
            <td className="px-2 py-1 rounded-l-md">{row.label}</td>
            <td className="px-2 py-1 text-right rounded-r-md tabular-nums">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ModifierExplanation({ kind, details }: { kind: ModifierKind; details: ModifierDetails }) {
  if (kind === 'defense') {
    const d = details.opponentDefense;
    const rows = DEFENSE_MODIFIER_TABLE.map((entry, index) => {
      const prev = DEFENSE_MODIFIER_TABLE[index - 1];
      const min = prev ? Math.round((prev.maxAvg + 0.01) * 100) / 100 : 0;
      const label =
        entry.maxAvg === Infinity ? `da ${formatNumber(min, 2)}` : `${formatNumber(min, 2)} – ${formatNumber(entry.maxAvg, 2)}`;
      return { label, value: signed(entry.modifier), active: d.band?.maxAvg === entry.maxAvg };
    });
    return (
      <div className="space-y-2">
        <p>
          Media voto dei difensori di <strong>{teamName(d.teamId)}</strong>: più alta è, più punti ti toglie.
        </p>
        {d.inputs.length === 0 ? (
          <p className="text-gray-400">Nessun difensore con voto: modificatore 0.</p>
        ) : (
          <>
            <VoteList inputs={d.inputs} />
            <div className="flex justify-between pt-1">
              <span>Media ({d.inputs.length} difensori)</span>
              <span className="font-semibold tabular-nums">{formatNumber(d.average ?? 0, 2)}</span>
            </div>
            <Table rows={rows} />
            {d.formationAdjustment !== 0 && (
              <div className="flex justify-between pt-1">
                <span>Correzione modulo ({d.numDefenders} difensori)</span>
                <span className="font-semibold">{signed(d.formationAdjustment)}</span>
              </div>
            )}
          </>
        )}
        <Result value={d.modifier} />
      </div>
    );
  }

  if (kind === 'midfield') {
    const m = details.midfield;
    const mine = details.isHome ? m.homeModifier : m.awayModifier;
    const rows = MIDFIELD_MODIFIER_TABLE.map((entry, index) => {
      const next = MIDFIELD_MODIFIER_TABLE[index + 1];
      return {
        label: next ? `${formatNumber(entry.minDiff, 2)} – ${formatNumber(next.minDiff - 0.01, 2)}` : `da ${formatNumber(entry.minDiff, 2)}`,
        value: `±${formatVote(entry.bonus, { integerWithoutDecimals: true })}`,
        active: entry.minDiff === m.band.minDiff,
      };
    });
    return (
      <div className="space-y-3">
        <p>Somma dei voti dei centrocampisti delle due squadre: chi ha la somma più alta prende il bonus, l&apos;altra il malus.</p>
        <VoteList inputs={m.homeInputs} label={`Casa · somma ${vote(m.homeTotal)}`} />
        <VoteList inputs={m.awayInputs} label={`Trasferta · somma ${vote(m.awayTotal)}`} />
        <div className="flex justify-between">
          <span>Differenza</span>
          <span className="font-semibold tabular-nums">{formatNumber(m.diff, 2)}</span>
        </div>
        <Table rows={rows} />
        <Result value={mine} />
      </div>
    );
  }

  if (kind === 'attack') {
    const a = details.attack;
    const rows = ATTACK_MODIFIER_TABLE.map((entry) => ({
      label: `voto ≥ ${vote(entry.vote)}`,
      value: signed(entry.bonus),
      active: a.entries.some((e) => e.minVote === entry.vote),
    }));
    return (
      <div className="space-y-2">
        <p>Bonus per ogni attaccante schierato che <strong>non ha segnato</strong>, in base al suo voto.</p>
        {a.entries.length === 0 ? (
          <p className="text-gray-400">Nessun attaccante con voto.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {a.entries.map((entry) => (
              <li key={entry.playerId ?? entry.name} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate">
                  {entry.name}{' '}
                  <span className="text-gray-400">
                    · voto {vote(entry.vote)}
                    {entry.scored ? ' · ha segnato, escluso' : entry.minVote === null ? ' · sotto 6,5' : ''}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{signed(entry.bonus)}</span>
              </li>
            ))}
          </ul>
        )}
        <Table rows={rows} />
        <Result value={a.modifier} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p>La squadra che gioca in casa riceve sempre {signed(details.homeBonus || 2)} punti.</p>
      <Result value={details.homeBonus} />
    </div>
  );
}
