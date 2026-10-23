import type { BonusBreakdown } from '@/types';

/** Pallone rosso dell'autogol (SVG: un'emoji non si colora in modo affidabile). */
export function RedBallIcon({ className = 'inline-block h-[1em] w-[1em] align-[-0.125em]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="10.5" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
      <path d="M12 7.2l3.4 2.5-1.3 4h-4.2l-1.3-4z" fill="#7f1d1d" />
      <path d="M12 7.2V2.3M15.4 9.7l4.6-1.6M14.1 13.7l2.9 4M9.9 13.7l-2.9 4M8.6 9.7L4 8.1" stroke="#7f1d1d" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Icona dell'evento: emoji, o pallone rosso per l'autogol. */
export function EventIcon({ eventKey, emoji }: { eventKey: string; emoji: string }) {
  return eventKey.startsWith('ownGoals') ? <RedBallIcon /> : <>{emoji}</>;
}

/**
 * Unica mappa evento -> emoji: la usano sia la legenda sia le righe giocatore,
 * così non possono divergere.
 */
export const EVENT_EMOJI: ReadonlyArray<{
  key: keyof BonusBreakdown;
  emoji: string;
  label: string;
  /** Etichetta accessibile con conteggio ("Ammonizioni: 4"). */
  countLabel: string;
  points: string;
}> = [
  { key: 'goals', emoji: '⚽', label: 'Gol', countLabel: 'Gol', points: '+3' },
  { key: 'penaltyGoals', emoji: '🅿️', label: 'Rig', countLabel: 'Rigori segnati', points: '+2' },
  { key: 'assists', emoji: '👟', label: 'Assist', countLabel: 'Assist', points: '+1' },
  { key: 'penaltySaved', emoji: '🧤', label: 'Rig parato', countLabel: 'Rigori parati', points: '+3' },
  { key: 'yellowCards', emoji: '🟨', label: 'Amm.', countLabel: 'Ammonizioni', points: '-0,5' },
  { key: 'redCards', emoji: '🟥', label: 'Esp.', countLabel: 'Espulsioni', points: '-1' },
  { key: 'ownGoals', emoji: '🔴⚽', label: 'Autogol', countLabel: 'Autogol', points: '-1' },
  { key: 'penaltyMissed', emoji: '❌', label: 'Rig sbagliato', countLabel: 'Rigori sbagliati', points: '-3' },
  { key: 'goalsConceded', emoji: '🥅', label: 'Gol subito (P)', countLabel: 'Gol subiti', points: '-1' },
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

/** Un'icona per tipo con il conteggio (⚽×2 👟 🟨×4), in ordine fisso. */
export function eventEmojiGroups(
  bonuses: BonusBreakdown,
  options: { includeConceded?: boolean } = {}
): Array<{ key: string; emoji: string; count: number; label: string }> {
  const out: Array<{ key: string; emoji: string; count: number; label: string }> = [];
  for (const entry of EVENT_EMOJI) {
    if (entry.key === 'goalsConceded' && options.includeConceded === false) continue;
    const count = Math.max(0, Math.floor(bonuses[entry.key] ?? 0));
    if (count > 0) out.push({ key: entry.key, emoji: entry.emoji, count, label: `${entry.countLabel}: ${count}` });
  }
  return out;
}

export function EventEmojis({
  bonuses,
  includeConceded = true,
  parenthesized = false,
  className,
}: {
  bonuses: BonusBreakdown;
  includeConceded?: boolean;
  /** Tra parentesi: eventi avvenuti ma che non contano (giocatore in grigio). */
  parenthesized?: boolean;
  className?: string;
}) {
  const items = eventEmojiGroups(bonuses, { includeConceded });
  if (items.length === 0) return null;
  return (
    <span className={className ?? 'inline-flex items-center gap-1 text-sm leading-none whitespace-nowrap'}>
      {parenthesized && <span aria-hidden className="text-gray-400">(</span>}
      {items.map((item) => (
        <span key={item.key} role="img" aria-label={item.label} title={item.label} className="inline-flex items-baseline">
          <EventIcon eventKey={item.key} emoji={item.emoji} />
          {item.count > 1 && (
            <span aria-hidden className="ml-px text-[0.75em] font-semibold tabular-nums text-gray-500">
              ×{item.count}
            </span>
          )}
        </span>
      ))}
      {parenthesized && <span aria-hidden className="text-gray-400">)</span>}
    </span>
  );
}

export function EventLegend({ className }: { className?: string }) {
  return (
    <div className={className ?? 'text-xs text-gray-500'}>
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {EVENT_EMOJI.map((entry) => (
          <li key={entry.key} className="whitespace-nowrap">
            <EventIcon eventKey={entry.key} emoji={entry.emoji} /> {entry.label} {entry.points}
          </li>
        ))}
      </ul>
    </div>
  );
}
