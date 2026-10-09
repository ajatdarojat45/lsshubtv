'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { MatchDetail, TeamLogo, StatusBadge } from '@/components/Match';
import { formatMatchDate } from '@/lib/matchProto';
import { useMatches, useMatchDetail, useStreamUrl } from '@/lib/queries';
import type { Stream } from '@/lib/types';

export default function MatchDetailPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const { cfg } = useRB();

  const matchesQuery = useMatches(cfg.sportType);
  const listMatch = matchesQuery.data?.list.find((m) => String(m.matchId) === String(matchId));
  const sportType = listMatch?.sportType ?? cfg.sportType;

  const detailQuery = useMatchDetail(matchId, sportType);
  const streamMutation = useStreamUrl();

  const detail = detailQuery.data;
  const busy = detailQuery.isLoading;
  const err = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : String(detailQuery.error)
    : '';
  const meta = listMatch ?? null;

  const refreshing = detailQuery.isFetching || matchesQuery.isFetching;
  // Refetch both: the detail payload and the match list (meta header/sportType).
  const handleRefresh = (): void => {
    void Promise.all([detailQuery.refetch(), matchesQuery.refetch()]);
  };

  const resolveStream = (s: Stream) =>
    streamMutation.mutateAsync({
      matchId,
      streamId: s.streamId ?? 0,
      sportType,
      siteType: s.siteType ?? cfg.siteType,
      continent: cfg.continent,
      country: cfg.country,
    });

  return (
    <>
      <div className="back-bar">
        <Link href="/" className="btn-back">← Back</Link>
        <div className="back-bar-actions">
          <span className="muted mono">Match #{matchId}</span>
          <button
            type="button"
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
          >
            {refreshing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {meta && !detail && (
        <section className="panel">
          <div className="detail-head">
            <TeamLogo path={meta.league?.logo} name={meta.league?.name} kind="league" />
            <div className="detail-head-text">
              <strong>{meta.league?.name || meta.title || meta.name || '-'}</strong>
              <div className="muted">{formatMatchDate(meta.matchDate)}</div>
            </div>
            <StatusBadge status={meta.status} />
          </div>
        </section>
      )}

      {busy && (
        <section className="panel empty-state">
          <span className="spinner"><Loader2 className="spin" size={16} /> Loading match details…</span>
        </section>
      )}

      {err && <div className="error-banner">{err}</div>}

      {!busy && !err && detail && (
        <section className="panel">
          <MatchDetail detail={detail} resolveStream={resolveStream} sportType={sportType} />
        </section>
      )}
    </>
  );
}

