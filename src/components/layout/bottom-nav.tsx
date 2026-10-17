'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Swords, Calendar, Trophy, Settings } from 'lucide-react';
import { LinkPendingIcon } from '@/components/ui/link-pending';

const navItems = [
  { href: '/', label: 'Live', icon: Home },
  { href: '/sfida', label: 'Sfida', icon: Swords },
  { href: '/partite', label: 'Serie A', icon: Calendar },
  { href: '/classifica', label: 'Classifica', icon: Trophy },
  { href: '/admin', label: 'Admin', icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(href));
}

function NavContent() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = isActivePath(pathname, href);
        
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full',
              'transition-colors',
              isActive ? 'text-emerald-600' : 'text-gray-400'
            )}
          >
            <LinkPendingIcon size={22}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </LinkPendingIcon>
            <span className={cn(
              'text-xs mt-1',
              isActive && 'font-medium'
            )}>
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-inset-bottom z-50">
      <Suspense fallback={
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <div key={href} className="flex flex-col items-center justify-center flex-1 h-full text-gray-400">
              <Icon size={22} strokeWidth={2} />
              <span className="text-xs mt-1">{label}</span>
            </div>
          ))}
        </div>
      }>
        <NavContent />
      </Suspense>
    </nav>
  );
}

function SideNavLinks() {
  const pathname = usePathname();
  return (
    <>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
              isActive
                ? 'bg-emerald-50 text-emerald-700 font-medium'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <LinkPendingIcon size={20}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </LinkPendingIcon>
            {label}
          </Link>
        );
      })}
    </>
  );
}

/** Navigazione laterale su desktop (>= lg); su telefono e tablet resta la barra in basso. */
export function SideNav() {
  return (
    <nav className="hidden lg:flex fixed inset-y-0 left-0 w-56 flex-col gap-1 border-r border-gray-100 bg-white px-3 py-5 z-50">
      <div className="px-3 pb-5 text-base font-bold tracking-tight text-gray-900">
        FantaLive
        <span className="block text-xs font-normal text-gray-400">Bundlesliga</span>
      </div>
      <Suspense
        fallback={navItems.map(({ href, label, icon: Icon }) => (
          <div key={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-500">
            <Icon size={20} strokeWidth={2} />
            {label}
          </div>
        ))}
      >
        <SideNavLinks />
      </Suspense>
    </nav>
  );
}
