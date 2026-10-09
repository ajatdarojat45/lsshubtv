import { useQuery, useMutation } from '@tanstack/react-query';
import { getMatches, getMatchDetail, getStreamUrl, getAllLiveMatches } from '@/app/actions';
import type { MatchSource } from '@/lib/types';

/** Match list, cached by (source, sportType). */
export function useMatches(sportType: number, source: MatchSource = 'data', enabled = true) {
  return useQuery({
    queryKey: ['matches', source, sportType],
    queryFn: async () => {
      const res = await getMatches({ source, sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/** All live matches across every sport category. */
export function useAllLiveMatches(enabled: boolean) {
  return useQuery({
    queryKey: ['live-matches'],
    queryFn: async () => {
      const res = await getAllLiveMatches();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/** Match detail, cached by (matchId, sportType). */
export function useMatchDetail(matchId: string | number, sportType?: number) {
  return useQuery({
    queryKey: ['match', matchId, sportType],
    queryFn: async () => {
      const res = await getMatchDetail({ matchId, sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(matchId),
  });
}

export interface StreamUrlInput {
  matchId: string | number;
  streamId: number;
  sportType?: number;
  siteType?: number;
  continent?: string;
  country?: string;
}

/** Stream URL is ephemeral (signed), so it is fetched on demand (not cached). */
export function useStreamUrl() {
  return useMutation({
    mutationFn: async (input: StreamUrlInput) => {
      const res = await getStreamUrl(input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });
}
