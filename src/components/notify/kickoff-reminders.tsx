'use client';

import { useEffect, useState } from 'react';
import { getCurrentRound } from '@/data/calendar';
import { getTeamById } from '@/data/teams';
import { fetchLineupBundle, createLineupProviderFromMap } from '@/lib/lineup-store';
import { fetchRoundPlayerData } from '@/lib/round-player-data-client';
import { buildMatchRecap } from '@/lib/match-recap';
import { loadNotifySettings, NOTIFY_SETTINGS_EVENT, planReminders, type NotifySettings } from '@/lib/notify-settings';
import { notificationsSupported, showAppNotification } from '@/lib/notify-client';
import type { Player } from '@/types';

const SENT_KEY = 'fantalive_notify_sent';
const MAX_TIMEOUT = 2 ** 31 - 1;

function alreadySent(tag: string): boolean {
  try { return (JSON.parse(localStorage.getItem(SENT_KEY) || '[]') as string[]).includes(tag); } catch { return false; }
}
function markSent(tag: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(SENT_KEY) || '[]') as string[]).filter((t) => t !== tag).slice(-50);
    localStorage.setItem(SENT_KEY, JSON.stringify([...list, tag]));
  } catch { /* localStorage pieno o bloccato */ }
}

/**
 * Promemoria prima del calcio d'inizio, programmati nel browser mentre l'app è aperta
 * (nessun push dal server). Si riprogramma ogni 10 minuti e al cambio impostazioni.
 */
export function KickoffReminders() {
  const [settings, setSettings] = useState<NotifySettings | null>(null);

  useEffect(() => {
    const read = () => setSettings(loadNotifySettings());
    read();
    window.addEventListener(NOTIFY_SETTINGS_EVENT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(NOTIFY_SETTINGS_EVENT, read); window.removeEventListener('storage', read); };
  }, []);

  useEffect(() => {
    if (!settings?.enabled || !settings.teamId || !notificationsSupported() || Notification.permission !== 'granted') return;
    const teamId = settings.teamId;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const schedule = async () => {
      const round = getCurrentRound();
      const [roundData, bundle] = await Promise.all([
        fetchRoundPlayerData(round.number).catch(() => null),
        fetchLineupBundle(round.number).catch(() => ({ lineups: {}, players: {} as Record<string, Player> })),
      ]);
      if (cancelled || !roundData) return;
      const lineup = createLineupProviderFromMap(bundle.lineups)(teamId, round.number);
      const roster = new Map((getTeamById(teamId)?.players ?? []).map((p) => [p.id, p]));
      const inputs = [...lineup.starters.map((s) => ({ s, starter: true })), ...lineup.bench.map((s) => ({ s, starter: false }))]
        .map(({ s, starter }) => ({ player: bundle.players[s.playerId] ?? roster.get(s.playerId), isStarter: starter }))
        .filter((x): x is { player: Player; isStarter: boolean } => !!x.player);
      const recap = buildMatchRecap(roundData.fixtures, inputs, []);
      const plan = planReminders(recap.map((e) => ({ fixture: e.fixture, players: e.home })), settings.minutesBefore, Date.now());
      timers.forEach(clearTimeout);
      timers = plan
        .filter((r) => !alreadySent(r.tag) && r.at - Date.now() < MAX_TIMEOUT)
        .map((r) => setTimeout(() => {
          if (alreadySent(r.tag)) return;
          markSent(r.tag);
          void showAppNotification(r.title, { body: r.body, tag: r.tag, url: '/' });
        }, r.at - Date.now()));
    };

    void schedule();
    const refresh = setInterval(() => void schedule(), 10 * 60_000);
    return () => { cancelled = true; clearInterval(refresh); timers.forEach(clearTimeout); };
  }, [settings]);

  return null;
}
