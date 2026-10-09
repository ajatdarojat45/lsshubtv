import { md5 } from './md5';
import { parsePBResponse, extractPayload, parseBodySignatures } from './proto';
import { DATA_API, LIVE_API, RB_HEADERS } from './constants';

export interface RawResponse {
  status: number;
  bytes: Uint8Array;
  headers: Headers;
}

export interface ProtobufResponse {
  status: number;
  url: string;
  pb: ReturnType<typeof parsePBResponse>;
  payload: Uint8Array;
  rawSize: number;
}

/* ---------- Global outbound throttle ----------
 * Every control-plane upstream request funnels through fetchRaw. A single
 * spacing limiter guarantees a minimum gap between consecutive calls so a
 * fan-out (e.g. getAllLiveMatches across 16 sports, or React StrictMode's
 * double invoke) can never burst the upstream rate limiter. Streaming media
 * does NOT go through here, so video playback is unaffected. Module state
 * persists per Node server instance, so this is a process-global limiter —
 * the same assumption the existing sigCache/inflight maps already rely on. */
let throttleChain: Promise<void> = Promise.resolve();
let lastReqAt = 0;
const MIN_REQ_GAP_MS = 150;

function scheduleUpstream<T>(fn: () => Promise<T>): Promise<T> {
  const run = throttleChain.then(async () => {
    const wait = MIN_REQ_GAP_MS - (Date.now() - lastReqAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastReqAt = Date.now();
    return fn();
  });
  // Keep the chain progressing even if a request rejects.
  throttleChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Fetch one upstream API endpoint, spaced by the global throttle, with a
 * bounded + Retry-After-aware backoff on HTTP 429 so a transient rate limit
 * self-heals instead of surfacing to the UI. The backoff sleeps inside the
 * scheduled slot, which also applies backpressure to every queued request. */
async function fetchRaw(url: string, options?: RequestInit): Promise<RawResponse> {
  return scheduleUpstream(async () => {
    const doFetch = () =>
      fetch(url, {
        ...options,
        headers: { ...RB_HEADERS, ...((options?.headers as Record<string, string>) ?? {}) },
      });
    for (let attempt = 0; ; attempt++) {
      const res = await doFetch();
      if (res.status === 429 && attempt < 2) {
        await res.arrayBuffer().catch(() => undefined); // drain before retry
        // Honor Retry-After (seconds) when present; else exponential backoff.
        const ra = Number(res.headers.get('retry-after'));
        const base = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 600 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, Math.min(base, 8000)));
        continue;
      }
      const body = await res.arrayBuffer();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return { status: res.status, bytes: new Uint8Array(body), headers: res.headers };
    }
  });
}

/** GET then parse as PBResponse + extract the payload. */
async function getProtobuf(url: string): Promise<ProtobufResponse> {
  const { status, bytes } = await fetchRaw(url);
  const pb = parsePBResponse(bytes);
  return { status, url, pb, payload: extractPayload(pb), rawSize: bytes.length };
}

/** Fetch endpoint "version" signatures. code 100 = match/live, 102 = match/detail. */
async function getSignatures(base: string, codes: number[], sportType: number) {
  const bsPath = base === LIVE_API ? '/common/bs' : '/api/common/bs';
  const qs = codes.map((c) => `code=${c}`).join('&') + `&sportType=${sportType}&stream=true`;
  const r = await getProtobuf(base + bsPath + '?' + qs);
  return { ...r, signatures: parseBodySignatures(r.payload) };
}

export const getDataBS = (codes: number[], sportType: number) =>
  getSignatures(DATA_API, codes, sportType);

export const getLiveBS = (codes: number[], sportType: number) =>
  getSignatures(LIVE_API, codes, sportType);

export interface MatchQuery {
  version: string;
  language: number;
  sportType: number;
}

export interface MatchDetailQuery extends MatchQuery {
  matchId: number;
}

/* ---------- DataAPI ---------- */

export function getMatchLive({ version, language, sportType }: MatchQuery) {
  const qs = `language=${language}&sportType=${sportType}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/live?${qs}`);
}

export function getMatchDetail({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/detail?${qs}`);
}

export interface StreamDetailQuery {
  matchId: number;
  sportType: number;
  streamId: number;
  siteType: number;
  continent: string;
  country: string;
}

/** Full version: also return the response headers (to capture rb-session). */
export async function getStreamDetailFull({
  matchId,
  sportType,
  streamId,
  siteType,
  continent,
  country,
}: StreamDetailQuery) {
  const qs =
    `matchId=${matchId}&sportType=${sportType}&streamId=${streamId}&siteType=${siteType}` +
    `&continent=${continent}&country=${country}&digit=snd&withOriginal=true`;
  const url = `${DATA_API}/api/stream/detail?${qs}`;
  const { status, bytes, headers } = await fetchRaw(url);
  const pb = parsePBResponse(bytes);
  return {
    status,
    url,
    pb,
    payload: extractPayload(pb),
    rawSize: bytes.length,
    rbSession: headers.get('rb-session') || '',
  };
}

/* ---------- LiveAPI ---------- */

export function getLiveMatchLive({ version, language, sportType }: MatchQuery) {
  const qs = `language=${language}&sportType=${sportType}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${LIVE_API}/sfver${params}${version}/match/live?${qs}`);
}

export function getLiveMatchDetail({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${LIVE_API}/sfver${params}${version}/match/detail?${qs}`);
}
