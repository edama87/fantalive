import { connection, NextResponse } from 'next/server';
import { getRoundPlayerState } from '@/lib/round-player-data';

export async function GET(
  _request: Request,
  context: { params: Promise<{ round: string }> }
) {
  await connection();
  const { round } = await context.params;
  const roundNumber = Number.parseInt(round, 10);
  if (!Number.isFinite(roundNumber) || roundNumber < 1) {
    return NextResponse.json({ error: 'Giornata non valida' }, { status: 400 });
  }

  try {
    const { playerData, isLive, fixtures, closed } = await getRoundPlayerState(roundNumber);
    return NextResponse.json({
      roundNumber,
      isLive,
      closed,
      players: [...playerData.values()],
      fixtures,
    });
  } catch (error) {
    console.error('[API] player-data:', error);
    return NextResponse.json(
      { error: 'Voti giornata non disponibili' },
      { status: 500 }
    );
  }
}
