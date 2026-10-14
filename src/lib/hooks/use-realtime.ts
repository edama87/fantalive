/**
 * Supabase Realtime Hook
 * 
 * Subscribe to real-time updates from Supabase tables.
 * Falls back to polling when Supabase is not configured.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getPublicClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOptions<T> {
  table: string;
  filter?: { column: string; value: string | number };
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
  pollingIntervalMs?: number;
}

interface UseRealtimeResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

export function useRealtime<T extends Record<string, unknown>>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  pollingIntervalMs = 60000,
}: UseRealtimeOptions<T>): UseRealtimeResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getPublicClient();
      let query = supabase.from(table).select('*');

      if (filter) {
        query = query.eq(filter.column, filter.value);
      }

      const { data: fetchedData, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setData((fetchedData as T[]) || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  }, [table, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const interval = setInterval(fetchData, pollingIntervalMs);
      return () => clearInterval(interval);
    }

    const supabase = getPublicClient();
    
    let filterString = `*`;
    if (filter) {
      filterString = `${filter.column}=eq.${filter.value}`;
    }

    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filter ? filterString : undefined,
        },
        (payload) => {
          const newRecord = payload.new as T;
          const oldRecord = payload.old as T;

          switch (payload.eventType) {
            case 'INSERT':
              setData(prev => [...prev, newRecord]);
              onInsert?.(newRecord);
              break;
            case 'UPDATE':
              setData(prev => 
                prev.map(item => 
                  (item as Record<string, unknown>).id === (newRecord as Record<string, unknown>).id 
                    ? newRecord 
                    : item
                )
              );
              onUpdate?.(newRecord);
              break;
            case 'DELETE':
              setData(prev => 
                prev.filter(item => 
                  (item as Record<string, unknown>).id !== (oldRecord as Record<string, unknown>).id
                )
              );
              onDelete?.(oldRecord);
              break;
          }
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, onInsert, onUpdate, onDelete, pollingIntervalMs, fetchData]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}

type LiveVote = Record<string, unknown> & {
  player_id: string;
  estimated_vote: number | null;
  is_estimated: boolean;
  minutes_played: number;
  is_playing: boolean;
  is_subbed_out: boolean;
  updated_at: string;
};

type LiveEvent = Record<string, unknown> & {
  player_id: string;
  event_type: string;
  minute: number;
};

type SerieAMatch = Record<string, unknown> & {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  minute: number;
  status: string;
};

interface UseLiveDataResult {
  votes: LiveVote[];
  events: LiveEvent[];
  matches: SerieAMatch[];
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

export function useLiveData(roundNumber: number): UseLiveDataResult {
  const votesResult = useRealtime<LiveVote>({
    table: 'live_votes',
    filter: { column: 'round_number', value: roundNumber },
  });

  const eventsResult = useRealtime<LiveEvent>({
    table: 'live_events',
    filter: { column: 'round_number', value: roundNumber },
  });

  const matchesResult = useRealtime<SerieAMatch>({
    table: 'serie_a_matches',
    filter: { column: 'round_number', value: roundNumber },
  });

  return {
    votes: votesResult.data,
    events: eventsResult.data,
    matches: matchesResult.data,
    isLoading: votesResult.isLoading || eventsResult.isLoading || matchesResult.isLoading,
    error: votesResult.error || eventsResult.error || matchesResult.error,
    lastUpdated: votesResult.lastUpdated,
  };
}
