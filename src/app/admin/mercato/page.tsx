'use client';

import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  parseMarketEmail, 
  ParsedMarketRow,
} from '@/lib/market-email-parser';
import { 
  validateAllTransactions,
  createValidatedTransaction,
  discardTransaction,
  restoreTransaction,
  updateTransaction,
  getTeamRostersFromSeed,
  getTeamCreditsFromSeed,
  ValidatedTransaction,
  ValidationResult,
  TeamCreditsSummary,
} from '@/lib/market-validator';
import { getLoanCost } from '@/lib/league-rules';
import { getAllPlayers, teams } from '@/data/teams';
import { Player, PlayerRole } from '@/types';
import { 
  AlertCircle, 
  CheckCircle, 
  Upload, 
  FileText, 
  ArrowRight,
  X,
  RotateCcw,
  Edit2,
  Save,
  AlertTriangle,
} from 'lucide-react';

type ImportStep = 'paste' | 'review' | 'confirm' | 'done';

export default function MercatoAdminPage() {
  const [step, setStep] = useState<ImportStep>('paste');
  const [emailContent, setEmailContent] = useState('');
  const [effectiveRound, setEffectiveRound] = useState(2);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const allPlayers = useMemo(() => getAllPlayers(), []);
  const teamRosters = useMemo(() => getTeamRostersFromSeed(), []);
  const teamCredits = useMemo(() => getTeamCreditsFromSeed(), []);

  const handleParse = useCallback(() => {
    const result = parseMarketEmail(emailContent, allPlayers);
    setParseErrors(result.parseErrors);

    if (result.success && result.rows.length > 0) {
      const transactions = result.rows.map(row => 
        createValidatedTransaction(row, effectiveRound)
      );
      
      const validation = validateAllTransactions(
        transactions,
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      setValidationResult(validation);
      setStep('review');
    }
  }, [emailContent, effectiveRound, allPlayers, teamRosters, teamCredits]);

  const handleDiscardTx = useCallback((txId: string) => {
    if (!validationResult) return;
    
    const newResult = discardTransaction(
      validationResult.transactions,
      txId,
      allPlayers,
      teamRosters,
      teamCredits
    );
    setValidationResult(newResult);
  }, [validationResult, allPlayers, teamRosters, teamCredits]);

  const handleRestoreTx = useCallback((txId: string) => {
    if (!validationResult) return;
    
    const newResult = restoreTransaction(
      validationResult.transactions,
      txId,
      allPlayers,
      teamRosters,
      teamCredits
    );
    setValidationResult(newResult);
  }, [validationResult, allPlayers, teamRosters, teamCredits]);

  const handleUpdateTx = useCallback((txId: string, updates: Partial<ValidatedTransaction>) => {
    if (!validationResult) return;
    
    const newResult = updateTransaction(
      validationResult.transactions,
      txId,
      updates,
      allPlayers,
      teamRosters,
      teamCredits
    );
    setValidationResult(newResult);
    setEditingTxId(null);
  }, [validationResult, allPlayers, teamRosters, teamCredits]);

  const handleConfirm = useCallback(async () => {
    if (!validationResult) return;
    
    const activeTransactions = validationResult.transactions.filter(tx => !tx.isDiscarded);
    console.log('Applying market imports:', activeTransactions);
    
    setStep('done');
  }, [validationResult]);

  const handleReset = () => {
    setStep('paste');
    setEmailContent('');
    setValidationResult(null);
    setParseErrors([]);
    setEditingTxId(null);
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return '???';
    return teams.find(t => t.id === teamId)?.name || teamId;
  };

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return '???';
    return allPlayers.find(p => p.id === playerId)?.name || playerId;
  };

  const activeTransactions = validationResult?.transactions.filter(tx => !tx.isDiscarded) || [];
  const discardedTransactions = validationResult?.transactions.filter(tx => tx.isDiscarded) || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ADMIN MERCATO" isLive={false} />
      
      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Importazione Mercato</h2>
          <Badge variant="default">
            Giornata effettiva: {effectiveRound}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm flex-wrap">
          <StepIndicator step="paste" current={step} label="1. Incolla" />
          <ArrowRight size={16} className="text-gray-400" />
          <StepIndicator step="review" current={step} label="2. Verifica" />
          <ArrowRight size={16} className="text-gray-400" />
          <StepIndicator step="confirm" current={step} label="3. Conferma" />
        </div>

        {step === 'paste' && (
          <PasteStep
            emailContent={emailContent}
            setEmailContent={setEmailContent}
            effectiveRound={effectiveRound}
            setEffectiveRound={setEffectiveRound}
            parseErrors={parseErrors}
            onParse={handleParse}
          />
        )}

        {step === 'review' && validationResult && (
          <ReviewStep
            validation={validationResult}
            activeTransactions={activeTransactions}
            discardedTransactions={discardedTransactions}
            editingTxId={editingTxId}
            allPlayers={allPlayers}
            onDiscard={handleDiscardTx}
            onRestore={handleRestoreTx}
            onEdit={setEditingTxId}
            onUpdate={handleUpdateTx}
            onBack={handleReset}
            onProceed={() => setStep('confirm')}
            getTeamName={getTeamName}
            getPlayerName={getPlayerName}
          />
        )}

        {step === 'confirm' && validationResult && (
          <ConfirmStep
            validation={validationResult}
            activeTransactions={activeTransactions}
            effectiveRound={effectiveRound}
            onBack={() => setStep('review')}
            onConfirm={handleConfirm}
            getTeamName={getTeamName}
            getPlayerName={getPlayerName}
          />
        )}

        {step === 'done' && (
          <DoneStep
            transactionCount={activeTransactions.length}
            effectiveRound={effectiveRound}
            onReset={handleReset}
          />
        )}

        <RulesInfoCard />
      </div>
    </div>
  );
}

function StepIndicator({ step, current, label }: { step: ImportStep; current: ImportStep; label: string }) {
  const steps: ImportStep[] = ['paste', 'review', 'confirm', 'done'];
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

function PasteStep({
  emailContent,
  setEmailContent,
  effectiveRound,
  setEffectiveRound,
  parseErrors,
  onParse,
}: {
  emailContent: string;
  setEmailContent: (v: string) => void;
  effectiveRound: number;
  setEffectiveRound: (v: number) => void;
  parseErrors: string[];
  onParse: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-gray-500" />
          <h3 className="font-semibold">Incolla l'email del mercato FMS Revo</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Copia e incolla l'intera email con la tabella delle chiamate aggiudicate
        </p>
      </CardHeader>
      <CardContent>
        <textarea
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          placeholder={`CHIAMATE AGGIUDICATE ALL'APERTURA DELLE BUSTE:
=========================================================================
Giocatore			FantaSquadra	Taglio	Inf	Pre	$	Data
GIMENEZ Santiago	A	MIL	Yellow Mustard	Cheddira W.	no	no	2	2026-03-26 18:45:01
=========================================================================`}
          className="w-full h-64 p-3 border border-gray-200 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />

        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <label className="text-sm text-gray-600">
            Giornata effettiva:
            <select 
              value={effectiveRound}
              onChange={(e) => setEffectiveRound(Number(e.target.value))}
              className="ml-2 px-3 py-1 border border-gray-200 rounded"
            >
              {Array.from({ length: 27 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}ª giornata</option>
              ))}
            </select>
          </label>

          <button
            onClick={onParse}
            disabled={!emailContent.trim()}
            className={cn(
              'px-6 py-2 rounded-lg font-medium flex items-center gap-2',
              emailContent.trim()
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <Upload size={18} />
            Analizza
          </button>
        </div>

        {parseErrors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 font-medium">
              <AlertCircle size={18} />
              Errori di parsing
            </div>
            <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
              {parseErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  validation,
  activeTransactions,
  discardedTransactions,
  editingTxId,
  allPlayers,
  onDiscard,
  onRestore,
  onEdit,
  onUpdate,
  onBack,
  onProceed,
  getTeamName,
  getPlayerName,
}: {
  validation: ValidationResult;
  activeTransactions: ValidatedTransaction[];
  discardedTransactions: ValidatedTransaction[];
  editingTxId: string | null;
  allPlayers: Player[];
  onDiscard: (id: string) => void;
  onRestore: (id: string) => void;
  onEdit: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<ValidatedTransaction>) => void;
  onBack: () => void;
  onProceed: () => void;
  getTeamName: (id: string | null) => string;
  getPlayerName: (id: string | null) => string;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Card className={cn(
          validation.canConfirm ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50'
        )}>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">
              {activeTransactions.filter(t => !t.hasBlockingErrors).length}
            </div>
            <div className="text-sm text-gray-600">Valide</div>
          </CardContent>
        </Card>
        <Card className={cn(
          validation.totalErrors > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50'
        )}>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-red-700">
              {validation.totalErrors}
            </div>
            <div className="text-sm text-gray-600">Errori</div>
          </CardContent>
        </Card>
        <Card className={cn(
          validation.totalWarnings > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'
        )}>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-amber-700">
              {validation.totalWarnings}
            </div>
            <div className="text-sm text-gray-600">Avvisi</div>
          </CardContent>
        </Card>
      </div>

      {validation.teamSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Riepilogo crediti per squadra</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validation.teamSummaries.map(summary => (
                <TeamCreditRow key={summary.teamId} summary={summary} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Transazioni ({activeTransactions.length})</h3>
            {!validation.canConfirm && (
              <Badge variant="default" className="bg-red-100 text-red-700">
                <AlertCircle size={14} className="mr-1" />
                Correggere errori prima di confermare
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeTransactions.map(tx => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                isEditing={editingTxId === tx.id}
                allPlayers={allPlayers}
                onDiscard={() => onDiscard(tx.id)}
                onEdit={() => onEdit(tx.id)}
                onCancelEdit={() => onEdit(null)}
                onSave={(updates) => onUpdate(tx.id, updates)}
                getTeamName={getTeamName}
                getPlayerName={getPlayerName}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {discardedTransactions.length > 0 && (
        <Card className="opacity-60">
          <CardHeader>
            <h3 className="font-semibold text-gray-500">
              Scartate ({discardedTransactions.length})
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {discardedTransactions.map(tx => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-2 bg-gray-100 rounded"
                >
                  <span className="text-sm text-gray-500 line-through">
                    {getTeamName(tx.teamId)}: {tx.playerInName}
                  </span>
                  <button
                    onClick={() => onRestore(tx.id)}
                    className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <RotateCcw size={14} />
                    Ripristina
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          ← Ricomincia
        </button>
        
        <button
          onClick={onProceed}
          disabled={!validation.canConfirm || activeTransactions.length === 0}
          className={cn(
            'px-6 py-2 rounded-lg font-medium',
            validation.canConfirm && activeTransactions.length > 0
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          Procedi ({activeTransactions.filter(t => !t.hasBlockingErrors).length} operazioni) →
        </button>
      </div>
    </>
  );
}

function TeamCreditRow({ summary }: { summary: TeamCreditsSummary }) {
  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg',
      summary.hasInsufficientCredits ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
    )}>
      <div>
        <span className="font-medium">{summary.teamName}</span>
        <span className="text-sm text-gray-500 ml-2">
          ({summary.transactionCount} operazioni)
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {summary.creditsBefore} cr
        </span>
        <ArrowRight size={14} className="text-gray-400" />
        <span className={cn(
          'font-bold',
          summary.hasInsufficientCredits ? 'text-red-600' : 'text-emerald-600'
        )}>
          {summary.creditsAfter} cr
        </span>
        {summary.hasInsufficientCredits && (
          <AlertCircle size={16} className="text-red-500" />
        )}
      </div>
    </div>
  );
}

function TransactionRow({
  tx,
  isEditing,
  allPlayers,
  onDiscard,
  onEdit,
  onCancelEdit,
  onSave,
  getTeamName,
  getPlayerName,
}: {
  tx: ValidatedTransaction;
  isEditing: boolean;
  allPlayers: Player[];
  onDiscard: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updates: Partial<ValidatedTransaction>) => void;
  getTeamName: (id: string | null) => string;
  getPlayerName: (id: string | null) => string;
}) {
  const [editState, setEditState] = useState({
    teamId: tx.teamId,
    playerInId: tx.playerInId,
    playerOutId: tx.playerOutId,
    bidPrice: tx.bidPrice,
    isLoan: tx.isLoan,
    isInjured: tx.isInjured,
  });

  const errors = tx.issues.filter(i => i.severity === 'error');
  const warnings = tx.issues.filter(i => i.severity === 'warning');

  if (isEditing) {
    return (
      <div className="p-4 border-2 border-emerald-300 rounded-lg bg-emerald-50">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Squadra
            </label>
            <select
              value={editState.teamId || ''}
              onChange={(e) => setEditState({ ...editState, teamId: e.target.value || null })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">-- Seleziona --</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Giocatore acquistato
            </label>
            <select
              value={editState.playerInId || ''}
              onChange={(e) => setEditState({ ...editState, playerInId: e.target.value || null })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">-- Seleziona --</option>
              {allPlayers
                .filter(p => p.teamId !== editState.teamId)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Giocatore ceduto
            </label>
            <select
              value={editState.playerOutId || ''}
              onChange={(e) => setEditState({ ...editState, playerOutId: e.target.value || null })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">-- Nessuno --</option>
              {editState.teamId && teams
                .find(t => t.id === editState.teamId)?.players
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prezzo offerta
            </label>
            <input
              type="number"
              min={0}
              value={editState.bidPrice}
              onChange={(e) => setEditState({ ...editState, bidPrice: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editState.isLoan}
              onChange={(e) => setEditState({ ...editState, isLoan: e.target.checked })}
            />
            <span className="text-sm">Prestito ({getLoanCost()} cr fissi)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editState.isInjured}
              onChange={(e) => setEditState({ ...editState, isInjured: e.target.checked })}
            />
            <span className="text-sm">Infortunato</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSave(editState)}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1"
          >
            <Save size={16} />
            Salva
          </button>
          <button
            onClick={onCancelEdit}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Annulla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'p-3 rounded-lg border',
      tx.hasBlockingErrors 
        ? 'bg-red-50 border-red-200' 
        : warnings.length > 0 
          ? 'bg-amber-50 border-amber-200'
          : 'bg-emerald-50 border-emerald-200'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{getTeamName(tx.teamId)}</span>
            <span className="text-gray-400">|</span>
            <span className="text-green-600">+ {getPlayerName(tx.playerInId)}</span>
            {tx.playerInRole && (
              <Badge variant="role">{tx.playerInRole}</Badge>
            )}
            {tx.playerOutId && (
              <>
                <span className="text-gray-400">/</span>
                <span className="text-red-600">- {getPlayerName(tx.playerOutId)}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-2 text-sm">
            {tx.isLoan && (
              <Badge variant="default" className="bg-purple-100 text-purple-700">
                Prestito
              </Badge>
            )}
            {tx.isInjured && (
              <Badge variant="default" className="bg-orange-100 text-orange-700">
                Infortunato
              </Badge>
            )}
            <span className="text-gray-500">
              {tx.effectiveCost} crediti
              {tx.isLoan ? ' (fisso)' : ` (offerta: ${tx.bidPrice})`}
            </span>
            {tx.timestamp && (
              <span className="text-gray-400 text-xs">{tx.timestamp}</span>
            )}
          </div>

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="mt-2 space-y-1">
              {errors.map((issue, i) => (
                <div key={i} className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle size={14} />
                  <span>{issue.message}</span>
                </div>
              ))}
              {warnings.map((issue, i) => (
                <div key={i} className="flex items-center gap-1 text-sm text-amber-600">
                  <AlertTriangle size={14} />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-emerald-600 rounded"
            title="Modifica"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDiscard}
            className="p-2 text-gray-400 hover:text-red-600 rounded"
            title="Scarta"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({
  validation,
  activeTransactions,
  effectiveRound,
  onBack,
  onConfirm,
  getTeamName,
  getPlayerName,
}: {
  validation: ValidationResult;
  activeTransactions: ValidatedTransaction[];
  effectiveRound: number;
  onBack: () => void;
  onConfirm: () => void;
  getTeamName: (id: string | null) => string;
  getPlayerName: (id: string | null) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900">Conferma importazione</h3>
      </CardHeader>
      <CardContent>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-amber-700 font-medium">
            <AlertCircle size={18} />
            Attenzione
          </div>
          <p className="text-sm text-amber-600 mt-1">
            Stai per applicare {activeTransactions.length} operazioni di mercato 
            con effetto dalla giornata {effectiveRound}. 
            Le rose verranno aggiornate e i crediti scalati.
          </p>
        </div>

        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {activeTransactions.map((tx) => (
            <div key={tx.id} className="text-sm text-gray-600 flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" />
              <span>
                {getTeamName(tx.teamId)}: +{getPlayerName(tx.playerInId)}
                {tx.playerOutId && ` / -${getPlayerName(tx.playerOutId)}`}
                {' '}({tx.isLoan ? 'prestito' : `${tx.effectiveCost} cr`})
              </span>
            </div>
          ))}
        </div>

        {validation.teamSummaries.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Variazione crediti:</h4>
            {validation.teamSummaries.map(s => (
              <div key={s.teamId} className="text-sm flex justify-between">
                <span>{s.teamName}</span>
                <span className="font-mono">
                  {s.creditsBefore} → {s.creditsAfter} ({s.creditsAfter - s.creditsBefore > 0 ? '+' : ''}{s.creditsAfter - s.creditsBefore})
                </span>
              </div>
            ))}
          </div>
        )}

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
            Conferma e applica
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoneStep({
  transactionCount,
  effectiveRound,
  onReset,
}: {
  transactionCount: number;
  effectiveRound: number;
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
          {transactionCount} operazioni applicate con successo.
          Le rose sono state aggiornate dalla giornata {effectiveRound}.
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

function RulesInfoCard() {
  return (
    <Card className="bg-gray-50">
      <CardHeader>
        <h3 className="font-semibold text-gray-700">Info regole mercato</h3>
      </CardHeader>
      <CardContent className="text-sm text-gray-600 space-y-2">
        <p>• <strong>Prestito (Pre=yes):</strong> costo fisso {getLoanCost()} crediti</p>
        <p>• <strong>Infortunio (Inf=yes):</strong> nessun effetto sui crediti (regola da definire)</p>
        <p>• <strong>Cessione giocatore Serie A:</strong> nessun rimborso</p>
        <p>• <strong>Cessione giocatore uscito dalla Serie A:</strong> rimborso da definire</p>
      </CardContent>
    </Card>
  );
}
