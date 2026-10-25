'use client';

import { useMemo, useState } from 'react';
import { Check, Link2, Loader2, Search } from 'lucide-react';

/** Come normalizePlayerName, senza importare lo scraper (cheerio) nel bundle client. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`.]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const teamCode = (value: string | null | undefined) => (value ? value.trim().toUpperCase() : null);

export interface RosterOption {
  id: string;
  name: string;
  role: string | null;
  realTeam: string | null;
  fantaTeam: string | null;
}

export interface UnmatchedRow {
  name: string;
  team: string;
  teamCode: string | null;
  role: string | null;
  average: number | null;
  votes: { gazzetta: number | null; corriere: number | null; tuttosport: number | null };
  voteCount: number;
  suggestion: { id: string; name: string } | null;
}

export function VoteChips({ votes }: { votes: UnmatchedRow['votes'] }) {
  const items: Array<[string, number | null]> = [
    ['G', votes.gazzetta],
    ['CS', votes.corriere],
    ['TS', votes.tuttosport],
  ];
  return (
    <span className="inline-flex gap-1">
      {items.map(([label, value]) => (
        <span
          key={label}
          className={`rounded px-1 tabular-nums ${value == null ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}
        >
          {label} {value == null ? '—' : String(value).replace('.', ',')}
        </span>
      ))}
    </span>
  );
}

/** Riga non abbinata: scegli il giocatore in rosa e salva l'alias pianetafanta. */
export function UnmatchedPicker({
  row,
  roster,
  onSave,
}: {
  row: UnmatchedRow;
  roster: RosterOption[] | null;
  onSave: (row: UnmatchedRow, player: RosterOption) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allClubs, setAllClubs] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const clubCode = row.teamCode ?? teamCode(row.team);

  const options = useMemo(() => {
    if (!roster) return [];
    const q = normalize(query);
    const filtered = roster.filter((player) => {
      if (q) return normalize(player.name).includes(q);
      if (allClubs) return !row.role || player.role === row.role;
      return teamCode(player.realTeam) === clubCode && (!row.role || player.role === row.role);
    });
    const suggested = row.suggestion?.id;
    return filtered
      .sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested) || a.name.localeCompare(b.name))
      .slice(0, 30);
  }, [roster, query, allClubs, clubCode, row.role, row.suggestion]);

  const choose = async (player: RosterOption) => {
    setSaving(player.id);
    const ok = await onSave(row, player);
    setSaving(null);
    if (ok) {
      setSaved(player.name);
      setOpen(false);
    }
  };

  return (
    <li className={`rounded-md px-2 py-1.5 ${row.voteCount > 0 && row.voteCount < 3 ? 'bg-amber-50' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-medium text-gray-800">
            {row.name} <span className="font-normal text-gray-400">{row.role ?? ''} · {clubCode}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            <VoteChips votes={row.votes} />
            <span className="text-gray-500">media {row.average == null ? 's.v.' : String(row.average).replace('.', ',')}</span>
          </span>
        </span>
        {saved ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-emerald-700">
            <Check size={14} aria-hidden /> {saved}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-600 px-2 py-1 font-medium text-emerald-700"
          >
            <Link2 size={13} aria-hidden /> Associa
          </button>
        )}
      </div>
      {row.suggestion && !saved && (
        <p className="mt-1 text-amber-800">Forse è {row.suggestion.name} (club diverso in anagrafica)</p>
      )}
      {open && !saved && (
        <div className="mt-2 space-y-1.5">
          <label className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5">
            <Search size={13} className="text-gray-400" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca giocatore in rosa"
              aria-label={`Cerca giocatore per ${row.name}`}
              className="w-full bg-transparent text-xs outline-none"
            />
          </label>
          {!query && (
            <label className="flex items-center gap-1.5 text-gray-500">
              <input type="checkbox" checked={allClubs} onChange={(event) => setAllClubs(event.target.checked)} />
              Tutti i club {row.role ? `(ruolo ${row.role})` : ''}
            </label>
          )}
          {roster == null ? (
            <p className="flex items-center gap-1 text-gray-500">
              <Loader2 size={13} className="animate-spin" aria-hidden /> Carico le rose…
            </p>
          ) : options.length === 0 ? (
            <p className="text-gray-500">
              Nessun giocatore in rosa {query ? 'con questo nome' : `del ${clubCode}${row.role ? ` con ruolo ${row.role}` : ''}`}: se
              non è di nessuno puoi ignorarlo.
            </p>
          ) : (
            <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 bg-white">
              {options.map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    disabled={saving != null}
                    onClick={() => choose(player)}
                    className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <span className="truncate text-gray-800">
                      {player.name}{' '}
                      <span className="text-gray-400">
                        {player.role} · {teamCode(player.realTeam) ?? '—'}
                      </span>
                    </span>
                    <span className="shrink-0 text-gray-500">
                      {saving === player.id ? <Loader2 size={13} className="animate-spin" /> : (player.fantaTeam ?? '')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
