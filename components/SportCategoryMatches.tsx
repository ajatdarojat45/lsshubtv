'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, Clock, CircleCheck, Loader2, RefreshCw, Inbox, type LucideIcon } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { MatchRow, MatchRowSkeleton } from '@/components/Match';
import { isLiveStatus, matchDateMs } from '@/lib/matchProto';
import { useSportMatches } from '@/lib/queries';
import AdBanner from '@/components/AdBanner';
import type { Match } from '@/lib/types';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'finished', label: 'Finished' },
] as const;

const MATCH_GROUPS = [
  { key: 'live', label: 'Live', icon: Radio },
  { key: 'upcoming', label: 'Upcoming', icon: Clock },
  { key: 'finished', label: 'Finished', icon: CircleCheck },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]['key'];
type Category = 'live' | 'upcoming' | 'finished';

interface MatchGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  isLive: boolean;
  items: Match[];
}

const categoryOf = (m: Match): Category => {
  if (isLiveStatus(m.status)) return 'live';
  if (!m.status) return 'upcoming';
  return 'finished';
};

interface SportCategoryMatchesProps {
  sportType: number;
  category: string;
  label: string;
}

/** Match list for /sports/[category] — the same layout as the home page
 *  (search bar + filter tabs + grouped Live/Upcoming/Finished MatchRow list),
 *  scoped to one sport, plus top & in-feed AdBanner slots. */
export function SportCategoryMatches({ sportType, category, label }: SportCategoryMatchesProps) {
  const router = useRouter();
  const { setCfg } = useRB();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterKey>('all');

  // Keep the shared config aligned so the watch page resolves this sport.
  useEffect(() => {
    setCfg((c) => (c.sportType === sportType ? c : { ...c, sportType }));
  }, [sportType, setCfg]);

  const matchesQuery = useSportMatches(sportType);
  const matches = matchesQuery.data;
  const busy = matchesQuery.isLoading;
  const err = matchesQuery.isError
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

  // Order: live → upcoming → finished (identical to the home page).
  const sorted = useMemo(() => {
    const rank = (m: Match): number => (isLiveStatus(m.status) ? 0 : !m.status ? 1 : 2);
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
  const upcomingCount = list.filter((m) => !isLiveStatus(m.status) && !m.status).length;
  const finishedCount = list.length - liveCount - upcomingCount;

  const counts: Record<FilterKey, number> = {
    all: list.length,
    live: liveCount,
    upcoming: upcomingCount,
    finished: finishedCount,
  };

  const visible = useMemo(() => {
    if (tab === 'all') return sorted;
    return sorted.filter((m) => categoryOf(m) === tab);
  }, [sorted, tab]);

  const groups = useMemo<MatchGroup[]>(
    () =>
      MATCH_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        icon: g.icon,
        isLive: g.key === 'live',
        items: visible.filter((m) => categoryOf(m) === g.key),
      })).filter((g) => g.items.length),
    [visible]
  );

  const tabLabel = FILTER_TABS.find((t) => t.key === tab)?.label ?? 'All';
  const emptyTitle =
    list.length === 0 ? 'No matches' : query ? 'No results' : `No ${tabLabel.toLowerCase()} matches`;
  const emptyDesc =
    list.length === 0
      ? 'The server may be rejecting the request — try another source or reload.'
      : query
        ? 'Try a different keyword.'
        : 'There are no matches in this category right now.';

  return (
    <>
      {/* Top banner — before the title/content. */}
      <AdBanner slotId="sports-category-top" category={category} size="leaderboard" />

      <div className="back-bar">
        <Link href="/" className="btn-back">← All sports</Link>
        <div className="back-bar-actions">
          <span className="muted mono">{label}</span>
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

      <section className="filter-tabs" role="tablist">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`filter-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="filter-count">{counts[t.key]}</span>
          </button>
        ))}
      </section>

      {err && <div className="error-banner">{err}</div>}

      {busy && !matches && (
        <div className="match-list">
          {Array.from({ length: 6 }).map((_, i) => <MatchRowSkeleton key={i} />)}
        </div>
      )}

      {!busy && matches && visible.length === 0 && (
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
                  onClick={() => router.push(`/watch/${m.matchId}?sport=${m.sportType ?? sportType}`)}
                />
              ))}
            </div>
          </section>

          {/* In-feed banner — between the first group and the rest of the list. */}
          {idx === 0 && groups.length > 1 && (
            <AdBanner slotId="sports-category-infeed" category={category} size="rectangle" />
          )}
        </Fragment>
      ))}
    </>
  );
}

