'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Radio, Smartphone } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { teams } from '@/data/teams';
import { cn } from '@/lib/utils';
import { saveMyTeamChoice } from '@/lib/my-team';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
import { DEFAULT_NOTIFY_SETTINGS, isIos, loadNotifySettings, REMINDER_OPTIONS, saveNotifySettings, type NotifySettings } from '@/lib/notify-settings';
import { LIVE_EVENT_LABELS, LIVE_EVENT_TYPES, type LiveEventType, type LiveSide } from '@/lib/live-event-notify';
import { getNotifyRegistration, notificationsSupported, showAppNotification } from '@/lib/notify-client';
import { isPushActive, PUSH_STATE_EVENT, pushSupported, sendServerTestPush } from '@/lib/push-client';

type Perm = NotificationPermission | 'unsupported';

export function SettingsContent() {
  const myTeamId = useMyTeamId();
  const [settings, setSettings] = useState<NotifySettings>(DEFAULT_NOTIFY_SETTINGS);
  const [perm, setPerm] = useState<Perm>('default');
  const [ios, setIos] = useState({ device: false, standalone: false });
  const [message, setMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [push, setPush] = useState({ supported: false, active: false });
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setPush({ supported: pushSupported(), active: isPushActive() });
    read();
    window.addEventListener(PUSH_STATE_EVENT, read);
    return () => window.removeEventListener(PUSH_STATE_EVENT, read);
  }, []);

  useEffect(() => {
    // Lettura iniziale di localStorage/API del browser, disponibili solo dopo il montaggio.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSettings(loadNotifySettings());
    setPerm(notificationsSupported() ? Notification.permission : 'unsupported');
    setIos({
      device: isIos(navigator.userAgent, navigator.maxTouchPoints),
      standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const teamId = myTeamId ?? settings.teamId;
  // iPhone/iPad: le notifiche esistono solo nell'app aperta dall'icona della schermata Home.
  const iosBlocked = ios.device && !ios.standalone;
  const iosTooOld = ios.device && ios.standalone && perm === 'unsupported';
  const switchDisabled = !teamId || iosBlocked || iosTooOld;
  const update = (next: Partial<NotifySettings>) => {
    const merged = { ...settings, teamId, ...next };
    setSettings(merged);
    saveNotifySettings(merged);
  };

  const chooseTeam = (id: string) => {
    saveMyTeamChoice(id || null);
    update({ teamId: id || null });
  };

  /** Chiede il permesso (se serve) e restituisce true se le notifiche sono consentite. */
  const ensurePermission = async (): Promise<boolean> => {
    setMessage(null);
    if (perm === 'unsupported') {
      setMessage(ios.device && !ios.standalone ? 'Su iPhone/iPad aggiungi prima l’app alla schermata Home.' : 'Questo browser non supporta le notifiche.');
      return false;
    }
    let p: NotificationPermission = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    setPerm(p);
    if (p !== 'granted') {
      setMessage('Permesso negato: riattiva le notifiche per questo sito nelle impostazioni del browser.');
      return false;
    }
    await getNotifyRegistration();
    return true;
  };

  const toggle = async () => {
    if (settings.enabled) return update({ enabled: false });
    if (await ensurePermission()) update({ enabled: true });
  };

  const toggleLive = async () => {
    if (settings.liveEnabled) return update({ liveEnabled: false });
    if (await ensurePermission()) update({ liveEnabled: true });
  };

  const setLivePref = (type: LiveEventType, side: LiveSide, value: boolean) =>
    update({ live: { ...settings.live, [type]: { ...settings.live[type], [side]: value } } });

  const testLive = async () => {
    const ok = await showAppNotification('⚽ Amatori ProSecco', { body: 'Gol di McTominay (Napoli) 23′', tag: 'test-live' });
    setLiveMessage(ok ? 'Notifica live di prova inviata.' : 'Notifica non inviata: controlla il permesso.');
  };

  const testServer = async () => {
    setPushMessage(null);
    const ok = await sendServerTestPush();
    setPushMessage(ok ? 'Push inviato dal server: chiudi l’app per vederlo arrivare anche in background.' : 'Push non inviato (riprova tra un minuto).');
  };

  const test = async () => {
    const ok = await showAppNotification('⏰ COM–SAS tra 30′', { body: 'In campo: Paz, Douvikas (prova)', tag: 'test' });
    setMessage(ok ? 'Notifica di prova inviata.' : 'Notifica non inviata: controlla il permesso.');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Impostazioni" isLive={false} />
      <div className="space-y-4 px-4 py-4">
        {iosBlocked && <IosInstallHint />}
        {iosTooOld && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Questa versione di iOS non supporta le notifiche web: aggiorna l’iPhone a iOS 16.4 o successivo.
          </div>
        )}
        <Card>
          <CardContent className="space-y-2 p-4">
            <label htmlFor="team" className="text-sm font-semibold text-gray-900">La tua squadra</label>
            <select
              id="team"
              value={teamId ?? ''}
              onChange={(e) => chooseTeam(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Nessuna (vista neutra)</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="text-xs text-gray-500">Evidenzia la tua sfida e decide per quali giocatori arrivano i promemoria.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              {settings.enabled ? <Bell size={18} className="text-emerald-600" aria-hidden /> : <BellOff size={18} className="text-gray-400" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Promemoria partite</p>
                <p className="text-xs text-gray-500">Avviso prima del calcio d’inizio delle partite con i tuoi giocatori.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                aria-label="Attiva promemoria partite"
                disabled={switchDisabled}
                onClick={toggle}
                className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40', settings.enabled ? 'bg-emerald-500' : 'bg-gray-200')}
              >
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', settings.enabled ? 'left-[1.375rem]' : 'left-0.5')} />
              </button>
            </div>
            {!teamId && <p className="text-xs text-amber-700">Scegli prima la tua squadra.</p>}

            <fieldset disabled={!settings.enabled} className="space-y-2 disabled:opacity-50">
              <legend className="text-xs font-medium text-gray-600">Quanto prima</legend>
              <div className="flex gap-2">
                {REMINDER_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={settings.minutesBefore === m}
                    onClick={() => update({ minutesBefore: m })}
                    className={cn('flex-1 rounded-lg border px-3 py-2 text-sm', settings.minutesBefore === m ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-800' : 'border-gray-200 text-gray-600')}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </fieldset>

            {settings.enabled && perm === 'granted' && (
              <button type="button" onClick={test} className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline">Invia una notifica di prova</button>
            )}
            {perm === 'denied' && <p className="text-xs text-red-600">Notifiche bloccate per questo sito: sbloccale dalle impostazioni del browser.</p>}
            {message && <p role="status" className="text-xs text-gray-700">{message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <Radio size={18} className={settings.liveEnabled ? 'text-red-500' : 'text-gray-400'} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Eventi live della sfida</p>
                <p className="text-xs text-gray-500">Gol, assist, rigori ed espulsioni dei giocatori in formazione tuoi e dell’avversario.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.liveEnabled}
                aria-label="Attiva notifiche eventi live"
                disabled={switchDisabled}
                onClick={toggleLive}
                className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40', settings.liveEnabled ? 'bg-emerald-500' : 'bg-gray-200')}
              >
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', settings.liveEnabled ? 'left-[1.375rem]' : 'left-0.5')} />
              </button>
            </div>

            <fieldset disabled={!settings.liveEnabled} className="disabled:opacity-50">
              <legend className="sr-only">Tipi di evento</legend>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="pb-1 text-left font-medium">Evento</th>
                    <th className="w-16 pb-1 text-center font-medium">Noi</th>
                    <th className="w-20 pb-1 text-center font-medium">Avversari</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {LIVE_EVENT_TYPES.map((type) => (
                    <tr key={type}>
                      <td className="py-2 text-gray-800">{LIVE_EVENT_LABELS[type].label}</td>
                      {(['ours', 'opp'] as const).map((side) => (
                        <td key={side} className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={settings.live[type][side]}
                            onChange={(e) => setLivePref(type, side, e.target.checked)}
                            aria-label={`${LIVE_EVENT_LABELS[type].label} ${LIVE_EVENT_LABELS[type][side]}`}
                            className="h-4 w-4 accent-emerald-600"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-gray-500">“Gol · Avversari” sono i gol subiti. Rigore parato: dal portiere di quella squadra. Panchinari solo se entrati.</p>
            </fieldset>

            {settings.liveEnabled && perm === 'granted' && (
              <button type="button" onClick={testLive} className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline">Invia una notifica live di prova</button>
            )}
            {liveMessage && <p role="status" className="text-xs text-gray-700">{liveMessage}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4 text-xs text-gray-600">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Smartphone size={16} aria-hidden /> Come funzionano</p>
            {push.active ? (
              <p><span className="font-semibold text-emerald-700">Notifiche push attive:</span> arrivano anche con l’app chiusa o in background. Durante le partite il server controlla ogni minuto, quindi un evento arriva in 1-2 minuti.</p>
            ) : (
              <p>{push.supported ? 'Attiva una notifica qui sopra per riceverle anche con l’app chiusa.' : 'Su questo browser le notifiche arrivano solo mentre FantaLive è aperta (anche in un’altra scheda).'} Su iPhone servono l’app installata dalla schermata Home e iOS 16.4 o successivo.</p>
            )}
            {push.active && (settings.enabled || settings.liveEnabled) && (
              <button type="button" onClick={testServer} className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline">Invia un push di prova dal server</button>
            )}
            {pushMessage && <p role="status" className="text-xs text-gray-700">{pushMessage}</p>}
            <p>Le preferenze valgono per questo dispositivo.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Passi per installare FantaLive come app su iPhone/iPad: solo così iOS consente le notifiche. */
function IosInstallHint() {
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Su iPhone le notifiche funzionano solo dall’app installata</p>
      <p className="text-xs text-amber-900">Ora stai usando FantaLive in una scheda del browser: qui iOS non permette le notifiche, per questo gli interruttori sono disattivati.</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-amber-900">
        <li>Apri <strong>fantalive-mu.vercel.app</strong> in <strong>Safari</strong> (o Chrome, con iOS 16.4 o successivo).</li>
        <li>Tocca <strong>Condividi</strong> (il quadrato con la freccia) → <strong>Aggiungi alla schermata Home</strong> → <strong>Aggiungi</strong>.</li>
        <li>Chiudi il browser e apri FantaLive <strong>dall’icona col logo FantaLive</strong> sulla schermata Home: deve aprirsi a tutto schermo, senza barra degli indirizzi.</li>
        <li>Torna in <strong>Impostazioni</strong> e attiva le notifiche: tocca <strong>Consenti</strong> quando iOS lo chiede.</li>
      </ol>
      <p className="text-xs text-amber-900"><strong>Hai già un’icona FantaLive</strong> (per esempio una “F” grigia)? È solo un collegamento al sito: tienila premuta → <strong>Rimuovi</strong>, poi aggiungila di nuovo con i passi qui sopra.</p>
    </div>
  );
}
