'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { teams } from '@/data/teams';
import { cn } from '@/lib/utils';
import { saveMyTeamChoice } from '@/lib/my-team';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
import { DEFAULT_NOTIFY_SETTINGS, isIos, loadNotifySettings, REMINDER_OPTIONS, saveNotifySettings, type NotifySettings } from '@/lib/notify-settings';
import { getNotifyRegistration, notificationsSupported, showAppNotification } from '@/lib/notify-client';

type Perm = NotificationPermission | 'unsupported';

export function SettingsContent() {
  const myTeamId = useMyTeamId();
  const [settings, setSettings] = useState<NotifySettings>(DEFAULT_NOTIFY_SETTINGS);
  const [perm, setPerm] = useState<Perm>('default');
  const [ios, setIos] = useState({ device: false, standalone: false });
  const [message, setMessage] = useState<string | null>(null);

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
  const update = (next: Partial<NotifySettings>) => {
    const merged = { ...settings, teamId, ...next };
    setSettings(merged);
    saveNotifySettings(merged);
  };

  const chooseTeam = (id: string) => {
    saveMyTeamChoice(id || null);
    update({ teamId: id || null });
  };

  const toggle = async () => {
    setMessage(null);
    if (settings.enabled) return update({ enabled: false });
    if (perm === 'unsupported') return setMessage(ios.device && !ios.standalone ? 'Su iPhone/iPad aggiungi prima l’app alla schermata Home.' : 'Questo browser non supporta le notifiche.');
    let p: NotificationPermission = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    setPerm(p);
    if (p !== 'granted') return setMessage('Permesso negato: riattiva le notifiche per questo sito nelle impostazioni del browser.');
    await getNotifyRegistration();
    update({ enabled: true });
  };

  const test = async () => {
    const ok = await showAppNotification('FantaLive', { body: 'Le notifiche funzionano ⚽', tag: 'test' });
    setMessage(ok ? 'Notifica di prova inviata.' : 'Notifica non inviata: controlla il permesso.');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Impostazioni" isLive={false} />
      <div className="space-y-4 px-4 py-4">
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
                disabled={!teamId}
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
          <CardContent className="space-y-2 p-4 text-xs text-gray-600">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Smartphone size={16} aria-hidden /> Come funzionano</p>
            <p>I promemoria partono solo mentre FantaLive è aperta (anche in un’altra scheda): con l’app chiusa non arrivano.</p>
            {ios.device && !ios.standalone && (
              <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Su iPhone/iPad: tocca Condividi → “Aggiungi alla schermata Home” e apri FantaLive da lì (iOS 16.4 o successivo), poi attiva i promemoria.</p>
            )}
            <p>Le preferenze restano solo su questo dispositivo.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
