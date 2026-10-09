// Protobuf decoders for match list & match detail.
// Field mapping from the decompiled sources:
//
// data.proto:
//   PBMatchLiveResp:    1 = repeated PBDataMatch, 2 = stream, 3 = odds
//   PBMatchDetailResp:  1 = PBDataMatch, 2 = stream
//   PBDataMatch:  1=matchId, 2=sportType, 3=matchDate, 4=status, 10=league,
//                 11=season, 12=stage, 19=name, 20=home, 21=away,
//                 22=homeScore, 23=awayScore, 30=contender, 40=group, 41=round, 80=hot
//   PBDataLeague: 1=leagueId, 3=name, 4=logo, 80=country, 90=hot
//   PBDataTeam:   1=teamId, 3=name, 4=logo, 80=country, 90=hot
//   PBDataContender (field 30, REPEATED, one entry per competitor —
//                 verified against live API data):
//                 [title entry] 2=name(slug, e.g. "Santos FC - SP vs Flamengo - RJ")
//                 [competitor]  1=side?, 10=team(PBDataTeam)            (football)
//                               2=name(slug) only                        (tenis #1)
//                               20=team(PBDataTeam)                      (tenis #2)
//                               21=team(PBDataTeam)                      (tenis #3)
//                 Entry order = home first, away second.
//
// live.proto:
//   PBLiveMatchList: 1 = repeated PBLiveMatch
//   PBLiveMatch:     1 = PBMatch, 2 = channel
//   PBMatch:  1=matchId, 2=matchDate, 3=showStatus, 4=status, 5=name,
//             10=sportType, 11=scoringMatch, 20=leagueName, 21=vs(PBMatchVS)
//   PBMatchVS: 1=home(PBTeam), 2=away(PBTeam), 10=name
//   PBTeam:    2=name, 3=logo, 4=score

import { iterFields } from './proto';
import type { Team, League, Contender, Match, Stream, MatchDetail } from './types';

const dec = new TextDecoder('utf-8', { fatal: false });
/** Decode a length-delimited field. Never throws on varint input (returns ''). */
const str = (b: number | Uint8Array): string =>
  typeof b === 'number' ? '' : dec.decode(b as Uint8Array);

export const MATCH_STATUS: Record<number, string> = {
  0: 'Upcoming',
  10: 'LIVE',
  100: 'LIVE',
  101: '1st Half',
  102: 'Half Time',
  103: '2nd Half',
  104: 'Overtime',
  105: 'Penalties',
  200: 'LIVE',
  201: 'Q1',
  202: 'Q2',
  203: 'Q3',
  204: 'Q4',
  211: 'OT1',
  212: 'OT2',
  213: 'OT3',
  214: 'OT4',
  300: 'LIVE (Tennis)',
  400: 'LIVE (Baseball)',
  600: 'LIVE (Cricket)',
  10000: 'Finished',
  10001: 'Cancelled',
  10002: 'Cut',
};

export const statusLabel = (code?: number): string => MATCH_STATUS[code ?? 0] ?? `#${code}`;

export const isLiveStatus = (code?: number): boolean =>
  code === 10 || (code !== undefined && code >= 100 && code < 1000);

/** Match already started (live now, or finished/cancelled/cut)? */
export const isStarted = (code?: number): boolean =>
  isLiveStatus(code) || (code ?? 0) >= 10000;

/** name in data.proto = map<languageCode, string>; each entry is {1: key, 2: value}. */
function decodeNameEntry(buf: Uint8Array): [number, string] | null {
  let key: number | undefined;
  let val: string | undefined;
  for (const e of iterFields(buf)) {
    if (e.field === 1) key = e.value as number;
    else if (e.field === 2 && e.wire === 2) val = str(e.value);
  }
  return key !== undefined && val !== undefined ? [key, val] : null;
}

export function pickLocalName(map: Record<number, string> | string | undefined, lang: number): string {
  if (!map) return '';
  if (typeof map === 'string') return map;
  return map[lang] ?? map[0] ?? Object.values(map)[0] ?? '';
}

/* ---------- data.proto (DataAPI) ---------- */
function decodeDataTeam(buf: Uint8Array, lang: number): Team {
  const t: Team = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1) t.teamId = f.value as number;
    else if (f.field === 3 && f.wire === 2) {
      const e = decodeNameEntry(f.value as Uint8Array);
      if (e) (t.nameMap ??= {})[e[0]] = e[1];
    } else if (f.field === 4 && f.wire === 2) t.logo = str(f.value);
    else if (f.field === 80 && f.wire === 2) t.country = str(f.value);
    else if (f.field === 90) t.hot = !!f.value;
  }
  t.name = pickLocalName(t.nameMap, lang);
  return t;
}

function decodeDataLeague(buf: Uint8Array, lang: number): League {
  const l: League = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1) l.leagueId = f.value as number;
    else if (f.field === 3 && f.wire === 2) {
      const e = decodeNameEntry(f.value as Uint8Array);
      if (e) (l.nameMap ??= {})[e[0]] = e[1];
    } else if (f.field === 4) l.logo = str(f.value);
    else if (f.field === 80) l.country = str(f.value);
    else if (f.field === 90) l.hot = !!f.value;
  }
  l.name = pickLocalName(l.nameMap, lang);
  return l;
}

export function decodeDataMatch(buf: Uint8Array, lang: number): Match {
  const m: Match = { source: 'data' };
  const contenderTeams: Team[] = [];
  let contenderSlug = '';
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: m.matchId = f.value as number; break;
      case 2: m.sportType = f.value as number; break;
      case 3: m.matchDate = f.value as number; break;
      case 4: m.status = f.value as number; break;
      case 10: m.league = decodeDataLeague(f.value as Uint8Array, lang); break;
      case 11:
        if (f.wire === 2) {
          const nameMap: Record<number, string> = {};
          for (const s of iterFields(f.value as Uint8Array)) {
            if (s.field === 3 && s.wire === 2) {
              const e = decodeNameEntry(s.value as Uint8Array);
              if (e) nameMap[e[0]] = e[1];
            } else if (s.field === 50 && s.wire === 2) {
              for (const y of iterFields(s.value as Uint8Array)) {
                if (y.field === 1 && y.wire === 2) m.season = str(y.value);
              }
            }
          }
          m.season = pickLocalName(nameMap, lang) || m.season;
        }
        break;
      case 12: m.stage = str(f.value); break;
      case 19: m.name = str(f.value); break;
      case 20: if (f.wire === 2) m.home = decodeDataTeam(f.value as Uint8Array, lang); break;
      case 21: if (f.wire === 2) m.away = decodeDataTeam(f.value as Uint8Array, lang); break;
      case 22: m.homeScore = f.value as number; break;
      case 23: m.awayScore = f.value as number; break;
      case 30: {
        // Contender sports (football, tenis, ...): field 30 REPEATED, satu
        // entry per kompetitor. Entry judul hanya berisi field 2 (slug "A vs
        // B"); entry kompetitor membawa tim PBDataTeam di field 10
        // (football), 20 atau 21 (tenis). Urutan entry = home dulu, away
        // kemudian — dipakai sebagai penentu sisi utama, dengan nomor field
        // team sebagai penentu tambahan (20=home, 21=away).
        for (const cf of iterFields(f.value as Uint8Array)) {
          if (cf.wire !== 2) continue;
          if (cf.field === 10 || cf.field === 20 || cf.field === 21) {
            const team = decodeDataTeam(cf.value as Uint8Array, lang);
            const idx = contenderTeams.length;
            contenderTeams.push(team);
            if (cf.field === 20 && !m.home) m.home = team;
            else if (cf.field === 21 && !m.away) m.away = team;
            else if (idx === 0 && !m.home && !m.away) m.home = team;
            else if (idx === 1 && !m.away) m.away = team;
            else if (!m.home) m.home = team;
            else if (!m.away) m.away = team;
          } else if (cf.field === 2 && !contenderSlug) {
            contenderSlug = str(cf.value);
          }
        }
        break;
      }
      case 40: m.group = str(f.value); break;
      case 41: m.round = str(f.value); break;
      case 80: m.hot = !!f.value; break;
      default: break;
    }
  }
  // Contender sports (tenis): entry slug pertama ("A vs B") menjadi judul
  // bila field 19 tidak ada; home/away sudah diisi inline pada case 30.
  if (!m.name && contenderSlug) m.title = contenderSlug;
  if (contenderTeams.length) m.contenders = contenderTeams.map((team) => ({ team }));
  return m;
}
export function decodeMatchLiveResp(payload: Uint8Array, lang: number): Match[] {
  const matches: Match[] = [];
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) matches.push(decodeDataMatch(f.value as Uint8Array, lang));
  }
  return matches;
}

/** entry map<string,string>: {1: key, 2: value} */
function decodeStrMapEntry(buf: Uint8Array): [string, string] | null {
  let k: string | undefined;
  let v: string | undefined;
  for (const e of iterFields(buf)) {
    if (e.field === 1) k = str(e.value);
    else if (e.field === 2) v = str(e.value);
  }
  return k !== undefined ? [k, v ?? ''] : null;
}

// PBDataStream (data/proto/stream/PBDataStream.java)
export function decodeDataStream(buf: Uint8Array): Stream {
  const s: Stream = { headers: {}, extra: {} };
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: s.streamId = f.value as number; break;
      case 3: s.name = str(f.value); break;
      case 4: s.url = str(f.value); break;
      case 5: s.streamStatus = f.value as number; break; // 1 = PLAYABLE
      case 6: s.availableType = f.value as number; break;
      case 7: s.recommend = !!f.value; break;
      case 8: s.priority = f.value as number; break;
      case 9: s.siteType = f.value as number; break;
      case 10: s.fullName = str(f.value); break;
      case 11: s.urlCdnType = f.value as number; break;
      case 20: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) s.headers[e[0]] = e[1];
        break;
      }
      case 21: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) s.extra[e[0]] = e[1];
        break;
      }
      case 50: s.matchId = f.value as number; break;
      case 120: s.pageUrl = str(f.value); break;
      default: break;
    }
  }
  return s;
}

// PBChannel (live/proto/live/PBChannel.java)
export function decodeChannel(buf: Uint8Array): Stream {
  const c: Stream = { headers: {}, extra: {} };
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: c.channelId = f.value as number; break;
      case 2: c.name = str(f.value); break;
      case 3: c.url = str(f.value); break;
      case 4: c.status = f.value as number; break;
      case 5: c.availableType = f.value as number; break;
      case 10: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) c.headers[e[0]] = e[1];
        break;
      }
      case 11: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) c.extra[e[0]] = e[1];
        break;
      }
      case 20: c.matchId = f.value as number; break;
      case 30: c.siteType = f.value as number; break;
      default: break;
    }
  }
  return c;
}

export function decodeMatchDetailResp(payload: Uint8Array, lang: number): MatchDetail {
  const out: MatchDetail = { source: 'data', streams: [] };
  const streams = out.streams!;
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) out.match = decodeDataMatch(f.value as Uint8Array, lang);
    else if (f.field === 2 && f.wire === 2) streams.push(decodeDataStream(f.value as Uint8Array));
  }
  return out;
}
/* ---------- live.proto (LiveAPI) ---------- */

function decodeLiveTeam(buf: Uint8Array): Team {
  const t: Team = {};
  for (const f of iterFields(buf)) {
    if (f.field === 2) t.name = str(f.value);
    else if (f.field === 3) t.logo = str(f.value);
    else if (f.field === 4) t.score = f.value as number;
  }
  return t;
}

function decodeLiveMatch(buf: Uint8Array): Match {
  const m: Match = { source: 'live' };
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: m.matchId = f.value as number; break;
      case 2: m.matchDate = f.value as number; break;
      case 3: m.showStatus = f.value as number; break;
      case 4: m.status = f.value as number; break;
      case 5: m.name = str(f.value); break;
      case 10: m.sportType = f.value as number; break;
      case 11: m.scoringMatch = !!f.value; break;
      case 20: m.league = { name: str(f.value) }; break;
      case 21: {
        for (const v of iterFields(f.value as Uint8Array)) {
          if (v.field === 1) m.home = decodeLiveTeam(v.value as Uint8Array);
          else if (v.field === 2) m.away = decodeLiveTeam(v.value as Uint8Array);
        }
        break;
      }
      default: break;
    }
  }
  if (m.home && m.home.score !== undefined) m.homeScore = m.home.score;
  if (m.away && m.away.score !== undefined) m.awayScore = m.away.score;
  return m;
}

export function decodeLiveMatchList(payload: Uint8Array): Match[] {
  const matches: Match[] = [];
  for (const f of iterFields(payload)) {
    if (f.field !== 1 || f.wire !== 2) continue; // repeated PBLiveMatch
    const item: { match?: Match } = {};
    for (const e of iterFields(f.value as Uint8Array)) {
      if (e.field === 1 && e.wire === 2) item.match = decodeLiveMatch(e.value as Uint8Array);
    }
    if (item.match) matches.push(item.match);
  }
  return matches;
}

export function decodeLiveMatchDetail(payload: Uint8Array): MatchDetail {
  // PBLiveMatch: 1 = PBMatch, 2 = repeated PBChannel
  const out: MatchDetail = { source: 'live', channels: [] };
  const channels = out.channels!;
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) out.match = decodeLiveMatch(f.value as Uint8Array);
    else if (f.field === 2 && f.wire === 2) channels.push(decodeChannel(f.value as Uint8Array));
  }
  return out;
}

/** Stream is playable? (PBStreamStatus.SS_PLAYABLE = 1) */
export const isPlayable = (s: Stream): boolean => (s.streamStatus ?? s.status) === 1 && !!s.url;

/* ---------- util ---------- */

/** matchDate can be seconds or milliseconds — normalize to ms. */
export function matchDateMs(matchDate?: number): number | null {
  if (!matchDate) return null;
  return matchDate < 1e12 ? matchDate * 1000 : matchDate;
}

export function formatMatchDate(matchDate?: number): string {
  const ms = matchDateMs(matchDate);
  if (!ms) return '-';
  return new Date(ms).toLocaleString('en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}



