import { Spinner, CardSkeleton } from '@/components/ui/spinner';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <div className="flex items-center justify-center py-4">
          <Spinner size="md" />
        </div>
        
        <CardSkeleton />
        <CardSkeleton />
      </div>
      
      <BottomNav />
    </div>
  );
}
