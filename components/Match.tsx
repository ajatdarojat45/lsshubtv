'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { Flame, Tv, Loader2, Dot } from 'lucide-react';
import { statusLabel, isLiveStatus, isStarted, formatMatchDate, matchDateMs, isPlayable } from '@/lib/matchProto';
import { countryLogoUrl, teamLogoUrl } from '@/lib/logos';
import { sportColor, sportIcon, sportLabel, sportIsScoring } from '@/lib/sports';
import type { Match, MatchDetail, Stream, Team } from '@/lib/types';
import StreamPlayer from './StreamPlayer';
/* ------------------------------------------------------------------------- *
 * Shared Tailwind class strings — replacements for the retired custom CSS
 * component classes (see `@layer components` in app/globals.css).
 * ------------------------------------------------------------------------- */

/** Logo box sizes: `.logo` was 22px/6px radius; contexts override it. */
type LogoSize = 'base' | 'league' | 'rowTeam' | 'head' | 'detailTeam';
const LOGO_SIZE: Record<LogoSize, string> = {
  base: 'h-[22px] w-[22px] rounded-md text-[11px]',
  league: 'h-4 w-4 rounded-[4px] text-[11px]',
  rowTeam: 'h-6 w-6 rounded-md text-[11px]',
  head: 'h-[34px] w-[34px] rounded-lg text-[15px]',
  detailTeam:
    'h-10 w-10 rounded-lg text-[16px] max-[640px]:h-8 max-[640px]:w-8 max-[640px]:text-[14px]',
};
/** `.logo` — the `<img>` variant. */
const LOGO_IMG = 'shrink-0 object-contain';
/** `.logo-empty` — the initial-letter placeholder variant. */
const LOGO_EMPTY =
  'inline-flex shrink-0 items-center justify-center bg-[#e8eaed] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft';

/** `.row-team-side` (+ `.row-team > span` / `.detail-team > span` ellipsis). */
const TEAM_SIDE =
  'inline-flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis';
/** `.row-team-member` */
const TEAM_MEMBER = 'inline-flex min-w-0 items-center gap-1.5';
/** `.row-team-name` */
const TEAM_NAME = 'min-w-0 overflow-hidden whitespace-nowrap text-ellipsis';

/** `.status` pill (shared base). */
const STATUS =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1 text-[11px] font-semibold';
/** `.status` — idle. */
const STATUS_IDLE = `${STATUS} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)]`;
/** `.status.status-live` */
const STATUS_LIVE = `${STATUS} bg-[var(--live-soft)] text-[#d93025] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#f87171]`;
/** `.status-live .dot` (blinking live indicator) */
const STATUS_DOT =
  'h-[7px] w-[7px] shrink-0 rounded-full bg-current animate-[blink_1.2s_infinite]';

/** `.match-row` base — responsive grid-areas stay in globals.css (unlayered). */
const ROW_BASE =
  'match-row grid w-full grid-cols-[120px_1fr_auto] items-center gap-2.5 rounded-xl border border-l-[3px] bg-card px-4 py-3 text-left transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow max-[1024px]:grid-cols-[110px_1fr_auto] max-[1024px]:px-3.5 max-[768px]:grid-cols-[1fr_auto] max-[768px]:gap-x-3 max-[768px]:gap-y-2';
/** `.match-row` (upcoming/idle) — sport-coloured left accent only. */
const ROW = `${ROW_BASE} border-border border-l-[color:var(--sport-color,transparent)] hover:border-[#c7ccd2]`;
/** `.match-row.is-live` — live is the exception: the whole border (all sides)
 *  turns red, not just the left accent. */
const ROW_LIVE = `${ROW_BASE} border-[color:var(--live)]`;
/** `.match-row` finished — muted gray left accent only (other sides normal). */
const ROW_FINISHED = `${ROW_BASE} border-border border-l-[#9ca3af]`;
/** `.row-date` (grid-area placement stays in globals.css) */
const ROW_DATE =
  'row-date flex min-w-0 flex-col items-start gap-[5px] whitespace-nowrap text-xs text-muted';
/** `.row-sport` sport pill — tinted per-sport color is applied inline in
 *  MatchRow (backgroundColor = sportColor + alpha, color = sportColor). */
const ROW_SPORT =
  'row-sport inline-flex max-w-full items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-[2px]';
/** `.row-main` (grid-area placement stays in globals.css) */
const ROW_MAIN = 'row-main flex min-w-0 flex-col gap-1';
/** `.row-status` (grid-area placement stays in globals.css) */
const ROW_STATUS = 'row-status flex items-center gap-2 justify-self-end';
/** `.row-team` (home side; `.row-team.away` adds justify-end) */
const ROW_TEAM = 'flex min-w-0 items-center gap-2 text-[15px] font-bold';

/** `.sk` shimmer block (pseudo-element rendered via `after:` utilities). */
const SK =
  'relative overflow-hidden rounded-lg bg-[#e8eaed] after:absolute after:inset-0 after:content-[""] after:animate-[shimmer_1.4s_infinite] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] [[data-theme=dark]_&]:bg-border-soft [[data-theme=dark]_&]:after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]';

/** `.detail-countdown` inside `.player-placeholder` (48px, 32px ≤640). */
const COUNTDOWN =
  'whitespace-nowrap text-[48px] font-extrabold tabular-nums tracking-[0.01em] text-[#f3f4f6] max-[640px]:text-[32px]';
/** `.detail-countdown.is-done` inside `.player-placeholder` (22px, 18px ≤640). */
const COUNTDOWN_DONE =
  'whitespace-nowrap text-[22px] font-bold tabular-nums tracking-[0.01em] text-[#9ca3af] max-[640px]:text-[18px]';

/** `.channels-toggle` — open state handled by the separate string below. */
const TOGGLE_BASE =
  'absolute left-3 top-3 z-5 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[13px] font-semibold backdrop-blur-[6px] transition-colors duration-150 bg-[rgba(255,255,255,0.9)] [[data-theme=dark]_&]:bg-[rgba(0,0,0,0.7)]';
const TOGGLE = `${TOGGLE_BASE} border-border text-text`;
/** `.channels-toggle.open` */
const TOGGLE_OPEN = `${TOGGLE_BASE} border-accent text-accent`;

/** `.channel-item` — active state handled by the separate string below. */
const CHANNEL_ITEM =
  'pointer-events-auto inline-flex max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap text-ellipsis rounded-full px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-[4px] transition-colors duration-150';
const CHANNEL_IDLE = `${CHANNEL_ITEM} bg-[rgba(0,0,0,0.55)] hover:bg-[rgba(0,0,0,0.75)]`;
/** `.channel-item.active` */
const CHANNEL_ACTIVE = `${CHANNEL_ITEM} bg-[rgba(34,211,238,0.55)]`;

/** `.error-banner` */
const ERROR_BANNER =
  'mb-4 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]';


export function TeamLogo({
  path,
  name,
  sportType,
  kind = 'team',
  size = 'base',
}: {
  path?: string;
  name?: string;
  sportType?: number;
  kind?: 'team' | 'league';
  size?: LogoSize;
}) {
  const [broken, setBroken] = useState(false);
  // Server actions already expand raw filenames, but cached payloads may
  // still carry a bare filename — resolve client-side as a safety net.
  const src = kind === 'league' ? countryLogoUrl(path) : teamLogoUrl(sportType, path);
  useEffect(() => { setBroken(false); }, [src]);
  if (!src || broken) {
    const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return <span className={`${LOGO_EMPTY} ${LOGO_SIZE[size]}`} aria-hidden="true">{initial}</span>;
  }
  // Logo hostnames change/expire often and may not resolve from the server
  // network — load straight from upstream in the browser. onError falls back
  // to the initial-letter placeholder, never a broken image.
  return <img className={`${LOGO_IMG} ${LOGO_SIZE[size]}`} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

/** One side of a versus matchup. Singles render one logo+name; doubles
 * (tennis/badminton ganda) stack every player/team with their logo, matching
 * the app's "name[0] / name[2]" vs "name[1] / name[3]" pairing. */
function TeamSide({ teams, sportType, size = 'rowTeam' }: { teams?: Team[]; sportType?: number; size?: LogoSize }) {
  const list = teams?.length ? teams : [];
  if (!list.length) return <span className={TEAM_NAME}>{'?'}</span>;
  return (
    <span className={TEAM_SIDE}>
      {list.map((t, i) => (
        <span className={TEAM_MEMBER} key={t.teamId ?? t.playerId ?? i}>
          {i > 0 && <span className="mr-1.5 font-bold opacity-60">/</span>}
          <TeamLogo path={t.logo} name={t.name} sportType={sportType} size={size} />
          <span className={TEAM_NAME}>{t.name || '?'}</span>
        </span>
      ))}
    </span>
  );
}

export function StatusBadge({ status, className }: { status?: number; className?: string }) {
  const live = isLiveStatus(status);
  return (
    <span className={`${live ? STATUS_LIVE : STATUS_IDLE}${className ? ` ${className}` : ''}`}>
      {live && <span className={STATUS_DOT} />}
      {statusLabel(status)}
    </span>
  );
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Live countdown to a kickoff timestamp (ms since epoch), ticking every second. */
export function Countdown({ targetMs }: { targetMs: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = targetMs - now;
  if (diff <= 0) {
    return <div className={COUNTDOWN_DONE} role="timer">Starting…</div>;
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const clock =
    days > 0
      ? `${days}d ${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`
      : `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;

  return <div className={COUNTDOWN} role="timer">{clock}</div>;
}

export function MatchRowSkeleton() {
  return (
    <div className={ROW}>
      <div className={`${SK} h-3 w-[30%]`} />
      <div className={ROW_MAIN}>
        <div className={`${SK} h-3 w-1/2`} />
        <div className="flex items-center gap-2.5">
          <div className={`${SK} h-6 w-6 shrink-0 rounded-md`} />
          <div className={`${SK} h-3 w-[70%]`} />
          <div className={`${SK} ml-auto h-[18px] w-11 rounded-md`} />
        </div>
      </div>
      <div className={`${SK} h-3 w-2/5`} />
    </div>
  );
}

interface MatchRowProps {
  match: Match;
  onClick: () => void;
}

export function MatchRow({ match, onClick }: MatchRowProps) {
  const live = isLiveStatus(match.status);
  // Live/finished → missing score shown as 0; upcoming → shown as "-".
  const started = isStarted(match.status);
  /** Finished / cancelled / cut → muted gray border instead of the sport accent. */
  const finished = (match.status ?? 0) >= 10000;
  const score = (v?: number): number | string => (v ?? (started ? 0 : '-'));
  const league = match.league?.name || match.name || match.title || '—';
  const eventName = match.title || match.name || match.league?.name || '—';
  const sportName = sportLabel(match.sportType);
  const SportIcon = sportIcon(match.sportType);
  const color = sportColor(match.sportType);
  const scoring = sportIsScoring(match.sportType);
  return (
    <button
      type="button"
      className={live ? ROW_LIVE : finished ? ROW_FINISHED : ROW}
      style={{ '--sport-color': color } as CSSProperties}
      onClick={onClick}
    >
      <span className={ROW_DATE}>
        <span className={ROW_SPORT} style={{ backgroundColor: `${color}26`, color }} title={sportName}>
          <SportIcon className="h-[13px] w-[13px] shrink-0" />
          <span className="truncate">{sportName}</span>
        </span>
        <span className="max-[768px]:hidden">{formatMatchDate(match.matchDate)}</span>
      </span>

      <span className={ROW_MAIN}>
        <span className="flex min-w-0 items-center justify-center gap-1.5 text-xs font-semibold text-muted">
          <TeamLogo path={match.league?.logo} name={league} kind="league" size="league" />
          <span className="truncate">{league}</span>
        </span>

        {scoring ? (
          <span className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2.5">
            <span className={ROW_TEAM}>
              <TeamSide teams={match.homeTeams?.length ? match.homeTeams : match.home ? [match.home] : []} sportType={match.sportType} />
            </span>
            {started ? (
              <span className="whitespace-nowrap text-[17px] font-extrabold tabular-nums">{score(match.homeScore)} : {score(match.awayScore)}</span>
            ) : (
              <span className="whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.08em] text-muted">VS</span>
            )}
            <span className={`${ROW_TEAM} justify-end`}>
              <TeamSide teams={match.awayTeams?.length ? match.awayTeams : match.away ? [match.away] : []} sportType={match.sportType} />
            </span>
          </span>
        ) : (
          <span className="truncate text-[15px] font-bold" title={eventName}>{eventName}</span>
        )}
      </span>

      <span className={ROW_STATUS}>
        {match.hot && <Flame className="h-3.5 w-3.5 shrink-0" />}
        <StatusBadge status={match.status} />
      </span>
    </button>
  );
}
interface PlayingState {
  key: number;
  url: string;
  referer: string;
  label: string;
}

interface MatchDetailProps {
  detail: MatchDetail;
  resolveStream: (stream: Stream) => Promise<{ url: string }>;
  /** Fallback sportType when the detail payload doesn't carry one. */
  sportType?: number;
}

export function MatchDetail({ detail, resolveStream, sportType }: MatchDetailProps) {
  const m = detail.match;
  const streams = detail.streams ?? detail.channels ?? [];
  const [playing, setPlaying] = useState<PlayingState | null>(null);
  const [resolving, setResolving] = useState(-1);
  const [playErr, setPlayErr] = useState('');
  const [showChannels, setShowChannels] = useState(false);
  const failedRef = useRef<Set<number>>(new Set());
  const playingRef = useRef<PlayingState | null>(null);
  const autoPlayRef = useRef(false);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Auto-pick the first playable channel once the match has started;
  // upcoming matches wait in the countdown frame instead.
  useEffect(() => {
    if (!streams.length || autoPlayRef.current) return;
    if (!isStarted(m?.status)) return;
    autoPlayRef.current = true;
    const idx = streams.findIndex((s) => isPlayable(s));
    const pick = idx >= 0 ? idx : 0;
    void playChannel(streams[pick], pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streams, m?.status]);

  const streamLabel = (s: Stream, i: number): string =>
    s.fullName || s.name || `Channel #${s.streamId ?? s.channelId ?? i}`;

  async function playChannel(s: Stream, i: number): Promise<PlayingState | null> {
    setPlayErr('');
    let url = s.url;
    if (!url && resolveStream) {
      setResolving(i);
      try {
        const r = await resolveStream(s);
        url = r?.url;
      } catch (e) {
        setPlayErr(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setResolving(-1);
      }
    }
    if (!url) {
      setPlayErr('This channel has no URL and resolveStream is unavailable.');
      return null;
    }
    const referer = s.headers?.referer || s.headers?.Referer || s.pageUrl || '';
    const next: PlayingState = { key: i, url, referer, label: streamLabel(s, i) };
    setPlaying(next);
    return next;
  }

  async function handlePlay(s: Stream, i: number): Promise<void> {
    if (playingRef.current?.key === i) {
      setPlaying(null);
      return;
    }
    failedRef.current.clear();
    await playChannel(s, i);
  }

  // Auto-switch to another channel when the active one goes offline.
  async function handleOffline(): Promise<void> {
    const current = playingRef.current?.key;
    if (current != null) failedRef.current.add(current);

    const candidates = streams
      .map((s, idx) => ({ s, idx }))
      .filter(({ idx }) => idx !== current && !failedRef.current.has(idx))
      .sort((a, b) => (isPlayable(b.s) ? 1 : 0) - (isPlayable(a.s) ? 1 : 0));

    for (const { s, idx } of candidates) {
      const ok = await playChannel(s, idx);
      if (ok) return;
    }

    setPlayErr('All channels are currently offline.');
    setPlaying(null);
  }

  const handleReady = (): void => {
    failedRef.current.clear();
  };

  if (!m) return <p className="text-muted">No match data.</p>;

  const league = m.league?.name || m.name || m.title || '-';
  // Non-versus sports (e.g. Motorsport, Fighting, Cycling) have no home/away
  // score → hide the detail-score section entirely.
  const versus = sportIsScoring(m.sportType ?? sportType);
  const started = isStarted(m.status);
  const kickoffMs = matchDateMs(m.matchDate);
  // Upcoming → the player frame shows a countdown (streaming-style layout).
  const showFrameCountdown = !started && kickoffMs !== null;
  const kickoffTime = kickoffMs
    ? new Date(kickoffMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '-';
  // Live/finished → missing score shown as 0; upcoming → shown as "-" (as in MatchRow).
  const score = (v?: number): number | string => (v ?? (started ? 0 : '-'));

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center gap-3 max-[640px]:gap-2">
        <TeamLogo path={m.league?.logo} name={league} kind="league" size="head" />
        <div className="min-w-0">
          <strong className="block text-[16px] max-[640px]:overflow-hidden max-[640px]:text-ellipsis max-[640px]:whitespace-nowrap">{league}</strong>
          <div className="text-muted max-[640px]:overflow-hidden max-[640px]:text-ellipsis max-[640px]:whitespace-nowrap">
            {formatMatchDate(m.matchDate)}
            {m.round ? ` • Round ${m.round}` : ''}
            {m.season ? ` • ${m.season}` : ''}
          </div>
        </div>
        <StatusBadge status={m.status} className="ml-auto max-[640px]:shrink-0" />
      </div>

      {versus && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-border px-6 py-5 [background:var(--detail-score-bg)] max-[640px]:gap-2.5 max-[640px]:px-3 max-[640px]:py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 text-[16px] font-semibold last:justify-end max-[768px]:text-[15px] max-[640px]:gap-2 max-[640px]:text-[14px]">
            <TeamSide teams={m.homeTeams?.length ? m.homeTeams : m.home ? [m.home] : []} sportType={m.sportType ?? sportType} size="detailTeam" />
          </div>
          {started ? (
            <div className="whitespace-nowrap text-[28px] font-extrabold tabular-nums max-[768px]:text-[24px] max-[640px]:text-[22px]">
              {score(m.homeScore)} : {score(m.awayScore)}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-[3px] whitespace-nowrap">
              <span className="text-[28px] font-extrabold tabular-nums tracking-[0.01em] max-[768px]:text-[24px] max-[640px]:text-[22px]">{kickoffTime}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Kick-off</span>
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-3 text-[16px] font-semibold last:justify-end max-[768px]:text-[15px] max-[640px]:gap-2 max-[640px]:text-[14px]">
            <TeamSide teams={m.awayTeams?.length ? m.awayTeams : m.away ? [m.away] : []} sportType={m.sportType ?? sportType} size="detailTeam" />
          </div>
        </div>
      )}

      <h4 className="mb-2.5 mt-[18px] text-sm">Stream ({streams.length})</h4>

      <div className="relative mt-3.5 overflow-hidden rounded-xl border border-border bg-black">
        {playing ? (
          <StreamPlayer
            url={playing.url}
            referer={playing.referer}
            onError={handleOffline}
            onReady={handleReady}
          />
        ) : showFrameCountdown ? (
          <div className="relative flex aspect-video max-h-[480px] w-full items-center justify-center bg-black min-[1025px]:max-h-[560px]">
            <div className="p-4 text-center text-muted">
              <p className="mb-1 mt-0 text-xs font-bold uppercase tracking-[0.08em] text-[#9ca3af]">Kick-off in</p>
              <Countdown targetMs={kickoffMs} />
            </div>
          </div>
        ) : (
          <div className="relative flex aspect-video max-h-[480px] w-full items-center justify-center bg-black min-[1025px]:max-h-[560px]">
            <div className="p-4 text-center text-muted">
              <Tv className="h-10 w-10" />
              <p className="mt-2.5 text-[13px]">
                {streams.length
                  ? 'Select a channel to start watching'
                  : 'No streams available for this match.'}
              </p>
            </div>
          </div>
        )}

        {streams.length > 0 && (
          <button
            type="button"
            className={showChannels ? TOGGLE_OPEN : TOGGLE}
            onClick={() => setShowChannels((v) => !v)}
          >
            <Tv size={14} />
            Channel
          </button>
        )}

        {showChannels && streams.length > 0 && (
          <div className="pointer-events-none absolute right-3 top-1/2 z-5 flex max-h-[calc(100%-24px)] max-w-[50%] -translate-y-1/2 flex-col items-end gap-1.5 overflow-y-auto">
            <div>
              <span>Select Channel</span>
              <button type="button" className="bg-transparent px-1.5 py-[2px] text-[13px] text-muted hover:text-text [[data-theme=dark]_&]:text-text" onClick={() => setShowChannels(false)} aria-label="Close">✕</button>
            </div>
            <div>
              {streams.map((s, i) => {
                const active = playing?.key === i;
                return (
                  <button
                    type="button"
                    key={i}
                    className={active ? CHANNEL_ACTIVE : CHANNEL_IDLE}
                    onClick={() => handlePlay(s, i)}
                  >
                    <span className="h-0 w-0" aria-hidden="true" />
                    <span>{streamLabel(s, i)}</span>
                    {resolving === i ? (
                      <Loader2 className="animate-spin" />
                    ) : active ? (
                      <Dot />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {playErr && <div className={ERROR_BANNER}>{playErr}</div>}
    </div>
  );
}

