import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/auth/admin';
import { MatchCommentsAdmin } from '@/components/admin/match-comments-admin';
import { teams } from '@/data/teams';
import { calendar } from '@/data/calendar';

export default async function CommentiAdminPage() {
  await connection();
  if ((isAdminConfigured() || process.env.NODE_ENV === 'production') && !(await isAdminAuthenticated())) {
    redirect('/admin');
  }
  const rounds = calendar.map((r) => r.number);
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }));
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700">
        <ArrowLeft size={16} /> Pannello
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Commenti sfide</h1>
        <p className="mt-1 text-sm text-gray-500">
          Analisi qualitativa e chiusura ironica in fondo a ogni partita. Se manca il commento, la sezione resta nascosta.
        </p>
      </div>
      <MatchCommentsAdmin rounds={rounds} teams={teamOptions} pairingsByRound={Object.fromEntries(calendar.map((r) => [r.number, r.pairings]))} />
    </div>
  );
}
