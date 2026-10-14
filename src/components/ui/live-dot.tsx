'use client';

import { cn } from '@/lib/utils';

interface LiveDotProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function LiveDot({ className, size = 'sm' }: LiveDotProps) {
  return (
    <span
      className={cn(
        'relative flex',
        size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
        className
      )}
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className={cn(
        'relative inline-flex rounded-full bg-red-500',
        size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
      )} />
    </span>
  );
}
