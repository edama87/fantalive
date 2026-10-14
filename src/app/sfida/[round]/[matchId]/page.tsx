'use client';

import { Suspense } from 'react';
import { SfidaContent } from './sfida-content';

export default function SfidaDettaglioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Caricamento...</p>
      </div>
    }>
      <SfidaContent />
    </Suspense>
  );
}
