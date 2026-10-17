'use client';

import type { PlayerMatchData } from '@/types';

export interface RoundPlayerResponse {
  roundNumber: number;
  isLive: boolean;
  players: PlayerMatchData[];
}

export async function fetchRoundPlayerData(roundNumber: number): Promise<{
  playerData: Map<string, PlayerMatchData>;
  isLive: boolean;
  lastUpdated: Date;
}> {
  const res = await fetch(`/api/rounds/${roundNumber}/player-data`, {
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as Partial<RoundPlayerResponse> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || `Voti giornata non disponibili (${res.status})`);
  }

  const playerData = new Map<string, PlayerMatchData>();
  for (const player of body.players ?? []) {
    if (!player?.playerId) continue;
    playerData.set(player.playerId, player);
  }

  return {
    playerData,
    isLive: body.isLive === true,
    lastUpdated: new Date(),
  };
}
