import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals: number = 1): string {
  return num.toFixed(decimals).replace('.', ',');
}

/** Voto con fino a 2 decimali (medie consolidate come 6,67), minimo 1: 6 -> "6,0". */
export function formatVote(num: number): string {
  const fixed = num.toFixed(2).replace(/0$/, '');
  return fixed.replace('.', ',');
}

export function formatMinutes(minutes: number): string {
  return `${minutes}'`;
}
