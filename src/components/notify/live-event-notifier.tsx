'use client';

import { useEffect, useState } from 'react';
import { getCurrentRound, getMatchForTeam } from '@/data/calendar';
import { getTeamById } from '@/data/teams';
import { fetchLineupBundle, createLineupProviderFromMap } from '@/lib/lineup-store';
import { fetchRoundPlayerData } from '@/lib/round-player-data-client';
import { collectLiveNotifications } from '@/lib/live-event-notify';
import { loadNotifySettings, NOTIFY_SETTINGS_EVENT, type NotifySettings } from '@/lib/notify-settings';
import { notificationsSupported, showAppNotification } from '@/lib/notify-client';
import { isPushActive, PUSH_STATE_EVENT } from '@/lib/push-client';
import type { Player } from '@/types';

const SEEN_KEY = 'fantalive_live_seen';
const POLL_LIVE = 90_000;
const POLL_IDLE = 10 * 60_000;

function readSeen(): { round: number; keys: string[] } | null {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); } catch { return null; }
}
function writeSeen(round: number, keys: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ round, keys: keys.slice(-500) })); } catch { /* storage bloccato */ }
}

/**
 * Notifiche degli eventi live (gol, rigori, espulsioni) dei giocatori in formazione
 * della mia sfida. Gira nel browser mentre l'app è aperta: ogni 90 s con partite live,
 * ogni 10 min altrimenti. Gli eventi già presenti all'attivazione non vengono notificati.
 */
export function LiveEventNotifier() {
  const [settings, setSettings] = useState<NotifySettings | null>(null);
  const [pushActive, setPushActive] = useState(false);

  useEffect(() => {
    const read = () => { setSettings(loadNotifySettings()); setPushActive(isPushActive()); };
    read();
    window.addEventListener(NOTIFY_SETTINGS_EVENT, read);
    window.addEventListener(PUSH_STATE_EVENT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(NOTIFY_SETTINGS_EVENT, read); window.removeEventListener(PUSH_STATE_EVENT, read); window.removeEventListener('storage', read); };
  }, []);

  useEffect(() => {
    if (!settings?.liveEnabled || !settings.teamId || !notificationsSupported() || Notification.permission !== 'granted') return;
    // Push dal server attivo: le notifiche arrivano da lì, niente doppioni locali.
    if (pushActive) return;
    const teamId = settings.teamId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      let live = false;
      try {
        const round = getCurrentRound();
        const pairing = getMatchForTeam(round.number, teamId);
        if (!pairing) return;
        const oppId = pairing.homeTeamId === teamId ? pairing.awayTeamId : pairing.homeTeamId;
        const [data, bundle] = await Promise.all([
          fetchRoundPlayerData(round.number),
          fetchLineupBundle(round.number).catch(() => ({ lineups: {}, players: {} as Record<string, Player> })),
        ]);
        if (cancelled) return;
        live = data.isLive || data.fixtures.some((f) => f.status === 'live' || f.status === 'halftime');
        const lineupOf = createLineupProviderFromMap(bundle.lineups);
        const side = (id: string) => {
          const l = lineupOf(id, round.number);
          return { teamName: getTeamById(id)?.name ?? id, starters: l.starters.map((s) => s.playerId), bench: l.bench.map((s) => s.playerId) };
        };
        const players: Record<string, Player> = {};
        for (const id of [teamId, oppId]) for (const p of getTeamById(id)?.players ?? []) players[p.id] = p;
        Object.assign(players, bundle.players);
        const all = collectLiveNotifications({
          round: round.number, ours: side(teamId), opp: side(oppId), playerData: data.playerData, players, fixtures: data.fixtures, prefs: settings.live,
        });
        const seen = readSeen();
        if (!seen || seen.round !== round.number) {
          // Prima lettura della giornata su questo dispositivo: segna, non notificare il passato.
          writeSeen(round.number, all.map((n) => n.key));
          return;
        }
        const known = new Set(seen.keys);
        const fresh = all.filter((n) => !known.has(n.key));
        if (fresh.length === 0) return;
        writeSeen(round.number, [...seen.keys, ...fresh.map((n) => n.key)]);
        for (const n of fresh) await showAppNotification(n.title, { body: n.body, tag: n.key, url: `/sfida/${round.number}/${pairing.homeTeamId}-${pairing.awayTeamId}` });
      } catch {
        // rete o API non disponibili: riprova al prossimo giro
      } finally {
        if (!cancelled) timer = setTimeout(() => void poll(), live ? POLL_LIVE : POLL_IDLE);
      }
    };

    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [settings, pushActive]);

  return null;
}
