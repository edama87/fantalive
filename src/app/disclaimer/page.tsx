import type { Metadata } from 'next';
import Link from 'next/link';
import {
  DISCLAIMER_ITALIC_LINES,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_TITLE,
  DISCLAIMER_UPDATED_AT,
} from '@/lib/disclaimer';

export const metadata: Metadata = {
  title: 'Note legali',
  description: 'Disclaimer di FantaLive per la Bundlesliga',
};

function formatUpdatedAt(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function DisclaimerPage() {
  return (
    <article className="px-4 py-8">
      <p className="text-sm text-gray-400">
        <Link href="/" className="hover:text-gray-600 hover:underline">
          ← Home
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900">{DISCLAIMER_TITLE}</h1>
      <p className="mt-1 text-xs text-gray-400">
        Aggiornato il {formatUpdatedAt(DISCLAIMER_UPDATED_AT)}
      </p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700 sm:text-base">
        {DISCLAIMER_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <div className="space-y-2 pt-1">
          {DISCLAIMER_ITALIC_LINES.map((line) => (
            <p key={line} className="italic text-gray-500">
              {line}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}
