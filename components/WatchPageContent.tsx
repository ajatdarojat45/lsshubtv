'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleCheck, Loader2, RefreshCw, Share2, ThumbsUp, X } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { Countdown, MatchRow, StatusBadge } from '@/components/Match';
import { isLiveStatus, isStarted, matchDateMs, isPlayable, statusLabel } from '@/lib/matchProto';
import { useSportMatches, useMatchDetail, useMatchAnalysis, useMatchLineup, useMatchEvent, useStreamUrl } from '@/lib/queries';
import { sportSlug, sportLabel } from '@/lib/sports';
import VideoPlayer from '@/components/VideoPlayer';
import AdBanner from '@/components/AdBanner';
import { MatchTabs } from '@/components/MatchTabs';
import type { Match, Stream } from '@/lib/types';

/** Surface panel (`.panel`): bordered card on the app background. */
const PANEL = 'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Panel + centered empty/loading state (`.panel.empty-state`). */
const PANEL_EMPTY =
  'mb-4 rounded border border-border bg-panel px-5 py-10 text-center max-[640px]:px-4 max-[640px]:py-8';
/** Inline error banner (`.error-banner`). */
const ERROR_BANNER =
  'mb-4 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]';
/** Channel pill in the player overlay (`.channel-item`). */
const CHANNEL_BASE =
  'pointer-events-auto inline-flex max-w-full items-center overflow-hidden whitespace-nowrap text-ellipsis rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur-[4px] transition-colors duration-150';
const CHANNEL_IDLE = `${CHANNEL_BASE} bg-[rgba(0,0,0,0.55)] hover:bg-[rgba(0,0,0,0.75)]`;
const CHANNEL_ACTIVE = `${CHANNEL_BASE} bg-[rgba(34,211,238,0.55)]`;
/** Action pill under the video (`.watch-action-btn`). */
const ACTION_BASE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all duration-150';
const ACTION_IDLE = `${ACTION_BASE} border-border bg-panel text-text hover:border-[#c7ccd2]`;
const ACTION_ACTIVE = `${ACTION_BASE} border-accent bg-accent-soft text-accent`;

interface ResolvedStream {
  key: number;
  url: string;
  referer: string;
  label: string;
}

export function WatchPageContent({ id }: { id: string }) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { cfg } = useRB();
  const matchId = id || params.id;

  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState<ResolvedStream | null>(null);
  const [resolveErr, setResolveErr] = useState('');
  const autoPlayedRef = useRef(false);

  const sportParam = Number(searchParams.get('sport'));
  const preferredSport =
    Number.isFinite(sportParam) && sportParam > 0 ? sportParam : Number(cfg.sportType);

  const matchesQuery = useSportMatches(preferredSport);
  const listMatch = matchesQuery.data?.list.find((m: Match) => String(m.matchId) === String(matchId));
  const sportType = listMatch?.sportType ?? preferredSport;

  const detailQuery = useMatchDetail(matchId, sportType);
  const analysisQuery = useMatchAnalysis(matchId, sportType);
  const lineupQuery = useMatchLineup(matchId, sportType);
  const eventQuery = useMatchEvent(matchId, sportType);
  const streamMutation = useStreamUrl();

  const detail = detailQuery.data;
  const busy = detailQuery.isLoading;
  const err = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : String(detailQuery.error)
    : '';

  const match = detail?.match ?? listMatch ?? null;
  const streams = detail?.streams ?? detail?.channels ?? [];

  const matchStatus = match?.status;
  /** Live right now — the only state that auto-plays a channel. */
  const live = isLiveStatus(matchStatus);
  /** Finished / cancelled / cut — the stream is over. */
  const finished = (matchStatus ?? 0) >= 10000;
  /** Upcoming with a known kickoff time → the player frame shows a countdown. */
  const countdownMs = isStarted(matchStatus) ? null : matchDateMs(match?.matchDate);
  const endLabel = finished ? statusLabel(matchStatus).toLowerCase() : '';
  const finalScore =
    finished && match?.homeScore !== undefined && match?.awayScore !== undefined
      ? `${match.homeScore} : ${match.awayScore}`
      : '';

  const streamLabel = (s: Stream, i: number): string =>
    s.fullName || s.name || `Channel #${s.streamId ?? s.channelId ?? i + 1}`;

  const playChannel = async (s: Stream, i: number): Promise<void> => {
    setResolveErr('');
    try {
      const res = await streamMutation.mutateAsync({
        matchId,
        streamId: s.streamId ?? 0,
        sportType,
        siteType: s.siteType ?? cfg.siteType,
        continent: cfg.continent,
        country: cfg.country,
      });
      setPlaying({ key: i, url: res.url, referer: res.referer, label: streamLabel(s, i) });
      // Pause on (auto)select so the pause-ad overlay shows first.
      setPaused(true);
    } catch (e) {
      setResolveErr(e instanceof Error ? e.message : 'Could not resolve stream URL.');
    }
  };

  // Auto-pick the first playable channel once streams are ready — only while
  // the match is actually live (upcoming shows a countdown, finished shows an
  // "ended" notice instead of a player).
  useEffect(() => {
    if (autoPlayedRef.current || !streams.length) return;
    if (!live) return;
    autoPlayedRef.current = true;
    const idx = streams.findIndex((s) => isPlayable(s));
    const pick = idx >= 0 ? idx : 0;
    void playChannel(streams[pick], pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streams, live]);

  // Related matches — live first (priority), then upcoming (soonest first).
  const relatedMatches = (matchesQuery.data?.list ?? [])
    .filter((m) => String(m.matchId) !== String(matchId) && (isLiveStatus(m.status) || !m.status))
    .sort((a, b) => {
      const rank = (m: Match): number => (isLiveStatus(m.status) ? 0 : 1);
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      const byTime = (x: Match, y: Match): number =>
        (matchDateMs(x.matchDate) ?? Infinity) - (matchDateMs(y.matchDate) ?? Infinity);
      return byTime(a, b);
    })
    .slice(0, 6);

  const slug = sportType > 0 ? sportSlug(sportType) : '';
  const backHref = slug ? `/sports/${slug}` : '/';
  const categoryLabel = sportLabel(sportType);

  const title = match?.league?.name || match?.title || match?.name || 'Live Stream';
  const homeName = match?.home?.name || match?.homeTeams?.[0]?.name;
  const awayName = match?.away?.name || match?.awayTeams?.[0]?.name;
  const description = homeName && awayName
    ? `${homeName} vs ${awayName}`
    : match?.league?.name || match?.stage || 'Live stream';

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled or unsupported */
    }
  }, [title]);

  const handleRefresh = (): void => {
    autoPlayedRef.current = false;
    setPlaying(null);
    setResolveErr('');
    void Promise.all([detailQuery.refetch(), matchesQuery.refetch()]);
  };

  return (
    <>
      {/* Top banner — below the navbar */}
      <AdBanner slotId="watch-top" category={slug} size="leaderboard" />

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 max-[640px]:gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent no-underline hover:underline"
        >
          ← Back
        </Link>
        <div className="inline-flex items-center gap-3">
          <span className="font-mono text-[12px] text-muted">Watch #{matchId}</span>
          <button
            type="button"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-sm border border-border bg-panel text-[16px] text-muted transition-all duration-150 hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleRefresh}
            disabled={detailQuery.isFetching}
            title="Refresh"
          >
            {detailQuery.isFetching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {busy && (
        <section className={PANEL_EMPTY}>
          <span className="text-[14px] text-muted">
            <Loader2 className="animate-spin" size={16} /> Loading match details…
          </span>
        </section>
      )}

      {err && <div className={ERROR_BANNER}>{err}</div>}

      {!busy && !err && match && (
        <>
          {/* 1. Main video player + pause ad overlay */}
          <section className={PANEL}>
            <div className="relative">
              {playing ? (
                <VideoPlayer
                  streamUrl={playing.url}
                  referer={playing.referer}
                  title={title}
                  autoPlay={false}
                  muted={false}
                  onPause={() => setPaused(true)}
                  onPlay={() => setPaused(false)}
                />
              ) : countdownMs !== null ? (
                /* Upcoming match — live countdown inside the player frame. */
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black">
                  <div className="p-4 text-center">
                    <p className="mb-1 mt-0 text-xs font-bold uppercase tracking-[0.08em] text-[#9ca3af]">Kick-off in</p>
                    <Countdown targetMs={countdownMs} />
                  </div>
                </div>
              ) : finished ? (
                /* Finished / cancelled / cut — the stream is over. */
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black">
                  <div className="p-4 text-center">
                    <CircleCheck className="mx-auto h-10 w-10 text-[#9ca3af]" />
                    <p className="mt-2.5 text-[14px] font-semibold text-[#e5e7eb]">This match is {endLabel}.</p>
                    {finalScore && (
                      <p className="mt-1 text-[12px] text-[#9ca3af]">Final score {finalScore}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black">
                  <span className="text-[14px] text-muted">
                    <Loader2 className="animate-spin" size={20} /> Preparing stream…
                  </span>
                </div>
              )}

              {live && streams.length > 0 && (
                <div className="pointer-events-none absolute right-3 top-1/2 z-[5] flex max-h-[calc(100%-24px)] max-w-[50%] -translate-y-1/2 flex-col items-end gap-1.5 overflow-y-auto">
                  {streams.map((s, i) => {
                    const active = playing?.key === i;
                    return (
                      <button
                        type="button"
                        key={i}
                        className={active ? CHANNEL_ACTIVE : CHANNEL_IDLE}
                        onClick={() => void playChannel(s, i)}
                      >
                        {streamLabel(s, i)}
                      </button>
                    );
                  })}
                </div>
              )}

              {paused && (
                <div className="absolute inset-0 z-5 flex flex-col items-center justify-center gap-3 bg-[rgba(0,0,0,0.55)] p-4">
                  <AdBanner slotId="watch-pause-ad" category={slug} size="leaderboard" className="!mb-0 max-w-[480px]" />
                  <button
                    type="button"
                    className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(0,0,0,0.6)] text-white hover:bg-[rgba(0,0,0,0.8)]"
                    onClick={() => setPaused(false)}
                    aria-label="Close ad"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {resolveErr && <div className={ERROR_BANNER}>{resolveErr}</div>}

            {/* 2. Video info area */}
            <div className="mt-3.5 flex flex-col gap-2">
              <h1 className="m-0 text-[18px] font-bold leading-[1.3]">{title}</h1>

              <div className="flex flex-wrap items-center gap-2">
                {categoryLabel && (
                  <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-[3px] text-[12px] font-semibold text-accent">
                    {categoryLabel}
                  </span>
                )}
                {match.status !== undefined && (
                  <span className="flex items-center gap-2 text-[13px] text-muted">
                    <StatusBadge status={match.status} />
                  </span>
                )}
              </div>

              <p className="m-0 text-sm leading-[1.6] text-muted">{description}</p>

              <div className="mt-1 flex gap-2">
                <button type="button" className={ACTION_IDLE} onClick={handleShare}>
                  <Share2 size={16} />
                  Share
                </button>
                <button
                  type="button"
                  className={liked ? ACTION_ACTIVE : ACTION_IDLE}
                  onClick={() => setLiked((v) => !v)}
                >
                  <ThumbsUp size={16} />
                  {liked ? 'Liked' : 'Like'}
                </button>
              </div>
            </div>
          </section>

          {/* Head-to-head / Lineups / Timeline (tabs; auto-shown only where data exists) */}
          <MatchTabs
            analysis={analysisQuery.data}
            lineup={lineupQuery.data}
            events={eventQuery.data}
            homeTeam={match?.home}
            awayTeam={match?.away}
            sportType={sportType}
          />

          {/* Big ad — above the related matches */}
          <AdBanner slotId="watch-above-related" category={slug} size="rectangle" />

          {/* Related matches (live/upcoming) */}
          {relatedMatches.length > 0 && (
            <section className={PANEL}>
              <h3 className="mb-3 text-[15px] font-bold">Related matches</h3>
              <div className="flex flex-col gap-2">
                {relatedMatches.map((m, i) => (
                  <MatchRow
                    key={`${m.matchId}-${i}`}
                    match={m}
                    onClick={() => router.push(`/watch/${m.matchId}?sport=${m.sportType ?? sportType}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}