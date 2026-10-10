'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, Inbox, type LucideIcon } from 'lucide-react';
import { MatchRow, MatchRowSkeleton } from '@/components/Match';
import { isLiveStatus, matchDateMs } from '@/lib/matchProto';
import { useSportMatches } from '@/lib/queries';
import { sportLabel, sportIcon } from '@/lib/sports';
import AdBanner from '@/components/AdBanner';
import type { Match } from '@/lib/types';

interface MatchGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  isLive: boolean;
  items: Match[];
}

function MatchListContent() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  // The home page is the aggregate "Live" feed across every sport.
  const matchesQuery = useSportMatches(0);
  const matches = matchesQuery.data ?? null;
  const busy = matchesQuery.isLoading;
  const err =
    matchesQuery.isError && !matches
      ? matchesQuery.error instanceof Error
        ? matchesQuery.error.message
        : String(matchesQuery.error)
      : '';

  const list = matches?.list ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      [m.home?.name, m.away?.name, m.league?.name, m.name, m.title, m.group]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [list, query]);

  // Order: live → upcoming → finished.
  const sorted = useMemo(() => {
    const rank = (m: Match): number => {
      if (isLiveStatus(m.status)) return 0;
      if (!m.status) return 1;
      return 2;
    };
    const byTime = (a: Match, b: Match): number =>
      (matchDateMs(a.matchDate) ?? Infinity) - (matchDateMs(b.matchDate) ?? Infinity);
    return [...filtered].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return ra === 2 ? byTime(b, a) : byTime(a, b);
    });
  }, [filtered]);

  const liveCount = list.filter((m) => isLiveStatus(m.status)).length;

  // Group the live feed by sport type.
  const groups = useMemo<MatchGroup[]>(() => {
    const map = new Map<number, Match[]>();
    for (const m of sorted) {
      const st = m.sportType ?? 90;
      const arr = map.get(st) ?? [];
      arr.push(m);
      map.set(st, arr);
    }
    return [...map.entries()].map(([st, items]) => ({
      key: `sport-${st}`,
      label: sportLabel(st),
      icon: sportIcon(st),
      isLive: true,
      items,
    }));
  }, [sorted]);

  const emptyTitle = query ? 'No results' : 'No matches';
  const emptyDesc = list.length === 0
    ? 'The server may be rejecting the request — try another source or reload.'
    : query
      ? 'Try a different keyword.'
      : 'There are no matches in this category right now.';

  return (
    <>
      {/* Top banner — before the content. */}
      <AdBanner slotId="home-top" category="live" size="leaderboard" />

      <div className="back-bar">
        <span className="muted mono">Live</span>
        <div className="back-bar-actions">
          <button
            type="button"
            className="refresh-btn"
            onClick={() => void matchesQuery.refetch()}
            disabled={matchesQuery.isFetching}
            title="Refresh"
          >
            {matchesQuery.isFetching ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      <section className="search-bar">
        <input
          className="search-input"
          type="search"
          placeholder="Search teams, leagues, or matches…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches && (
          <span className="stats">
            <span className="stat"><strong>{list.length}</strong> matches</span>
            <span className="stat live"><span className="dot" />{liveCount} live</span>
          </span>
        )}
      </section>

      {err && <div className="error-banner">{err}</div>}

      {busy && !matches && (
        <div className="match-list">
          {Array.from({ length: 6 }).map((_, i) => <MatchRowSkeleton key={i} />)}
        </div>
      )}

      {!busy && matches && sorted.length === 0 && (
        <section className="panel empty-state">
          <Inbox className="empty-icon" />
          <h2>{emptyTitle}</h2>
          <p className="muted">{emptyDesc}</p>
        </section>
      )}

      {groups.map((g, idx) => (
        <Fragment key={g.key}>
          <section className="match-group">
            <header className="group-head">
              <span className={`group-title ${g.isLive ? 'is-live' : ''}`}>
                <g.icon className="group-icon" />
                {g.label}
                <span className="group-count">{g.items.length}</span>
              </span>
            </header>
            <div className="match-list">
              {g.items.map((m, i) => (
                <MatchRow
                  key={`${m.matchId}-${i}`}
                  match={m}
                  onClick={() => router.push(`/watch/${m.matchId}?sport=${m.sportType ?? 0}`)}
                />
              ))}
            </div>
          </section>

          {/* In-feed banner — between the first group and the rest. */}
          {idx === 0 && groups.length > 1 && (
            <AdBanner slotId="home-infeed" category="live" size="rectangle" />
          )}
        </Fragment>
      ))}

    </>
  );
}

export default function HomePage() {
  return <MatchListContent />;
}
