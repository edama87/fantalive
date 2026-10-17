import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals: number = 1): string {
  return num.toFixed(decimals).replace('.', ',');
}

/**
 * Unico formatter per voti, fantavoti e totali: fino a 2 decimali con la virgola,
 * minimo 1 (6 -> "6,0", 6,67 -> "6,67", 11,333 -> "11,33"). Arrotonda solo in
 * visualizzazione: i calcoli usano sempre il valore pieno.
 */
export function formatVote(num: number, options: { integerWithoutDecimals?: boolean } = {}): string {
  const fixed = num.toFixed(2).replace(/0$/, '');
  const out = fixed.replace('.', ',');
  // Modificatori e bonus: "+1" invece di "+1,0".
  return options.integerWithoutDecimals ? out.replace(/,0$/, '') : out;
}

/** Modificatori/bonus con segno: +1, -0,5, +1,5, 0. */
export function formatSignedPoints(num: number): string {
  return `${num > 0 ? '+' : ''}${formatVote(num, { integerWithoutDecimals: true })}`;
}

export function formatMinutes(minutes: number): string {
  return `${minutes}'`;
}
