'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calendar, getCurrentRound } from '@/data/calendar';
import { formatVote } from '@/lib/utils';
import { PianetafantaUpload } from './pianetafanta-upload';
import { AutoImportStatus } from './auto-import-status';
import { ConsolidatedVotesAdmin } from '@/components/admin/consolidated-votes-admin';
import { Download, Loader2 } from 'lucide-react';

interface PreviewPlayer {
  matchId: string;
  team: string;
  name: string;
  role: string | null;
  vote: number | null;
  fantaVote: number | null;
  bonuses: Array<{ label: string; count: number }>;
  playerId: string | null;
  matchedName: string | null;
}

interface PreviewMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
}

interface PreviewResponse {
  success: boolean;
  error?: string;
  roundNumber?: number;
  serieAMatchday?: number;
  matches?: PreviewMatch[];
  players?: PreviewPlayer[];
  unmatched?: Array<{ name: string; team: string; role: string | null; vote: number | null }>;
}

export default function AdminVotiPage() {
  const [roundNumber, setRoundNumber] = useState(() => getCurrentRound().number);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const response = await fetch('/api/admin/voti/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundNumber }),
      });
      const data = (await response.json()) as PreviewResponse;
      if (!response.ok || !data.success) {
        setError(data.error || 'Anteprima non disponibile');
        return;
      }
      setPreview(data);
    } catch {
      setError('Errore di rete durante l’anteprima');
    } finally {
      setLoading(false);
    }
  };

  const saveVotes = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/voti/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundNumber }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Salvataggio non riuscito');
        return;
      }
      setMessage(data.message);
    } catch {
      setError('Errore di rete durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const players = preview?.players ?? [];
  const unmatched = players.filter((player) => !player.playerId && player.vote != null);
  const matched = players.filter((player) => player.playerId && player.vote != null);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="VOTI" isLive={false} />
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Voti</h2>
          <p className="text-sm text-gray-500">
            Voti consolidati da pianetafanta (Excel) o provvisori da fantacalcio.it, salvati in official_votes.
          </p>
        </div>

        <Card>
          <CardContent className="py-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700" htmlFor="round">
              Giornata
            </label>
            <select
              id="round"
              value={roundNumber}
              onChange={(event) => {
                setRoundNumber(Number(event.target.value));
                setPreview(null);
                setMessage(null);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {calendar.map((round) => (
                <option key={round.number} value={round.number}>
                  {round.number}ª (Serie A {round.serieAMatchday}ª)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadPreview}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Importa voti fantacalcio.it
            </button>
          </CardContent>
        </Card>

        <AutoImportStatus key={`auto-${roundNumber}`} roundNumber={roundNumber} />

        <PianetafantaUpload
          key={roundNumber}
          roundNumber={roundNumber}
          serieAMatchday={calendar.find((round) => round.number === roundNumber)?.serieAMatchday ?? roundNumber + 6}
        />

        <Card>
          <CardContent className="py-4 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">Voti consolidati della giornata</h3>
              <p className="text-sm text-gray-500">Cancellali per tornare ai voti di fantacalcio.it (partita intera o singolo giocatore).</p>
            </div>
            <ConsolidatedVotesAdmin key={`cons-${roundNumber}`} roundNumber={roundNumber} />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Serie A {preview.serieAMatchday}ª · {preview.matches?.length ?? 0} partite</span>
              <span>{matched.length} abbinati · {unmatched.length} no</span>
            </div>

            {unmatched.length > 0 && (
              <Card>
                <CardContent className="py-3 space-y-2">
                  <div className="text-sm font-medium text-amber-800">Non abbinati</div>
                  {unmatched.map((player) => (
                    <div key={`${player.matchId}-${player.team}-${player.name}`} className="flex justify-between text-sm">
                      <span>{player.name} <span className="text-gray-400">{player.team} {player.role}</span></span>
                      <span>{player.vote != null ? formatVote(player.vote) : 's.v.'}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(preview.matches ?? []).map((match) => {
              const rows = matched.filter((player) => player.matchId === match.matchId);
              return (
                <Card key={match.matchId}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">
                        {match.homeTeam} {match.homeScore}-{match.awayScore} {match.awayTeam}
                      </div>
                      <Badge>{rows.length}</Badge>
                    </div>
                    {rows.map((player) => (
                      <div key={`${player.playerId}-${player.name}`} className="flex items-start justify-between gap-2 text-sm">
                        <div>
                          <div>{player.matchedName}</div>
                          <div className="text-xs text-gray-400">
                            {player.name} · {player.role}
                            {player.bonuses.length > 0 && ` · ${player.bonuses.map((bonus) => `${bonus.label} x${bonus.count}`).join(', ')}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{player.vote != null ? formatVote(player.vote) : 's.v.'}</div>
                          <div className="text-xs text-gray-400">FV {player.fantaVote != null ? formatVote(player.fantaVote) : '–'}</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            <button
              type="button"
              onClick={saveVotes}
              disabled={saving || matched.length === 0}
              className="w-full rounded-lg border border-emerald-600 text-emerald-700 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Salvataggio...' : `Salva ${matched.length} voti`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
