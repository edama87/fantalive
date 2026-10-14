'use client';

import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  parseLineupsContent,
  ParsedTeamLineup,
  ParsedLineupPlayer,
  LineupParseResult,
} from '@/lib/fmsrevo-lineup-parser';
import { getAllPlayers, teams } from '@/data/teams';
import { getRoundByNumber, calendar } from '@/data/calendar';
import { Lineup, LineupSlot, Player } from '@/types';
import { 
  AlertCircle, 
  CheckCircle, 
  Download, 
  FileText, 
  ArrowRight,
  X,
  Edit2,
  Save,
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
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [useFallbackForMissing, setUseFallbackForMissing] = useState(false);

  const allPlayers = useMemo(() => getAllPlayers(), []);
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

      const result = parseLineupsContent(data.html, allPlayers, fantasyTeams);
      setParseResult(result);
      
      const reviewable = result.teams.map(t => ({
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
            errors: ['No lineup submitted'],
            warnings: [],
            hasLineup: false,
            isConfirmed: false,
            isSkipped: false,
            usePreviousLineup: false,
          });
        }
      }
      
      setReviewableLineups(reviewable);
      setStep('review');

    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRound, allPlayers, fantasyTeams]);

  const handleParseManual = useCallback(() => {
    if (!manualContent.trim()) return;

    const result = parseLineupsContent(manualContent, allPlayers, fantasyTeams);
    setParseResult(result);
    
    const reviewable = result.teams.map(t => ({
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
          errors: ['No lineup found in pasted content'],
          warnings: [],
          hasLineup: false,
          isConfirmed: false,
          isSkipped: false,
          usePreviousLineup: false,
        });
      }
    }
    
    setReviewableLineups(reviewable);
    setStep('review');
  }, [manualContent, allPlayers, fantasyTeams]);

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

    console.log('Applying lineups:', lineupsToApply.map(l => ({
      teamId: l.matchedTeamId,
      formation: l.formation,
      starters: l.starters.map(s => s.matchedPlayerId),
      bench: l.bench.map(b => b.matchedPlayerId),
      usePreviousLineup: l.usePreviousLineup,
    })));

    setStep('done');
  }, [reviewableLineups]);

  const handleReset = () => {
    setStep('select');
    setManualContent('');
    setParseResult(null);
    setReviewableLineups([]);
    setFetchError(null);
    setEditingTeamId(null);
  };

  const validLineups = reviewableLineups.filter(l => 
    !l.isSkipped && (l.hasLineup || l.usePreviousLineup) && l.errors.length === 0
  );
  const invalidLineups = reviewableLineups.filter(l => 
    !l.isSkipped && !l.usePreviousLineup && l.errors.length > 0
  );
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
            allPlayers={allPlayers}
            editingTeamId={editingTeamId}
            useFallbackForMissing={useFallbackForMissing}
            setUseFallbackForMissing={setUseFallbackForMissing}
            onToggleSkip={handleToggleSkip}
            onToggleFallback={handleToggleFallback}
            onEdit={setEditingTeamId}
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
  allPlayers,
  editingTeamId,
  useFallbackForMissing,
  setUseFallbackForMissing,
  onToggleSkip,
  onToggleFallback,
  onEdit,
  onBack,
  onProceed,
  canProceed,
}: {
  reviewableLineups: ReviewableLineup[];
  validCount: number;
  invalidCount: number;
  skippedCount: number;
  allPlayers: Player[];
  editingTeamId: string | null;
  useFallbackForMissing: boolean;
  setUseFallbackForMissing: (v: boolean) => void;
  onToggleSkip: (teamId: string | null) => void;
  onToggleFallback: (teamId: string | null) => void;
  onEdit: (teamId: string | null) => void;
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
          <div className="space-y-4">
            {reviewableLineups.map(lineup => (
              <LineupReviewCard
                key={lineup.matchedTeamId || lineup.rawTeamName}
                lineup={lineup}
                allPlayers={allPlayers}
                isEditing={editingTeamId === lineup.matchedTeamId}
                onToggleSkip={() => onToggleSkip(lineup.matchedTeamId)}
                onToggleFallback={() => onToggleFallback(lineup.matchedTeamId)}
                onEdit={() => onEdit(lineup.matchedTeamId)}
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
  allPlayers,
  isEditing,
  onToggleSkip,
  onToggleFallback,
  onEdit,
}: {
  lineup: ReviewableLineup;
  allPlayers: Player[];
  isEditing: boolean;
  onToggleSkip: () => void;
  onToggleFallback: () => void;
  onEdit: () => void;
}) {
  const hasErrors = lineup.errors.length > 0;
  const hasWarnings = lineup.warnings.length > 0;

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

          {lineup.hasLineup && lineup.starters.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="font-medium text-gray-500 mb-1">Titolari</div>
                {lineup.starters.slice(0, 6).map((p, i) => (
                  <div key={i} className={cn(
                    'py-0.5',
                    p.matchedPlayerId ? 'text-gray-700' : 'text-red-600'
                  )}>
                    {p.matchedPlayerName || p.rawName}
                    {p.role && <span className="text-gray-400 ml-1">({p.role})</span>}
                  </div>
                ))}
                {lineup.starters.length > 6 && (
                  <div className="text-gray-400">+{lineup.starters.length - 6} altri</div>
                )}
              </div>
              <div>
                <div className="font-medium text-gray-500 mb-1">Panchina</div>
                {lineup.bench.slice(0, 4).map((p, i) => (
                  <div key={i} className={cn(
                    'py-0.5',
                    p.matchedPlayerId ? 'text-gray-700' : 'text-amber-600'
                  )}>
                    {p.matchedPlayerName || p.rawName}
                  </div>
                ))}
                {lineup.bench.length > 4 && (
                  <div className="text-gray-400">+{lineup.bench.length - 4} altri</div>
                )}
              </div>
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
