'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, Share2, ThumbsUp, X } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { MatchRow, StatusBadge } from '@/components/Match';
import { isLiveStatus, matchDateMs } from '@/lib/matchProto';
import { useSportMatches, useMatchDetail, useStreamUrl } from '@/lib/queries';
import { sportSlug, sportLabel } from '@/lib/sports';
import VideoPlayer from '@/components/VideoPlayer';
import AdBanner from '@/components/AdBanner';
import type { Match } from '@/lib/types';

interface ResolvedStream {
  url: string;
  referer: string;
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
  const resolvedRef = useRef(false);

  const sportParam = Number(searchParams.get('sport'));
  const preferredSport =
    Number.isFinite(sportParam) && sportParam > 0 ? sportParam : Number(cfg.sportType);

  const matchesQuery = useSportMatches(preferredSport);
  const listMatch = matchesQuery.data?.list.find((m: Match) => String(m.matchId) === String(matchId));
  const sportType = listMatch?.sportType ?? preferredSport;

  const detailQuery = useMatchDetail(matchId, sportType);
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

  // Auto-resolve the first playable stream.
  useEffect(() => {
    if (resolvedRef.current || !streams.length) return;
    const s = streams.find((st) => st.url) ?? streams[0];
    if (!s) return;
    resolvedRef.current = true;
    streamMutation
      .mutateAsync({
        matchId,
        streamId: s.streamId ?? 0,
        sportType,
        siteType: s.siteType ?? cfg.siteType,
        continent: cfg.continent,
        country: cfg.country,
      })
      .then((res) => {
        setPlaying({ url: res.url, referer: res.referer });
        // Pause immediately on load so the pause-ad overlay shows first.
        setPaused(true);
      })
      .catch(() => setResolveErr('Could not resolve stream URL.'));
  }, [streams, streamMutation, matchId, sportType, cfg.siteType, cfg.continent, cfg.country]);

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
    resolvedRef.current = false;
    setPlaying(null);
    setResolveErr('');
    void Promise.all([detailQuery.refetch(), matchesQuery.refetch()]);
  };

  return (
    <>
      {/* Top banner — below the navbar */}
      <AdBanner slotId="watch-top" category={slug} size="leaderboard" />

      <div className="back-bar">
        <Link href={backHref} className="btn-back">← Back</Link>
        <div className="back-bar-actions">
          <span className="muted mono">Watch #{matchId}</span>
          <button
            type="button"
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={detailQuery.isFetching}
            title="Refresh"
          >
            {detailQuery.isFetching ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {busy && (
        <section className="panel empty-state">
          <span className="spinner"><Loader2 className="spin" size={16} /> Loading match details…</span>
        </section>
      )}

      {err && <div className="error-banner">{err}</div>}

      {!busy && !err && match && (
        <>
          {/* 1. Main video player + pause ad overlay */}
          <section className="panel">
            <div className="watch-player">
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
              ) : (
                <div className="video-player" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="spinner"><Loader2 className="spin" size={20} /> Preparing stream…</span>
                </div>
              )}

              {paused && (
                <div className="pause-ad-overlay">
                  <AdBanner slotId="watch-pause-ad" category={slug} size="leaderboard" />
                  <button
                    type="button"
                    className="pause-ad-close"
                    onClick={() => setPaused(false)}
                    aria-label="Close ad"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {resolveErr && <div className="error-banner">{resolveErr}</div>}

            {/* 2. Video info area */}
            <div className="watch-meta">
              <h1 className="watch-title">{title}</h1>

              <div className="watch-tags">
                {categoryLabel && <span className="watch-cat">{categoryLabel}</span>}
                {match.status !== undefined && (
                  <span className="watch-stats muted">
                    <StatusBadge status={match.status} />
                  </span>
                )}
              </div>

              <p className="watch-desc">{description}</p>

              <div className="watch-actions">
                <button type="button" className="watch-action-btn" onClick={handleShare}>
                  <Share2 size={16} />
                  Share
                </button>
                <button
                  type="button"
                  className={`watch-action-btn ${liked ? 'active' : ''}`}
                  onClick={() => setLiked((v) => !v)}
                >
                  <ThumbsUp size={16} />
                  {liked ? 'Liked' : 'Like'}
                </button>
              </div>
            </div>
          </section>

          {/* Big ad — above the related matches */}
          <AdBanner slotId="watch-above-related" category={slug} size="rectangle" />

          {/* Related matches (live/upcoming) */}
          {relatedMatches.length > 0 && (
            <section className="panel">
              <h3 className="related-heading">Related matches</h3>
              <div className="match-list">
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