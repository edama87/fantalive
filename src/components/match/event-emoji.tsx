import type { BonusBreakdown } from '@/types';

/**
 * Unica mappa evento -> emoji: la usano sia la legenda sia le righe giocatore,
 * così non possono divergere.
 */
export const EVENT_EMOJI: ReadonlyArray<{
  key: keyof BonusBreakdown;
  emoji: string;
  label: string;
  points: string;
}> = [
  { key: 'goals', emoji: '⚽', label: 'Gol', points: '+3' },
  { key: 'penaltyGoals', emoji: '🅿️', label: 'Rig', points: '+2' },
  { key: 'penaltyMissed', emoji: '❌', label: 'Rig sbagliato', points: '-3' },
  { key: 'penaltySaved', emoji: '🧤', label: 'Rig parato', points: '+3' },
  { key: 'assists', emoji: '👟', label: 'Assist', points: '+1' },
  { key: 'yellowCards', emoji: '🟨', label: 'Amm.', points: '-0,5' },
  { key: 'redCards', emoji: '🟥', label: 'Esp.', points: '-1' },
  { key: 'ownGoals', emoji: '⚽↩️', label: 'Autogol', points: '-1' },
  { key: 'goalsConceded', emoji: '🥅', label: 'Gol subito (P)', points: '-1' },
];

/** Emoji ripetute per conteggio (es. ⚽⚽⚽ per una tripletta). */
export function eventEmojiSequence(
  bonuses: BonusBreakdown,
  options: { includeConceded?: boolean } = {}
): Array<{ key: string; emoji: string; label: string }> {
  const out: Array<{ key: string; emoji: string; label: string }> = [];
  for (const entry of EVENT_EMOJI) {
    if (entry.key === 'goalsConceded' && options.includeConceded === false) continue;
    const count = Math.max(0, bonuses[entry.key] ?? 0);
    for (let i = 0; i < count; i += 1) {
      out.push({ key: `${entry.key}-${i}`, emoji: entry.emoji, label: entry.label });
    }
  }
  return out;
}

export function EventEmojis({
  bonuses,
  includeConceded = true,
  className,
}: {
  bonuses: BonusBreakdown;
  includeConceded?: boolean;
  className?: string;
}) {
  const items = eventEmojiSequence(bonuses, { includeConceded });
  if (items.length === 0) return null;
  return (
    <span className={className ?? 'inline-flex items-center gap-0.5 text-sm leading-none whitespace-nowrap'}>
      {items.map((item) => (
        <span key={item.key} role="img" aria-label={item.label} title={item.label}>
          {item.emoji}
        </span>
      ))}
    </span>
  );
}

export function EventLegend({ className }: { className?: string }) {
  return (
    <div className={className ?? 'text-xs text-gray-500'}>
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {EVENT_EMOJI.map((entry) => (
          <li key={entry.key} className="whitespace-nowrap">
            {entry.emoji} {entry.label} {entry.points}
          </li>
        ))}
      </ul>
    </div>
  );
}
