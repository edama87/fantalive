'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { SubMarker } from '@/components/match/sub-marker';
import { EVENT_EMOJI, EventEmojis, EventIcon } from '@/components/match/event-emoji';
import { ConsolidatedMark, CONSOLIDATED_TITLE, ESTIMATED_TITLE } from '@/components/match/vote-source';
import { cn, formatSignedPoints, formatVote } from '@/lib/utils';
import type { SerieAVoteRow } from '@/lib/serie-a-vote-rows';

const ROLE_LABELS: Record<string, string> = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
const fmtVote = (value: number | null) => (value == null ? 's.v.' : formatVote(value));
const signed = formatSignedPoints;

export interface OwnerBadgeInfo {
  code: string;
  name: string;
  status: 'starter' | 'bench' | 'out';
}

const OWNER_TITLE = { starter: 'titolare', bench: 'in panchina', out: 'non convocato' } as const;

/** Stessa convenzione di "Partite da seguire": verde titolare, grigio panchina, attenuato tribuna. */
function OwnerBadge({ owner }: { owner: OwnerBadgeInfo }) {
  return (
    <span
      title={`${owner.name} · ${OWNER_TITLE[owner.status]}`}
      className={cn(
        'inline-block max-w-full truncate whitespace-nowrap rounded-md px-1.5 py-0.5 align-top text-[10px] leading-3',
        owner.status === 'starter' && 'bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-emerald-100',
        owner.status === 'bench' && 'bg-gray-100 text-gray-600',
        owner.status === 'out' && 'bg-gray-50 text-gray-400',
      )}
    >
      {owner.name}
    </span>
  );
}

/** `matchPapers`: testate uscite per la partita (3 = consolidato completo). */
export function TeamVotes({ title, rows, matchPapers, owners }: { title: string; rows: SerieAVoteRow[]; matchPapers?: number; owners?: Record<string, OwnerBadgeInfo> }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = rows.find((row) => row.key === openKey) ?? null;

  return (
    <Card>
      <CardContent className="py-3">
        <div className="font-semibold text-gray-900 pb-2 border-b border-gray-100">{title}</div>
        {rows.length === 0 && <p className="text-sm text-gray-400 pt-2">Nessun voto</p>}
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <li key={row.key} className={cn(row.subIn && 'pl-3 border-l-2 border-emerald-200')}>
              <button
                type="button"
                onClick={() => setOpenKey(row.key)}
                aria-haspopup="dialog"
                className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-gray-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 rounded-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-semibold text-gray-500">
                      {row.role ?? '–'}
                    </span>
                    <span className="font-medium text-gray-900">{row.name}</span>
                    <EventEmojis bonuses={row.bonuses} />
                  </div>
                  {owners?.[row.key] && (
                    <div className="mt-0.5 flex min-w-0 pl-7">
                      <OwnerBadge owner={owners[row.key]} />
                    </div>
                  )}
                  {row.consolidated && row.vote != null && (
                    <div className="mt-0.5 pl-7 text-[11px] text-gray-400 tabular-nums">
                      G {fmtVote(row.consolidated.gazzetta)} · CS {fmtVote(row.consolidated.corriere)} · TS{' '}
                      {fmtVote(row.consolidated.tuttosport)}
                    </div>
                  )}
                  {(row.subIn || row.subOut) && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 pl-7 text-xs">
                      {row.subIn && <SubMarker kind="in" minute={row.subIn.minute} partner={row.subIn.for} />}
                      {row.subOut && <SubMarker kind="out" minute={row.subOut.minute} partner={row.subOut.by} />}
                    </div>
                  )}
                </div>
                <div
                  className="flex shrink-0 items-center gap-2 text-right"
                  title={row.consolidated ? CONSOLIDATED_TITLE : row.estimated ? ESTIMATED_TITLE : undefined}
                >
                  <div className="w-4">{row.consolidated && row.vote != null && <ConsolidatedMark papers={matchPapers} />}</div>
                  <div className="w-11">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Voto</div>
                    <div className={cn('font-semibold text-gray-700 tabular-nums', row.estimated && 'italic')}>
                      {fmtVote(row.vote)}
                    </div>
                  </div>
                  <div className="w-11">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">FV</div>
                    <div className={cn('font-bold text-gray-900 tabular-nums', row.estimated && 'italic')}>
                      {row.fantaVote != null ? formatVote(row.fantaVote) : '–'}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300" aria-hidden />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
      <Sheet open={open !== null} onClose={() => setOpenKey(null)} title={open ? open.name : ''}>
        {open && <PlayerVoteDetail row={open} matchPapers={matchPapers} />}
      </Sheet>
    </Card>
  );
}

function PlayerVoteDetail({ row, matchPapers }: { row: SerieAVoteRow; matchPapers?: number }) {
  const events = EVENT_EMOJI.filter((entry) => (row.bonuses[entry.key] ?? 0) > 0);
  const eventPoints = (entry: (typeof EVENT_EMOJI)[number]) =>
    Number(entry.points.replace(',', '.')) * (row.bonuses[entry.key] ?? 0);
  // Somma dei bonus/malus (non FV - voto: il FV è arrotondato a un decimale).
  const bonusTotal = row.fantaVote != null ? events.reduce((sum, entry) => sum + eventPoints(entry), 0) : null;

  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>
          {row.role ? ROLE_LABELS[row.role] ?? row.role : 'Ruolo n.d.'} · {row.team}
        </span>
        {row.consolidated ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            <ConsolidatedMark papers={matchPapers} /> Voto consolidato{matchPapers != null ? ` · ${matchPapers}/3 testate` : ''}
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 italic text-gray-500">
            {row.vote != null ? 'Voto stimato · fantacalcio.it / live' : 'Senza voto'}
          </span>
        )}
      </div>

      {row.consolidated ? (
        <div className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              ['Gazzetta', row.consolidated.gazzetta],
              ['Corriere', row.consolidated.corriere],
              ['Tuttosport', row.consolidated.tuttosport],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 px-1 py-2">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
              <div className={cn('text-base font-semibold tabular-nums', value == null ? 'text-gray-400' : 'text-gray-800')}>
                {fmtVote(value)}
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-emerald-50 px-1 py-2">
            <div className="text-[10px] uppercase tracking-wide text-emerald-700">Media</div>
            <div className="text-base font-bold text-emerald-800 tabular-nums">{fmtVote(row.vote)}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-gray-500">Voto stimato</span>
            <span className="text-base font-semibold italic text-gray-800 tabular-nums">{fmtVote(row.vote)}</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Dal voto fantacalcio.it e dai dati live. Diventa definitivo quando importiamo i voti di Gazzetta, Corriere e
            Tuttosport.
          </p>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Bonus e malus</div>
        {events.length === 0 ? (
          <p className="text-gray-400">Nessuno</p>
        ) : (
          <ul className="space-y-1">
            {events.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between">
                <span>
                  <span aria-hidden className="mr-1.5"><EventIcon eventKey={entry.key} emoji={entry.emoji} /></span>
                  {entry.label}
                  {row.bonuses[entry.key] > 1 && <span className="text-gray-400"> ×{row.bonuses[entry.key]}</span>}
                </span>
                <span className={cn('tabular-nums font-medium', entry.points.startsWith('-') ? 'text-red-600' : 'text-emerald-600')}>
                  {signed(eventPoints(entry))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-100 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-gray-400">Fantavoto</dt>
          <dd className={cn('text-lg font-bold text-gray-900 tabular-nums', row.estimated && 'italic')}>
            {row.fantaVote != null ? formatVote(row.fantaVote) : '–'}
            {bonusTotal != null && bonusTotal !== 0 && (
              <span className="ml-1.5 text-xs font-normal text-gray-400">({signed(bonusTotal)})</span>
            )}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-gray-400">Minuti</dt>
          <dd className="text-lg font-bold text-gray-900 tabular-nums">
            {row.minutesPlayed != null ? `${row.minutesPlayed}′` : '–'}
          </dd>
          {(row.subIn || row.subOut) && (
            <div className="flex flex-wrap gap-x-2 text-xs">
              {row.subIn && <SubMarker kind="in" minute={row.subIn.minute} partner={row.subIn.for} />}
              {row.subOut && <SubMarker kind="out" minute={row.subOut.minute} partner={row.subOut.by} />}
            </div>
          )}
        </div>
      </dl>

      {row.consolidated && row.fantacalcioVote != null && row.fantacalcioVote !== row.vote && (
        <p className="text-xs text-gray-400">Voto fantacalcio.it (stima precedente): {formatVote(row.fantacalcioVote)}</p>
      )}
    </div>
  );
}
