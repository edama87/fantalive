'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { getTeamById } from '@/data/teams';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
import { LinkPendingIcon } from '@/components/ui/link-pending';

/** Squadra scelta su questo dispositivo, con link per cambiarla. */
export function MyTeamLink() {
  const myTeamId = useMyTeamId();
  const pathname = usePathname();
  const team = myTeamId ? getTeamById(myTeamId) : undefined;
  const label = team?.name ?? 'Scegli squadra';
  return (
    <Link
      href={`/benvenuto?next=${encodeURIComponent(pathname || '/')}`}
      className="flex max-w-[8.5rem] sm:max-w-[12rem] items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:border-emerald-300 hover:text-emerald-700"
      title="Cambia la tua squadra"
    >
      <LinkPendingIcon size={12} className="shrink-0">
        <UserRound size={12} className="shrink-0" aria-hidden />
      </LinkPendingIcon>
      <span className="truncate">{label}</span>
    </Link>
  );
}
