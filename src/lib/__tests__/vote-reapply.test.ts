import { describe, expect, it } from 'vitest';
import { rematchStoredImport } from '@/lib/vote-reapply';
import { assembleRoundPlayerData } from '@/lib/round-player-data';
import type { PianetafantaMatchedPlayer } from '@/lib/pianetafanta';

function stored(name: string, team: string, votes: [number | null, number | null, number | null]): PianetafantaMatchedPlayer {
  return {
    sourceId: name, name, role: 'C', team, teamCode: null, starter: true,
    votes: { gazzetta: votes[0], corriere: votes[1], tuttosport: votes[2] },
    average: 6.67, voteCount: 3, bonuses: [], subIn: null, subOut: null, minutesPlayed: 90,
    playerId: null, matchedName: null,
  } as PianetafantaMatchedPlayer;
}

describe('rematchStoredImport', () => {
  it('riabbina "PEREZ K." e ricalcola la media troncata a 3 decimali', () => {
    const group = rematchStoredImport(
      { serie_a_matchday: 7, match_key: 'VEN-TOR', home_team: 'VEN', away_team: 'TOR',
        players: [stored('PEREZ K.', 'Venezia', [7, 6.5, 6.5]), stored('SCONOSCIUTO X.', 'Venezia', [6, 6, 6])] },
      { players: [{ id: 'perez-enrique-c', name: 'PEREZ Enrique', role: 'C', realTeam: 'VEN' }], aliases: [] }
    );
    expect(group.players[0]).toMatchObject({ playerId: 'perez-enrique-c', average: 6.666 });
    expect(group.matched).toBe(1);
    expect(group.unmatched.map((p) => p.name)).toEqual(['SCONOSCIUTO X.']);
  });
});

describe('assembleRoundPlayerData con partite consolidate', () => {
  const official = [{
    player_id: 'perez', vote_fantacalcio: null, vote_gazzetta: 7, vote_corriere: 6.5, vote_tuttosport: 6.5,
    vote_average: 6.67, source: 'pianetafanta', minutes_played: 90, bonus_malus: [],
  }];
  const live = [
    { player_id: 'kessie', estimated_vote: 6, minutes_played: 0, is_playing: false },
    { player_id: 'altro', estimated_vote: 6.5, minutes_played: 90, is_playing: true },
  ];
  const coverage = {
    teams: new Set(['ATA', 'VEN']),
    playerTeams: new Map<string, string | null>([['kessie', 'Atalanta'], ['altro', 'Juventus'], ['perez', 'Venezia']]),
  };

  it('usa la media consolidata a 3 decimali e scarta le stime live delle partite consolidate', () => {
    const data = assembleRoundPlayerData(official, live, [], coverage);
    expect(data.get('perez')?.estimatedVote).toBe(6.666);
    expect(data.has('kessie')).toBe(false); // s.v.: entra la riserva, nessun 5 segnaposto
    expect(data.get('altro')?.estimatedVote).toBe(6.5);
  });

  it('senza copertura le stime live restano', () => {
    expect(assembleRoundPlayerData(official, live, []).has('kessie')).toBe(true);
  });
});
