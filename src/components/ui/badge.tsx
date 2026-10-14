'use client';

import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800',
        live: 'bg-amber-50 text-amber-700 border border-amber-200',
        role: 'bg-gray-100 text-gray-600',
        userTeam: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        goal: 'bg-green-100 text-green-800',
        assist: 'bg-blue-100 text-blue-800',
        card: 'bg-yellow-100 text-yellow-800',
        redCard: 'bg-red-100 text-red-800',
        penalty: 'bg-purple-100 text-purple-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
