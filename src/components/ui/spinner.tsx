import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-gray-200 border-t-emerald-600',
        sizeClasses[size],
        className
      )}
    />
  );
}

export function PageSkeleton({ title }: { title?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          {title && <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />}
        </div>
      </div>
      
      <div className="px-4 py-4 space-y-4 max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="h-4 w-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-8 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="px-4">
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex-1 space-y-2 text-right">
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse ml-auto" />
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse ml-auto" />
        </div>
      </div>
    </div>
  );
}
