// TanStack Query hooks for the streaming video API (see `lib/streamingApi.ts`).
// These are the canonical data layer for /sports/[category] and /watch/[id].

import { useCallback } from 'react';
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
  type QueryClient,
} from '@tanstack/react-query';
import { fetchCategoryVideos, fetchStreamDetail } from './streamingApi';
import type { StreamDetail, Video } from './streamingApi';

/** Categories change slowly — cache 5 minutes to stay under upstream rate limits. */
export const CATEGORY_STALE_TIME = 5 * 60 * 1000;

/** Stream metadata is more volatile than a category list; refresh after 1 minute. */
export const STREAM_DETAIL_STALE_TIME = 60 * 1000;

export const categoryQueryKey = (category: string) => ['streaming', 'category', category] as const;
export const streamDetailQueryKey = (videoId: string) => ['streaming', 'stream', videoId] as const;

/** Video list for a sport category (e.g. "football"). */
export function useGetSportsByCategory(category: string) {
  return useQuery<Video[]>({
    queryKey: categoryQueryKey(category),
    queryFn: () => fetchCategoryVideos(category),
    staleTime: CATEGORY_STALE_TIME,
    // Keep the previous category on screen while the next one loads (no blank flash).
    placeholderData: keepPreviousData,
    enabled: Boolean(category),
  });
}

/** Stream metadata for the watch page — title, description, stream URL, thumbnail. */
export function useGetStreamDetail(videoId: string) {
  return useQuery<StreamDetail>({
    queryKey: streamDetailQueryKey(videoId),
    queryFn: () => fetchStreamDetail(videoId),
    staleTime: STREAM_DETAIL_STALE_TIME,
    enabled: Boolean(videoId),
  });
}

/** Prefetch a category's video list — call this from a category Link's
 *  hover/focus handler so the data is already cached before navigation. */
export function prefetchCategory(queryClient: QueryClient, category: string): void {
  if (!category) return;
  void queryClient
    .prefetchQuery({
      queryKey: categoryQueryKey(category),
      queryFn: () => fetchCategoryVideos(category),
      staleTime: CATEGORY_STALE_TIME,
    })
    .catch(() => {
      // Prefetch is best-effort: a failure here just means no warm cache.
    });
}

/** Convenience hook — returns `(category) => void` bound to the QueryClient. */
export function usePrefetchCategory() {
  const queryClient = useQueryClient();
  return useCallback(
    (category: string) => prefetchCategory(queryClient, category),
    [queryClient]
  );
}
