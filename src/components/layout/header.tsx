'use client';

import { useState, useEffect } from 'react';
import { LiveDot } from '@/components/ui/live-dot';
import { MyTeamLink } from '@/components/layout/my-team-link';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  isLive?: boolean;
}

export function Header({ title = 'FANTALIVE BUNDLESLIGA', subtitle, isLive = true }: HeaderProps) {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-40">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base sm:text-lg font-bold tracking-tight text-gray-900">
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <LiveDot />
              <span>Live</span>
            </div>
          )}
          <MyTeamLink />
          {time && (
            <span className="hidden sm:inline text-sm text-gray-400">{time}</span>
          )}
        </div>
      </div>
      {subtitle && (
        <div className="px-4 pb-2 max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto">
          <span className="text-sm text-gray-500">{subtitle}</span>
        </div>
      )}
    </header>
  );
}
