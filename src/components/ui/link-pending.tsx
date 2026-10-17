'use client';

import type { ReactNode } from 'react';
import { useLinkStatus } from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Da usare dentro un <Link>: mostra un piccolo spinner mentre la navigazione
 * di quel link è in corso, altrimenti `children` (es. l'icona).
 */
export function LinkPendingIcon({
  children,
  size = 16,
  className,
}: {
  children?: ReactNode;
  size?: number;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return <>{children}</>;
  return (
    <Loader2
      size={size}
      aria-label="Caricamento"
      className={cn('animate-spin text-emerald-600 motion-reduce:animate-none', className)}
    />
  );
}

/** Variante senza contenuto di riserva: niente finché non è in attesa. */
export function LinkPendingSpinner(props: { size?: number; className?: string }) {
  return <LinkPendingIcon {...props} />;
}
