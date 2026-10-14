'use client';

import { cn } from '@/lib/utils';

interface IconProps {
  className?: string;
  size?: number;
}

export function GoalIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-green-600', className)}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 0 20" />
      <path d="M2 12h20" />
      <path d="M12 2v20" />
    </svg>
  );
}

export function AssistIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-blue-600', className)}
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

export function YellowCardIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('text-yellow-500', className)}
    >
      <rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor" />
    </svg>
  );
}

export function RedCardIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('text-red-500', className)}
    >
      <rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor" />
    </svg>
  );
}

export function PenaltyGoalIcon({ className, size = 16 }: IconProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <span className="text-green-600 text-xs font-bold">Rig</span>
      <GoalIcon size={size - 4} />
    </div>
  );
}

export function PenaltyMissedIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-red-500', className)}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </svg>
  );
}

export function PenaltySavedIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-green-600', className)}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function OwnGoalIcon({ className, size = 16 }: IconProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <span className="text-red-600 text-xs font-bold">AG</span>
    </div>
  );
}

export function SubInIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-green-500', className)}
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export function SubOutIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-red-500', className)}
    >
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  );
}

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const colors: Record<string, string> = {
    P: 'bg-amber-100 text-amber-800',
    D: 'bg-green-100 text-green-800',
    C: 'bg-blue-100 text-blue-800',
    A: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded text-xs font-semibold',
        colors[role] || 'bg-gray-100 text-gray-800',
        className
      )}
    >
      {role}
    </span>
  );
}
