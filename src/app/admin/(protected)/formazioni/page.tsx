'use client';

import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ParsedTeamLineup,
  LineupParseResult,
} from '@/lib/fmsrevo-lineup-parser';
import { teams } from '@/data/teams';
import { getRoundByNumber, calendar } from '@/data/calendar';
import { saveImportedLineups } from '@/lib/lineup-store';
import {
  lineupBlocksProceed,
  otherRosterTeamIds,
  rankLineupCandidates,
  syncUnrecognizedPlayerErrors,
  type LineupPlayerCatalogEntry,
} from '@/lib/lineup-matching';
import { 
  AlertCircle, 
  CheckCircle, 
  Download, 
  FileText, 
  ArrowRight,
  X,
  AlertTriangle,
  Users,
  Loader2,
} from 'lucide-react';

type ImportStep = 'select' | 'review' | 'confirm' | 'done';

interface ReviewableLineup extends ParsedTeamLineup {
  isConfirmed: boolean;
  isSkipped: boolean;
  usePreviousLineup: boolean;
}

export default function FormazioniAdminPage() {
  const [step, setStep] = useState<ImportStep>('select');
  const [selectedRound, setSelectedRound] = useState(1);
  const [manualContent, setManualContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<LineupParseResult | null>(null);
  const [reviewableLineups, setReviewableLineups] = useState<ReviewableLineup[]>([]);
  const [catalog, setCatalog] = useState<LineupPlayerCatalogEntry[]>([]);

  const fantasyTeams = useMemo(() => teams.map(t => ({ id: t.id, name: t.name })), []);
  const round = useMemo(() => getRoundByNumber(selectedRound), [selectedRound]);

  const handleFetchFromFMS = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const response = await fetch('/api/admin/lineups/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundNumber: selectedRound }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch lineups');
      }

      let teamsData: ParsedTeamLineup[] = [];

      if (data.teams && Array.isArray(data.teams)) {
        teamsData = data.teams;
      } else if (data.html) {
        // Server-side parse so matching uses open FMS rosters, not seed static data
        const parseRes = await fetch('/api/admin/lineups/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data.html }),
        });
        const parsed = await parseRes.json();
        if (!parseRes.ok || parsed.success === false) {
          throw new Error(parsed.error || 'Parsing HTML fallito');
        }
        teamsData = parsed.teams || [];
      }
      
      const reviewable: ReviewableLineup[] = teamsData.map(t => ({
        ...t,
        isConfirmed: false,
        isSkipped: false,
        usePreviousLineup: false,
      }));
      
      const missingTeamIds = new Set(fantasyTeams.map(t => t.id));
      reviewable.forEach(r => {
        if (r.matchedTeamId) missingTeamIds.delete(r.matchedTeamId);
      });
      
      for (const teamId of missingTeamIds) {
        const team = fantasyTeams.find(t => t.id === teamId);
        if (team) {
          reviewable.push({
            rawTeamName: team.name,
            matchedTeamId: team.id,
            matchedTeamName: team.name,
            matchedTeamConfidence: 1,
            formation: null,
            starters: [],
            bench: [],
            errors: [],
            warnings: ['Formazione non ancora inserita'],
            hasLineup: false,
            isConfirmed: false,
            isSkipped: false,
            usePreviousLineup: false,
          });
        }
      }
      
      if (data.message) {
        setFetchError(data.message);
      }
      
      setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
      setReviewableLineups(reviewable);
      setStep('review');

    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRound, fantasyTeams]);

  const handleParseManual = useCallback(async () => {
    if (!manualContent.trim()) return;

    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/admin/lineups/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: manualContent }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Parsing fallito');
      }

      const result: LineupParseResult = {
        success: Boolean(data.success),
        teams: data.teams || [],
        serieAMatchday: data.serieAMatchday ?? null,
        parseErrors: data.parseErrors || [],
        source: data.source || 'text',
      };
      setParseResult(result);

      const reviewable: ReviewableLineup[] = result.teams.map((t) => ({
        ...t,
        isConfirmed: false,
        isSkipped: false,
        usePreviousLineup: false,
      }));

      const missingTeamIds = new Set(fantasyTeams.map((t) => t.id));
      reviewable.forEach((r) => {
        if (r.matchedTeamId) missingTeamIds.delete(r.matchedTeamId);
      });

      for (const teamId of missingTeamIds) {
        const team = fantasyTeams.find((t) => t.id === teamId);
        if (team) {
          reviewable.push({
            rawTeamName: team.name,
            matchedTeamId: team.id,
            matchedTeamName: team.name,
            matchedTeamConfidence: 1,
            formation: null,
            starters: [],
            bench: [],
            errors: ['No lineup found in pasted content'],
            warnings: [],
            hasLineup: false,
            isConfirmed: false,
            isSkipped: false,
            usePreviousLineup: false,
          });
        }
      }

      setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
      setReviewableLineups(reviewable);
      setStep('review');
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : 'Errore parsing contenuto'
      );
    } finally {
      setIsLoading(false);
    }
  }, [manualContent, fantasyTeams]);

  const handleToggleSkip = useCallback((teamId: string | null) => {
    if (!teamId) return;
    setReviewableLineups(prev => prev.map(l => 
      l.matchedTeamId === teamId 
        ? { ...l, isSkipped: !l.isSkipped, usePreviousLineup: false }
        : l
    ));
  }, []);

  const handleToggleFallback = useCallback((teamId: string | null) => {
    if (!teamId) return;
    setReviewableLineups(prev => prev.map(l => 
      l.matchedTeamId === teamId 
        ? { ...l, usePreviousLineup: !l.usePreviousLineup, isSkipped: false }
        : l
    ));
  }, []);

  const handleConfirm = useCallback(async () => {
    const lineupsToApply = reviewableLineups.filter(l => 
      !l.isSkipped && (l.hasLineup || l.usePreviousLineup) && l.matchedTeamId
    );

    const unmatched = lineupsToApply.filter(
      (l) =>
        !l.usePreviousLineup &&
        (l.starters.some((s) => !s.matchedPlayerId) ||
          l.bench.some((b) => !b.matchedPlayerId))
    );
    if (unmatched.length > 0) {
      const names = unmatched
        .map((l) => l.matchedTeamName || l.rawTeamName)
        .join(', ');
      setFetchError(
        `Salvataggio bloccato: giocatori non abbinati in ${names}. Correggi in verifica.`
      );
      return;
    }

    try {
      const saved = await saveImportedLineups(
        selectedRound,
        lineupsToApply.map((l) => ({
          teamId: l.matchedTeamId!,
          formation: l.formation,
          // Keep nulls so the server can reject silent drops
          starterIds: l.starters.map((s) => s.matchedPlayerId),
          benchIds: l.bench.map((b) => b.matchedPlayerId),
          usePreviousLineup: l.usePreviousLineup,
        }))
      );

      console.log(`[Formazioni] Salvate ${saved} formazioni per giornata ${selectedRound}`);
      setStep('done');
    } catch (err) {
      console.error('[Formazioni] Errore salvataggio:', err);
      setFetchError(
        err instanceof Error ? err.message : 'Errore nel salvataggio formazioni'
      );
    }
  }, [reviewableLineups, selectedRound]);

  const applyResolvedPlayer = useCallback(
    (
      teamId: string,
      side: 'starters' | 'bench',
      index: number,
      player: { id: string; name: string }
    ) => {
      setReviewableLineups((prev) =>
        prev.map((lineup) => {
          if (lineup.matchedTeamId !== teamId) return lineup;
          const nextList = lineup[side].map((entry, entryIndex) =>
            entryIndex === index
              ? {
                  ...entry,
                  matchedPlayerId: player.id,
                  matchedPlayerName: player.name,
                  matchedPlayerConfidence: 1,
                  manuallyMatched: true,
                }
              : entry
          );
          return syncUnrecognizedPlayerErrors({ ...lineup, [side]: nextList });
        })
      );
    },
    []
  );

  const handleManualMatch = useCallback(
    async (
      teamId: string,
      side: 'starters' | 'bench',
      index: number,
      player: LineupPlayerCatalogEntry
    ) => {
      const lineup = reviewableLineups.find((entry) => entry.matchedTeamId === teamId);
      const raw = lineup?.[side][index];
      if (!raw) throw new Error('Giocatore non trovato nella formazione');

      const response = await fetch('/api/admin/lineups/alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: raw.rawName, playerId: player.id }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Alias non salvato');
      }

      applyResolvedPlayer(teamId, side, index, player);
    },
    [applyResolvedPlayer, reviewableLineups]
  );

  const handleAddPlayer = useCallback(
    async (teamId: string, side: 'starters' | 'bench', index: number) => {
      const lineup = reviewableLineups.find((entry) => entry.matchedTeamId === teamId);
      const raw = lineup?.[side][index];
      if (!raw) throw new Error('Giocatore non trovato nella formazione');
      if (!raw.role) throw new Error('Ruolo mancante nel PDF: impossibile creare il giocatore');

      const response = await fetch('/api/admin/lineups/add-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawName: raw.rawName,
          role: raw.role,
          serieAClub: raw.serieAClub,
          teamId,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false || !data.player) {
        throw new Error(data.error || 'Giocatore non creato');
      }

      const created = data.player as LineupPlayerCatalogEntry;
      applyResolvedPlayer(teamId, side, index, created);
      setCatalog((prev) => [...prev.filter((entry) => entry.id !== created.id), created]);
    },
    [applyResolvedPlayer, reviewableLineups]
  );

  const handleReset = () => {
    setStep('select');
    setManualContent('');
    setParseResult(null);
    setReviewableLineups([]);
    setFetchError(null);
    setCatalog([]);
  };

  const validLineups = reviewableLineups.filter(
    (lineup) =>
      !lineup.isSkipped &&
      (lineup.hasLineup || lineup.usePreviousLineup) &&
      !lineupBlocksProceed(lineup)
  );
  const invalidLineups = reviewableLineups.filter(lineupBlocksProceed);
  const skippedLineups = reviewableLineups.filter(l => l.isSkipped);

  const canProceed = validLineups.length > 0 && invalidLineups.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ADMIN FORMAZIONI" isLive={false} />
      
      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Importazione Formazioni</h2>
          {round && (
            <Badge variant="default">
              {selectedRound}ª Giornata (Serie A {round.serieAMatchday}ª)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm flex-wrap">
          <StepIndicator step="select" current={step} label="1. Scarica" />
          <ArrowRight size={16} className="text-gray-400" />
          <StepIndicator step="review" current={step} label="2. Verifica" />
          <ArrowRight size={16} className="text-gray-400" />
          <StepIndicator step="confirm" current={step} label="3. Conferma" />
        </div>

        {step === 'select' && (
          <SelectStep
            selectedRound={selectedRound}
            setSelectedRound={setSelectedRound}
            manualContent={manualContent}
            setManualContent={setManualContent}
            isLoading={isLoading}
            fetchError={fetchError}
            onFetch={handleFetchFromFMS}
            onParseManual={handleParseManual}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            reviewableLineups={reviewableLineups}
            validCount={validLineups.length}
            invalidCount={invalidLineups.length}
            skippedCount={skippedLineups.length}
            catalog={catalog}
            teamNames={Object.fromEntries(fantasyTeams.map((team) => [team.id, team.name]))}
            fetchError={fetchError}
            onToggleSkip={handleToggleSkip}
            onToggleFallback={handleToggleFallback}
            onMatch={handleManualMatch}
            onAdd={handleAddPlayer}
            onBack={handleReset}
            onProceed={() => setStep('confirm')}
            canProceed={canProceed}
          />
        )}

        {step === 'confirm' && (
          <ConfirmStep
            lineups={validLineups}
            selectedRound={selectedRound}
            onBack={() => setStep('review')}
            onConfirm={handleConfirm}
          />
        )}

        {step === 'done' && (
          <DoneStep
            lineupCount={validLineups.length}
            selectedRound={selectedRound}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step, current, label }: { step: ImportStep; current: ImportStep; label: string }) {
  const steps: ImportStep[] = ['select', 'review', 'confirm', 'done'];
  const stepIndex = steps.indexOf(step);
  const currentIndex = steps.indexOf(current);
  const isActive = stepIndex <= currentIndex;
  
  return (
    <span className={cn(
      'px-3 py-1 rounded-full text-sm',
      isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
    )}>
      {label}
    </span>
  );
}

function SelectStep({
  selectedRound,
  setSelectedRound,
  manualContent,
  setManualContent,
  isLoading,
  fetchError,
  onFetch,
  onParseManual,
}: {
  selectedRound: number;
  setSelectedRound: (v: number) => void;
  manualContent: string;
  setManualContent: (v: string) => void;
  isLoading: boolean;
  fetchError: string | null;
  onFetch: () => void;
  onParseManual: () => void;
}) {
  const round = getRoundByNumber(selectedRound);
  const hasFmsCredentials = true;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download size={20} className="text-gray-500" />
            <h3 className="font-semibold">Scarica formazioni da FMS Revo</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Effettua il login automatico a FMS Revo e scarica le formazioni per la giornata selezionata
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm text-gray-600">
              Giornata:
              <select 
                value={selectedRound}
                onChange={(e) => setSelectedRound(Number(e.target.value))}
                className="ml-2 px-3 py-1 border border-gray-200 rounded"
              >
                {calendar.map(r => (
                  <option key={r.number} value={r.number}>
                    {r.number}ª (Serie A {r.serieAMatchday}ª - {r.date})
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={onFetch}
              disabled={isLoading}
              className={cn(
                'px-6 py-2 rounded-lg font-medium flex items-center gap-2',
                isLoading
                  ? 'bg-gray-200 text-gray-400 cursor-wait'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Scaricamento...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Scarica da FMS Revo
                </>
              )}
            </button>
          </div>

          {fetchError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <AlertCircle size={18} />
                Errore
              </div>
              <p className="mt-1 text-sm text-red-600">{fetchError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-gray-400 text-sm">oppure</div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-gray-500" />
            <h3 className="font-semibold">Incolla manualmente</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Copia e incolla il contenuto della pagina formazioni da FMS Revo
          </p>
        </CardHeader>
        <CardContent>
          <textarea
            value={manualContent}
            onChange={(e) => setManualContent(e.target.value)}
            placeholder={`Incolla qui il contenuto della pagina formazioni...

Esempio formato:
Yellow Mustard
4-4-2
1. MERET Alex (POR) - NAP
2. DI LORENZO Giovanni (DIF) - NAP
...

PANCHINA:
12. CAPRILE Elia (POR) - NAP
...`}
            className="w-full h-64 p-3 border border-gray-200 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />

          <div className="mt-4">
            <button
              onClick={onParseManual}
              disabled={!manualContent.trim()}
              className={cn(
                'px-6 py-2 rounded-lg font-medium flex items-center gap-2',
                manualContent.trim()
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              <FileText size={18} />
              Analizza
            </button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ReviewStep({
  reviewableLineups,
  validCount,
  invalidCount,
  skippedCount,
  catalog,
  teamNames,
  fetchError,
  onToggleSkip,
  onToggleFallback,
  onMatch,
  onAdd,
  onBack,
  onProceed,
  canProceed,
}: {
  reviewableLineups: ReviewableLineup[];
  validCount: number;
  invalidCount: number;
  skippedCount: number;
  catalog: LineupPlayerCatalogEntry[];
  teamNames: Record<string, string>;
  fetchError: string | null;
  onToggleSkip: (teamId: string | null) => void;
  onToggleFallback: (teamId: string | null) => void;
  onMatch: (
    teamId: string,
    side: 'starters' | 'bench',
    index: number,
    player: LineupPlayerCatalogEntry
  ) => Promise<void>;
  onAdd: (teamId: string, side: 'starters' | 'bench', index: number) => Promise<void>;
  onBack: () => void;
  onProceed: () => void;
  canProceed: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{validCount}</div>
            <div className="text-sm text-gray-600">Valide</div>
          </CardContent>
        </Card>
        <Card className={cn(invalidCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50')}>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-red-700">{invalidCount}</div>
            <div className="text-sm text-gray-600">Con errori</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{skippedCount}</div>
            <div className="text-sm text-gray-600">Saltate</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Formazioni ({reviewableLineups.length} squadre)</h3>
          </div>
        </CardHeader>
        <CardContent>
          {fetchError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {fetchError}
            </div>
          )}
          <div className="space-y-4">
            {reviewableLineups.map(lineup => (
              <LineupReviewCard
                key={lineup.matchedTeamId || lineup.rawTeamName}
                lineup={lineup}
                catalog={catalog}
                teamNames={teamNames}
                onToggleSkip={() => onToggleSkip(lineup.matchedTeamId)}
                onToggleFallback={() => onToggleFallback(lineup.matchedTeamId)}
                onMatch={onMatch}
                onAdd={onAdd}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← Ricomincia
        </button>
        
        <button
          onClick={onProceed}
          disabled={!canProceed}
          className={cn(
            'px-6 py-2 rounded-lg font-medium',
            canProceed
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          Procedi ({validCount} formazioni) →
        </button>
      </div>
    </>
  );
}

function LineupReviewCard({
  lineup,
  catalog,
  teamNames,
  onToggleSkip,
  onToggleFallback,
  onMatch,
  onAdd,
}: {
  lineup: ReviewableLineup;
  catalog: LineupPlayerCatalogEntry[];
  teamNames: Record<string, string>;
  onToggleSkip: () => void;
  onToggleFallback: () => void;
  onMatch: (
    teamId: string,
    side: 'starters' | 'bench',
    index: number,
    player: LineupPlayerCatalogEntry
  ) => Promise<void>;
  onAdd: (teamId: string, side: 'starters' | 'bench', index: number) => Promise<void>;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<LineupPlayerCatalogEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasErrors = lineup.errors.length > 0;
  const hasWarnings = lineup.warnings.length > 0;
  const rosterIds = useMemo(() => {
    if (!lineup.matchedTeamId) return new Set<string>();
    return new Set(
      catalog
        .filter((player) => player.rosterTeamIds.includes(lineup.matchedTeamId!))
        .map((player) => player.id)
    );
  }, [catalog, lineup.matchedTeamId]);

  const candidates = useMemo(() => {
    if (!openKey) return [];
    const [side, indexRaw] = openKey.split(':');
    const list = side === 'bench' ? lineup.bench : lineup.starters;
    const role = list[Number(indexRaw)]?.role ?? null;
    return rankLineupCandidates(catalog, rosterIds, role, query);
  }, [catalog, lineup.bench, lineup.starters, openKey, query, rosterIds]);

  const commitMatch = async (player: LineupPlayerCatalogEntry) => {
    if (!lineup.matchedTeamId || !openKey) return;
    const [side, indexRaw] = openKey.split(':');
    const parsedSide = side === 'bench' ? 'bench' : 'starters';
    setBusy(true);
    setActionError(null);
    try {
      await onMatch(lineup.matchedTeamId, parsedSide, Number(indexRaw), player);
      setOpenKey(null);
      setPending(null);
      setQuery('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Abbinamento non salvato');
    } finally {
      setBusy(false);
    }
  };

  const commitAdd = async (side: 'starters' | 'bench', index: number) => {
    if (!lineup.matchedTeamId) return;
    setBusy(true);
    setActionError(null);
    try {
      await onAdd(lineup.matchedTeamId, side, index);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Giocatore non creato');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn(
      'p-4 rounded-lg border',
      lineup.isSkipped
        ? 'bg-gray-100 border-gray-200 opacity-60'
        : lineup.usePreviousLineup
          ? 'bg-purple-50 border-purple-200'
          : hasErrors
            ? 'bg-red-50 border-red-200'
            : hasWarnings
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-lg">
              {lineup.matchedTeamName || lineup.rawTeamName}
            </span>
            {lineup.matchedTeamConfidence < 1 && lineup.matchedTeamConfidence > 0 && (
              <Badge variant="default" className="bg-amber-100 text-amber-700">
                Match {Math.round(lineup.matchedTeamConfidence * 100)}%
              </Badge>
            )}
            {lineup.formation && (
              <Badge variant="default" className="bg-blue-100 text-blue-700">
                {lineup.formation}
              </Badge>
            )}
            {!lineup.hasLineup && !lineup.usePreviousLineup && (
              <Badge variant="default" className="bg-red-100 text-red-700">
                Formazione mancante
              </Badge>
            )}
            {lineup.usePreviousLineup && (
              <Badge variant="default" className="bg-purple-100 text-purple-700">
                Usa formazione precedente
              </Badge>
            )}
            {lineup.isSkipped && (
              <Badge variant="default" className="bg-gray-100 text-gray-700">
                Saltata
              </Badge>
            )}
          </div>

          {lineup.hasLineup && (
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Titolari:</span>{' '}
              {lineup.starters.length} ({lineup.starters.filter(s => s.matchedPlayerId).length} matchati)
              {' | '}
              <span className="font-medium">Panchina:</span>{' '}
              {lineup.bench.length} ({lineup.bench.filter(b => b.matchedPlayerId).length} matchati)
            </div>
          )}

          {(hasErrors || hasWarnings) && (
            <div className="mt-2 space-y-1">
              {lineup.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle size={14} />
                  <span>{err}</span>
                </div>
              ))}
              {lineup.warnings.map((warn, i) => (
                <div key={i} className="flex items-center gap-1 text-sm text-amber-600">
                  <AlertTriangle size={14} />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}

          {actionError && (
            <div className="mt-2 text-sm text-red-700">{actionError}</div>
          )}

          {lineup.hasLineup && lineup.starters.length > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <PlayerColumn
                title="Titolari"
                side="starters"
                players={lineup.starters}
                openKey={openKey}
                query={query}
                candidates={candidates}
                pending={pending}
                busy={busy}
                teamId={lineup.matchedTeamId}
                teamNames={teamNames}
                rosterIds={rosterIds}
                onQuery={setQuery}
                onOpen={(key) => {
                  setOpenKey(key);
                  setQuery('');
                  setPending(null);
                  setActionError(null);
                }}
                onClose={() => {
                  setOpenKey(null);
                  setPending(null);
                }}
                onPick={(player) => {
                  if (!lineup.matchedTeamId) return;
                  const others = otherRosterTeamIds(player, lineup.matchedTeamId);
                  if (others.length > 0) setPending(player);
                  else void commitMatch(player);
                }}
                onConfirm={() => {
                  if (pending) void commitMatch(pending);
                }}
                onCancelConfirm={() => setPending(null)}
                onAdd={(index) => void commitAdd('starters', index)}
              />
              <PlayerColumn
                title="Panchina"
                side="bench"
                players={lineup.bench}
                openKey={openKey}
                query={query}
                candidates={candidates}
                pending={pending}
                busy={busy}
                teamId={lineup.matchedTeamId}
                teamNames={teamNames}
                rosterIds={rosterIds}
                onQuery={setQuery}
                onOpen={(key) => {
                  setOpenKey(key);
                  setQuery('');
                  setPending(null);
                  setActionError(null);
                }}
                onClose={() => {
                  setOpenKey(null);
                  setPending(null);
                }}
                onPick={(player) => {
                  if (!lineup.matchedTeamId) return;
                  const others = otherRosterTeamIds(player, lineup.matchedTeamId);
                  if (others.length > 0) setPending(player);
                  else void commitMatch(player);
                }}
                onConfirm={() => {
                  if (pending) void commitMatch(pending);
                }}
                onCancelConfirm={() => setPending(null)}
                onAdd={(index) => void commitAdd('bench', index)}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 ml-4">
          {!lineup.hasLineup && (
            <button
              onClick={onToggleFallback}
              className={cn(
                'px-3 py-1 text-sm rounded flex items-center gap-1',
                lineup.usePreviousLineup
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              )}
            >
              <Users size={14} />
              {lineup.usePreviousLineup ? 'Fallback attivo' : 'Usa precedente'}
            </button>
          )}
          <button
            onClick={onToggleSkip}
            className={cn(
              'px-3 py-1 text-sm rounded flex items-center gap-1',
              lineup.isSkipped
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <X size={14} />
            {lineup.isSkipped ? 'Saltata' : 'Salta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerColumn({
  title,
  side,
  players,
  openKey,
  query,
  candidates,
  pending,
  busy,
  teamId,
  teamNames,
  rosterIds,
  onQuery,
  onOpen,
  onClose,
  onPick,
  onConfirm,
  onCancelConfirm,
  onAdd,
}: {
  title: string;
  side: 'starters' | 'bench';
  players: ReviewableLineup['starters'];
  openKey: string | null;
  query: string;
  candidates: LineupPlayerCatalogEntry[];
  pending: LineupPlayerCatalogEntry | null;
  busy: boolean;
  teamId: string | null;
  teamNames: Record<string, string>;
  rosterIds: Set<string>;
  onQuery: (value: string) => void;
  onOpen: (key: string) => void;
  onClose: () => void;
  onPick: (player: LineupPlayerCatalogEntry) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onAdd: (index: number) => void;
}) {
  const groupOf = (candidate: LineupPlayerCatalogEntry, role: string | null) =>
    rosterIds.has(candidate.id) ? (role && candidate.role === role ? 0 : 1) : 2;

  return (
    <div>
      <div className="font-medium text-gray-500 mb-1">{title}</div>
      {players.map((player, index) => {
        const key = `${side}:${index}`;
        const isOpen = openKey === key;
        const unresolved = !player.matchedPlayerId;
        return (
          <div
            key={key}
            className={cn(
              'py-1 px-1 rounded',
              player.manuallyMatched && 'bg-emerald-100 text-emerald-900',
              unresolved && 'text-red-700',
              !unresolved && !player.manuallyMatched && 'text-gray-700'
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span>{player.matchedPlayerName || player.rawName}</span>
              {player.role && <span className="text-gray-400">({player.role})</span>}
              {player.manuallyMatched && player.rawName !== player.matchedPlayerName && (
                <span className="text-emerald-700">← {player.rawName}</span>
              )}
              {unresolved && teamId && (
                <>
                  <button
                    type="button"
                    className="text-xs px-2 py-0.5 rounded bg-white border border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={() => (isOpen ? onClose() : onOpen(key))}
                    disabled={busy}
                  >
                    Abbina
                  </button>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-40"
                    disabled={busy || !player.role}
                    onClick={() => onAdd(index)}
                  >
                    +aggiungi
                  </button>
                </>
              )}
            </div>
            {isOpen && (
              <div className="mt-1 mb-2 p-2 bg-white border border-gray-200 rounded-lg">
                <input
                  value={query}
                  onChange={(event) => onQuery(event.target.value)}
                  placeholder="Cerca per nome"
                  className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                />
                <div className="mt-2 max-h-52 overflow-y-auto space-y-1">
                  {candidates.length === 0 && (
                    <div className="text-gray-400">Nessun giocatore trovato</div>
                  )}
                  {candidates.map((candidate, candidateIndex) => {
                    const group = groupOf(candidate, player.role);
                    const previous =
                      candidateIndex === 0
                        ? -1
                        : groupOf(candidates[candidateIndex - 1], player.role);
                    const showHeader = group !== previous;
                    const label =
                      group === 0
                        ? 'Rosa attiva, stesso ruolo'
                        : group === 1
                          ? 'Resto della rosa'
                          : 'Altri giocatori';
                    return (
                      <div key={candidate.id}>
                        {showHeader && (
                          <div className="pt-1 text-[11px] uppercase tracking-wide text-gray-400">
                            {label}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPick(candidate)}
                          className="w-full text-left px-1 py-1 rounded hover:bg-emerald-50"
                        >
                          <span className="font-medium">{candidate.name}</span>
                          <span className="text-gray-500">
                            {' '}
                            · {candidate.role}
                            {candidate.realTeam ? ` · ${candidate.realTeam}` : ''}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {pending && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                    {pending.name} è nella rosa di{' '}
                    {otherRosterTeamIds(pending, teamId || '')
                      .map((id) => teamNames[id] || id)
                      .join(', ')}
                    . Confermi l&apos;abbinamento?
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onConfirm}
                        className="px-2 py-1 rounded bg-emerald-600 text-white"
                      >
                        Conferma
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onCancelConfirm}
                        className="px-2 py-1 rounded bg-white border border-gray-300"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConfirmStep({
  lineups,
  selectedRound,
  onBack,
  onConfirm,
}: {
  lineups: ReviewableLineup[];
  selectedRound: number;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900">Conferma importazione formazioni</h3>
      </CardHeader>
      <CardContent>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-amber-700 font-medium">
            <AlertCircle size={18} />
            Attenzione
          </div>
          <p className="text-sm text-amber-600 mt-1">
            Stai per importare {lineups.length} formazioni per la {selectedRound}ª giornata.
            Le formazioni esistenti verranno sovrascritte.
          </p>
        </div>

        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {lineups.map((lineup) => (
            <div key={lineup.matchedTeamId} className="text-sm text-gray-600 flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" />
              <span className="font-medium">{lineup.matchedTeamName}</span>
              {lineup.formation && <span className="text-gray-400">({lineup.formation})</span>}
              {lineup.usePreviousLineup && (
                <Badge variant="default" className="bg-purple-100 text-purple-700 text-xs">
                  fallback
                </Badge>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            ← Indietro
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Conferma e salva
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoneStep({
  lineupCount,
  selectedRound,
  onReset,
}: {
  lineupCount: number;
  selectedRound: number;
  onReset: () => void;
}) {
  return (
    <Card className="bg-emerald-50 border-emerald-200">
      <CardContent className="pt-6 text-center">
        <CheckCircle className="mx-auto text-emerald-600 mb-4" size={48} />
        <h3 className="text-xl font-bold text-emerald-700 mb-2">
          Importazione completata!
        </h3>
        <p className="text-gray-600 mb-4">
          {lineupCount} formazioni salvate per la {selectedRound}ª giornata.
        </p>
        <button
          onClick={onReset}
          className="px-6 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Nuova importazione
        </button>
      </CardContent>
    </Card>
  );
}
