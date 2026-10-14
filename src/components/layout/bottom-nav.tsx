'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Swords, Calendar, Trophy } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Live', icon: Home },
  { href: '/sfida', label: 'Sfida', icon: Swords },
  { href: '/partite', label: 'Serie A', icon: Calendar },
  { href: '/classifica', label: 'Classifica', icon: Trophy },
];

function NavContent() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || 
          (href !== '/' && pathname.startsWith(href));
        
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
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-inset-bottom z-50">
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
