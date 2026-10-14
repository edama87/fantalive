'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Users,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

interface RosterPlayer {
  name: string;
  role: 'P' | 'D' | 'C' | 'A';
  realTeam: string;
  price?: number;
}

interface TeamRoster {
  fmsTeamId: number;
  teamName: string;
  players: RosterPlayer[];
}

interface TeamSummary {
  fmsTeamId: number;
  teamName: string;
  playerCount: number;
  roleBreakdown: { P: number; D: number; C: number; A: number };
}

type ImportStep = 'fetch' | 'review' | 'confirm' | 'done';

export default function RoseAdminPage() {
  const [step, setStep] = useState<ImportStep>('fetch');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [teamsSummary, setTeamsSummary] = useState<TeamSummary[]>([]);
  const [rawHtmlSample, setRawHtmlSample] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  const handleFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/rosters/fetch', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Errore nel recupero delle rose');
      }

      setTeams(data.teams || []);
      setTeamsSummary(data.teamsSummary || []);
      setRawHtmlSample(data.rawHtmlSample || null);
      
      if (data.teams && data.teams.length > 0) {
        setStep('review');
      } else {
        setError('Nessuna rosa trovata. Verifica le credenziali FMS Revo.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/rosters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Errore durante import');
      }

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }, [teams]);

  const handleReset = () => {
    setStep('fetch');
    setTeams([]);
    setTeamsSummary([]);
    setError(null);
    setRawHtmlSample(null);
    setExpandedTeam(null);
  };

  const totalPlayers = teamsSummary.reduce((sum, t) => sum + t.playerCount, 0);
  const expectedRoles = { P: 3, D: 8, C: 8, A: 6 };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ADMIN ROSE" isLive={false} />
      
      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Importa Rose da FMS Revo</h2>
        </div>

        <div className="flex items-center gap-2 text-sm flex-wrap">
          <StepIndicator step="fetch" current={step} label="1. Scarica" />
          <ArrowRight size={16} className="text-gray-400" />
          <StepIndicator step="review" current={step} label="2. Verifica" />
          <ArrowRight size={16} className="text-gray-400" />
          <StepIndicator step="confirm" current={step} label="3. Conferma" />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 font-medium">
              <AlertCircle size={18} />
              Errore
            </div>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        )}

        {step === 'fetch' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download size={20} className="text-gray-500" />
                <h3 className="font-semibold">Scarica rose da FMS Revo</h3>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Accede a FMS Revo e scarica le rose di tutte le squadre della lega.
              </p>
            </CardHeader>
            <CardContent>
              <button
                onClick={handleFetch}
                disabled={isLoading}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium flex items-center gap-2',
                  isLoading
                    ? 'bg-gray-200 text-gray-400 cursor-wait'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Scaricamento in corso...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Scarica Rose da FMS Revo
                  </>
                )}
              </button>

              {rawHtmlSample && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">HTML sample (debug):</p>
                  <pre className="p-2 bg-gray-100 rounded text-xs overflow-x-auto max-h-40">
                    {rawHtmlSample}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'review' && (
          <>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-center px-4">
                    <div className="text-3xl font-bold text-emerald-700">{teams.length}</div>
                    <div className="text-sm text-gray-600">Squadre</div>
                  </div>
                  <div className="text-center px-4 border-l border-emerald-200">
                    <div className="text-3xl font-bold text-emerald-700">{totalPlayers}</div>
                    <div className="text-sm text-gray-600">Giocatori</div>
                  </div>
                  <div className="text-center px-4 border-l border-emerald-200">
                    <div className="text-sm text-gray-600">Media per squadra:</div>
                    <div className="font-medium text-emerald-700">
                      {teams.length > 0 ? Math.round(totalPlayers / teams.length) : 0} giocatori
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold">Rose delle squadre</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamsSummary.map(team => {
                    const fullTeam = teams.find(t => t.fmsTeamId === team.fmsTeamId);
                    const isExpanded = expandedTeam === team.fmsTeamId;
                    const hasCorrectRoles = 
                      team.roleBreakdown.P >= 2 &&
                      team.roleBreakdown.D >= 6 &&
                      team.roleBreakdown.C >= 6 &&
                      team.roleBreakdown.A >= 4;

                    return (
                      <div 
                        key={team.fmsTeamId}
                        className={cn(
                          'border rounded-lg overflow-hidden',
                          hasCorrectRoles ? 'border-emerald-200' : 'border-amber-200'
                        )}
                      >
                        <button
                          onClick={() => setExpandedTeam(isExpanded ? null : team.fmsTeamId)}
                          className={cn(
                            'w-full p-3 flex items-center justify-between',
                            hasCorrectRoles ? 'bg-emerald-50' : 'bg-amber-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Users size={18} className="text-gray-500" />
                            <span className="font-medium">{team.teamName}</span>
                            <Badge variant="default" className="bg-gray-100 text-gray-700">
                              {team.playerCount} giocatori
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-600">P:{team.roleBreakdown.P}</span>
                            <span className="text-green-600">D:{team.roleBreakdown.D}</span>
                            <span className="text-amber-600">C:{team.roleBreakdown.C}</span>
                            <span className="text-red-600">A:{team.roleBreakdown.A}</span>
                            {!hasCorrectRoles && (
                              <AlertTriangle size={16} className="text-amber-500" />
                            )}
                          </div>
                        </button>

                        {isExpanded && fullTeam && (
                          <div className="p-3 bg-white border-t">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              {['P', 'D', 'C', 'A'].map(role => (
                                <div key={role}>
                                  <div className="font-medium text-gray-500 mb-1">
                                    {role === 'P' ? 'Portieri' : role === 'D' ? 'Difensori' : role === 'C' ? 'Centrocampisti' : 'Attaccanti'}
                                  </div>
                                  {fullTeam.players
                                    .filter(p => p.role === role)
                                    .map((p, i) => (
                                      <div key={i} className="text-gray-700 truncate">
                                        {p.name}
                                        <span className="text-gray-400 text-xs ml-1">
                                          ({p.realTeam})
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Ricomincia
              </button>
              
              <button
                onClick={() => setStep('confirm')}
                disabled={teams.length === 0}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium',
                  teams.length > 0
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                Procedi all&apos;importazione →
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Conferma importazione rose</h3>
            </CardHeader>
            <CardContent>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-amber-700 font-medium">
                  <AlertCircle size={18} />
                  Attenzione
                </div>
                <p className="text-sm text-amber-600 mt-1">
                  Stai per importare {totalPlayers} giocatori da {teams.length} squadre.
                  Questa operazione sostituirà le rose esistenti.
                </p>
                <ul className="text-sm text-amber-600 mt-2 list-disc list-inside">
                  <li>I nomi squadra verranno allineati a FMS Revo</li>
                  <li>I giocatori esistenti non più in rosa diventeranno inattivi</li>
                  <li>Le formazioni esistenti saranno preservate</li>
                </ul>
              </div>

              <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
                {teamsSummary.map(team => (
                  <div key={team.fmsTeamId} className="text-sm text-gray-600 flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="font-medium">{team.teamName}</span>
                    <span className="text-gray-400">({team.playerCount} giocatori)</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setStep('review')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  ← Indietro
                </button>
                <button
                  onClick={handleConfirm}
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
                      Importazione...
                    </>
                  ) : (
                    'Conferma e importa'
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="mx-auto text-emerald-600 mb-4" size={48} />
              <h3 className="text-xl font-bold text-emerald-700 mb-2">
                Importazione completata!
              </h3>
              <p className="text-gray-600 mb-4">
                {totalPlayers} giocatori importati da {teams.length} squadre.
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Nuova importazione
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step, current, label }: { step: ImportStep; current: ImportStep; label: string }) {
  const steps: ImportStep[] = ['fetch', 'review', 'confirm', 'done'];
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
