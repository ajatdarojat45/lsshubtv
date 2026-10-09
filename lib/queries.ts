import { useQuery, useMutation } from '@tanstack/react-query';
import { getMatches, getMatchDetail, getStreamUrl, getAllLiveMatches } from '@/app/actions';
import type { MatchSource } from '@/lib/types';

/** Never auto-retry a rate-limit (HTTP 429): re-hitting immediately makes the
 * upstream limiter angrier and starves the UI. Other errors get one retry. */
const isRateLimited = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('429');

/** Single-sport list = ONE upstream request per poll, so it can refresh briskly.
 * 30s (was 45s): only one sport is fetched, so this is cheap and keeps the
 * focused view feeling live. A little jitter de-syncs multiple tabs. */
const singlePollInterval = (): number => 30_000 + Math.floor(Math.random() * 4_000);

const SINGLE_POLL = {
  staleTime: 20_000,
  refetchInterval: singlePollInterval,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** Aggregate "All/Live" fans out to every sport (16 upstream requests per
 * poll). Poll it much slower (75s, was 45s) so that burst lands roughly half
 * as often — this is the dominant upstream cost and the main HTTP 429 driver.
 * Live scores still refresh well within ~1.5 min. refetchOnWindowFocus /
 * Reconnect stay OFF: TanStack defaults them to true, so alt-tabbing back
 * would trigger a 16-sport fan-out per focus. */
const allLivePollInterval = (): number => 75_000 + Math.floor(Math.random() * 8_000);

const ALL_LIVE_POLL = {
  staleTime: 30_000,
  refetchInterval: allLivePollInterval,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

const retryPolicy = (failureCount: number, error: unknown): boolean =>
  !isRateLimited(error) && failureCount < 1;

/** Exponential backoff, capped, so a transient 429 cools down instead of hammering. */
const retryDelay = (attemptIndex: number): number => Math.min(1000 * 2 ** attemptIndex, 15_000);

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
    retry: retryPolicy,
    retryDelay,
    ...SINGLE_POLL,
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
    retry: retryPolicy,
    retryDelay,
    ...ALL_LIVE_POLL,
  });
}

/** Match detail, cached by (matchId, sportType). No background polling: the
 * detail page is read-then-play, and re-hitting the rate-limited endpoint on
 * every window focus is exactly what triggers HTTP 429. Keep data fresh for
 * 30s and disable focus/reconnect refetch (TanStack defaults these to true). */
const DETAIL_POLL = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

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
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
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
