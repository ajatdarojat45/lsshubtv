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

async function ensureSignatures(sportType: number): Promise<Record<number, string>> {
  const key = String(num(sportType));
  const cached = sigCache.get(key);
  if (cached) return cached;
  const r = await getDataBS([100, 102], num(sportType));
  const next = r.signatures;
  sigCache.set(key, next);
  return next;
}

export interface GetMatchesParams {
  source?: MatchSource;
  sportType?: number;
  language?: number;
}

export async function getMatches(
  { source = 'data', sportType = 1, language = 0 }: GetMatchesParams = {}
): Promise<Result<{ list: Match[]; source: MatchSource }>> {
  try {
    const s = await ensureSignatures(sportType);
    const args = { version: s[100], language: num(language), sportType: num(sportType) };
    const r = source === 'live' ? await getLiveMatchLive(args) : await getMatchLive(args);
    const data = r.pb?.data ?? r.payload;
    const list =
      source === 'live'
        ? decodeLiveMatchList(data)
        : decodeMatchLiveResp(data, num(language));
    return { ok: true, data: { list, source } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Aggregate all currently-live matches across every sport category. */
export async function getAllLiveMatches(): Promise<Result<{ list: Match[]; source: MatchSource }>> {
  try {
    const settled = await Promise.allSettled(
      SPORTS.map(async (sport) => {
        const s = await ensureSignatures(sport.value);
        const args = { version: s[100], language: 0, sportType: sport.value };
        const r = await getMatchLive(args);
        const data = r.pb?.data ?? r.payload;
        return decodeMatchLiveResp(data, 0);
      })
    );

    const list = settled
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .filter((m) => isLiveStatus(m.status));

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
