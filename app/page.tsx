'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Radio, MoreHorizontal, RefreshCw, Loader2, Inbox, Clock, CircleCheck, type LucideIcon } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { MatchRow, MatchRowSkeleton } from '@/components/Match';
import { isLiveStatus, matchDateMs } from '@/lib/matchProto';
import { useSportMatches } from '@/lib/queries';
import { POPULAR_SPORTS, MORE_SPORTS, SPORTS, sportLabel, sportIcon } from '@/lib/sports';
import type { Match, Sport } from '@/lib/types';

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

function MatchListContent() {
  const { cfg, setCfg } = useRB();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterKey>('all');
  const [showMore, setShowMore] = useState(false);
  // Non-popular active category, pinned into the top tab list. Derived from cfg so
  // it also applies when the sport is selected via the footer category links.
  const extraSport = useMemo<Sport | null>(() => {
    const n = Number(cfg.sportType);
    if (n === 0 || POPULAR_SPORTS.some((s) => s.value === n)) return null;
    return SPORTS.find((s) => s.value === n) ?? null;
  }, [cfg.sportType]);

  // Footer category links (/?sport=N) preselect the sport.
  const sportParam = searchParams.get('sport');
  useEffect(() => {
    if (sportParam === null) return;
    const s = Number(sportParam);
    if (!Number.isFinite(s) || s < 0) return;
    setCfg((c) => (c.sportType === s ? c : { ...c, sportType: s }));
  }, [sportParam, setCfg]);

  const isLiveSport = Number(cfg.sportType) === 0;

  // ONE query whose key reflects the active category. gating with `enabled`
  // (the old two-query approach) makes React Query v5 defer the new queryFn
  // on key change until a manual refetch — which is why clicking a category
  // showed nothing until Refresh. A single always-enabled query refetches on
  // key change immediately; keepPreviousData avoids the blank flash between.
  const matchesQuery = useSportMatches(Number(cfg.sportType));

  // Keep the last non-empty list so a rate-limited (429) category switch never
  // blanks the UI. On error, React Query drops the keepPreviousData placeholder,
  // which would otherwise render an empty list until a manual Refresh. Falling
  // back to the last good list keeps the view stable while the retry above
  // self-heals; the new category's data appears the moment it succeeds.
  const lastGood = useRef<Match[]>([]);
  const fetchedList = matchesQuery.data?.list;
  if (fetchedList?.length) lastGood.current = fetchedList;
  const matches =
    matchesQuery.data ??
    (lastGood.current.length ? { list: lastGood.current, source: 'data' as const } : null);
  const busy = matchesQuery.isLoading;
  const err = matchesQuery.isError && !matches
    ? matchesQuery.error instanceof Error
      ? matchesQuery.error.message
      : String(matchesQuery.error)
    : '';

  const rawList = matches?.list ?? [];
  // The live query already returns only live matches; the regular query returns all statuses.
  const list = rawList;

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

  const groups = useMemo<MatchGroup[]>(() => {
    if (isLiveSport) {
      // Live category → group by sport type.
      const map = new Map<number, Match[]>();
      for (const m of visible) {
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
    }
    return MATCH_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      icon: g.icon,
      isLive: g.key === 'live',
      items: visible.filter((m) => categoryOf(m) === g.key),
    })).filter((g) => g.items.length);
  }, [visible, isLiveSport]);

  const pickSport = (sportType: number): void => {
    setShowMore(false);
    const n = Number(sportType);
    // Keep the URL in sync so footer category links and the tab list stay aligned.
    window.history.replaceState(null, '', `/?sport=${n}`);
    if (n === Number(cfg.sportType)) return;
    setCfg((c) => ({ ...c, sportType: n }));
  };

  const tabLabel = FILTER_TABS.find((t) => t.key === tab)?.label ?? 'All';
  const emptyTitle = list.length === 0
    ? 'No matches'
    : query
      ? 'No results'
      : `No ${tabLabel.toLowerCase()} matches`;
  const emptyDesc = list.length === 0
    ? 'The server may be rejecting the request — try another source or reload.'
    : query
      ? 'Try a different keyword.'
      : 'There are no matches in this category right now.';

  return (
    <>
      <section className="toolbar">
        <div className="sport-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={Number(cfg.sportType) === 0}
            className={`sport-tab live ${Number(cfg.sportType) === 0 ? 'active' : ''}`}
            onClick={() => pickSport(0)}
          >
            <Radio className="sport-icon" />
            Live
          </button>
          {POPULAR_SPORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={Number(cfg.sportType) === s.value}
              className={`sport-tab ${Number(cfg.sportType) === s.value ? 'active' : ''}`}
              onClick={() => pickSport(s.value)}
            >
              <s.icon className="sport-icon" />
              {s.label}
            </button>
          ))}
          {extraSport && (
            <button
              type="button"
              role="tab"
              aria-selected={Number(cfg.sportType) === extraSport.value}
              className={`sport-tab ${Number(cfg.sportType) === extraSport.value ? 'active' : ''}`}
              onClick={() => pickSport(extraSport.value)}
            >
              <extraSport.icon className="sport-icon" />
              {extraSport.label}
            </button>
          )}
          <button
            type="button"
            className="sport-tab"
            onClick={() => setShowMore((v) => !v)}
            aria-haspopup="dialog"
            title="More sports"
          >
            <MoreHorizontal className="sport-icon" />
            More
          </button>
        </div>

        <div className="toolbar-actions">
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
      </section>

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

      {groups.map((g) => (
        <section key={g.key} className="match-group">
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
                onClick={() => router.push(`/matches/${m.matchId}`)}
              />
            ))}
          </div>
        </section>
      ))}

      {showMore && (
        <div className="modal-overlay" onClick={() => setShowMore(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>All Sports</h2>
              <button type="button" className="btn-icon" onClick={() => setShowMore(false)} aria-label="Close">✕</button>
            </div>
            <div className="sport-grid">
              {MORE_SPORTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`sport-tile ${Number(cfg.sportType) === s.value ? 'active' : ''}`}
                  onClick={() => pickSport(s.value)}
                >
                  <s.icon className="sport-tile-icon" />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function MatchListPage() {
  return (
    <Suspense fallback={null}>
      <MatchListContent />
    </Suspense>
  );
}
