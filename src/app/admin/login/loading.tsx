import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-100 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full animate-pulse" />
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="w-full space-y-4 pt-4">
            <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <Spinner size="md" className="mt-4" />
        </div>
      </div>
    </div>
  );
}
