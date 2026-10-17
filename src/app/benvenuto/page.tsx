import { Suspense } from 'react';
import { connection } from 'next/server';
import { getPublicClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { teams as staticTeams } from '@/data/teams';
import { TeamChooser, type ChooserTeam } from './team-chooser';
import { ChooserSkeleton } from './chooser-skeleton';

export const instant = false;

async function loadTeams(): Promise<ChooserTeam[]> {
  const fallback = staticTeams.map((t) => ({ id: t.id, name: t.name, managerName: t.managerName }));
  if (!isSupabaseConfigured()) return fallback;
  try {
    const { data, error } = await getPublicClient()
      .from('teams')
      .select('id, name, manager_name')
      .order('name');
    if (error || !data?.length) return fallback;
    return data.map((row) => ({ id: row.id as string, name: row.name as string, managerName: (row.manager_name as string) ?? '' }));
  } catch {
    return fallback;
  }
}

async function Chooser({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const [teams, query] = await Promise.all([loadTeams(), searchParams]);
  return <TeamChooser teams={teams} next={query.next ?? '/'} />;
}

export default function BenvenutoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <Suspense fallback={<ChooserSkeleton />}>
      <Chooser searchParams={searchParams} />
    </Suspense>
  );
}
