'use server';

import {
  getDataBS,
  getMatchLive,
  getLiveMatchLive,
  getMatchDetail as apiGetMatchDetail,
  getLiveMatchDetail as apiGetLiveMatchDetail,
  getStreamDetailFull,
} from '@/lib/api';
import {
  decodeMatchLiveResp,
  decodeLiveMatchList,
  decodeMatchDetailResp,
  decodeLiveMatchDetail,
  decodeDataStream,
  isLiveStatus,
} from '@/lib/matchProto';
import { signPlayUrl } from '@/lib/sign';
import { iterFields, rot47 } from '@/lib/proto';
import { SPORTS } from '@/lib/sports';
import { DEFAULT_CONTINENT, DEFAULT_COUNTRY, DEFAULT_SITE_TYPE } from '@/lib/config';
import type { Match, MatchDetail, MatchSource, Stream } from '@/lib/types';

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const num = (v: unknown): number => Number(v) || 0;
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// Simple in-memory signature cache (keyed by sportType).
const sigCache = new Map<string, Record<number, string>>();

/* ---------- Upstream request shaping ----------
 * The upstream API rate-limits aggressively (HTTP 429). Two cheap guards keep
 * us comfortably under the limit without serving meaningfully stale data:
 *   1. In-flight coalescing — concurrent identical calls share ONE upstream
 *      request. This kills the React StrictMode double-invoke and the
 *      multi-tab / multi-subscriber bursts that turn one poll into N.
 *   2. A short success TTL — repeat polls inside the window reuse the last
 *      good payload instead of re-hitting upstream every time.
 * Failures (including 429) are never cached and never shared as a rejection,
 * so a transient error clears on the very next call.
 */
const respCache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = respCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value as T);
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((value) => {
      respCache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Run async tasks with a max concurrency (avoids a wide burst on the limiter). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function ensureSignatures(sportType: number): Promise<Record<number, string>> {
  const key = String(num(sportType));
  const cached = sigCache.get(key);
  if (cached) return cached;
  // Coalesce concurrent signature fetches for the same sport.
  return withCache(`sig:${key}`, 10 * 60_000, async () => {
    const r = await getDataBS([100, 102], num(sportType));
    sigCache.set(key, r.signatures);
    return r.signatures;
  });
}

export interface GetMatchesParams {
  source?: MatchSource;
  sportType?: number;
  language?: number;
}

export async function getMatches(
  { source = 'data', sportType = 1, language = 0 }: GetMatchesParams = {}
): Promise<Result<{ list: Match[]; source: MatchSource }>> {
  // 20s TTL: slightly above the 20s staleTime so back-to-back polls (and the
  // StrictMode double-invoke) collapse into one upstream request, while live
  // scores still refresh about twice a minute. Only successes are cached —
  // a 429 makes the inner fn throw, so it is never stored and clears next call.
  try {
    const data = await withCache(`matches:${source}:${sportType}:${language}`, 20_000, async () => {
      const s = await ensureSignatures(sportType);
      const args = { version: s[100], language: num(language), sportType: num(sportType) };
      const r = source === 'live' ? await getLiveMatchLive(args) : await getMatchLive(args);
      const raw = r.pb?.data ?? r.payload;
      const list =
        source === 'live'
          ? decodeLiveMatchList(raw)
          : decodeMatchLiveResp(raw, num(language));
      return { list, source };
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Aggregate all currently-live matches across every sport category.
 * Two guards prevent this from nuking the rate limiter:
 *   - per-sport results go through the SAME withCache key as getMatches, so a
 *     sport already fetched elsewhere (or by a concurrent caller) is reused;
 *   - mapLimit caps in-flight upstream requests (default 4) instead of firing
 *     all 16 sports at once.
 */
export async function getAllLiveMatches(
  { concurrency = 4 }: { concurrency?: number } = {}
): Promise<Result<{ list: Match[]; source: MatchSource }>> {
  try {
    const perSport = await mapLimit(SPORTS, concurrency, async (sport) => {
      const s = await ensureSignatures(sport.value);
      const args = { version: s[100], language: 0, sportType: sport.value };
      // Reuse the shared cache; failures reject and are skipped below.
      return withCache(`matches:data:${sport.value}:0`, 20_000, async () => {
        const r = await getMatchLive(args);
        const data = r.pb?.data ?? r.payload;
        return decodeMatchLiveResp(data, 0);
      });
    });

    const list = perSport.flat().filter((m) => isLiveStatus(m.status));
    return { ok: true, data: { list, source: 'data' } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export interface MatchDetailParams {
  matchId: string | number;
  sportType?: number;
  language?: number;
  source?: MatchSource;
}

export async function getMatchDetail(
  { matchId, sportType = 1, language = 0, source = 'data' }: MatchDetailParams
): Promise<Result<MatchDetail>> {
  try {
    const s = await ensureSignatures(sportType);
    const args = {
      version: s[102],
      matchId: num(matchId),
      sportType: num(sportType),
      language: num(language),
    };
    const r = source === 'live' ? await apiGetLiveMatchDetail(args) : await apiGetMatchDetail(args);
    const data = r.pb?.data ?? r.payload;
    const detail =
      source === 'live'
        ? decodeLiveMatchDetail(data)
        : decodeMatchDetailResp(data, num(language));
    return { ok: true, data: detail };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export interface StreamUrlParams {
  matchId: string | number;
  streamId: number;
  sportType?: number;
  siteType?: number;
  continent?: string;
  country?: string;
}

export async function getStreamUrl(
  { matchId, sportType, streamId, siteType, continent, country }: StreamUrlParams
): Promise<Result<{ url: string; referer: string }>> {
  try {
    const r = await getStreamDetailFull({
      matchId: num(matchId),
      sportType: num(sportType),
      streamId: num(streamId),
      siteType: num(siteType ?? DEFAULT_SITE_TYPE),
      continent: continent || DEFAULT_CONTINENT,
      country: country || DEFAULT_COUNTRY,
    });
    let stream: Stream | null = null;
    const data = r.pb?.data ?? r.payload;
    if (data) {
      for (const f of iterFields(data)) {
        if (f.field === 2 && f.wire === 2) stream = decodeDataStream(f.value as Uint8Array);
      }
    }
    if (!stream?.url) throw new Error('stream has no url');
    // RBCrypto.decodeStreamUrl: rot47 then drop the first 8 characters.
    const decoded = rot47(stream.url).slice(8);
    const signed = r.rbSession ? await signPlayUrl(decoded, r.rbSession) : decoded;
    const referer = stream.headers?.referer || stream.headers?.Referer || stream.pageUrl || '';
    return { ok: true, data: { url: signed, referer } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
