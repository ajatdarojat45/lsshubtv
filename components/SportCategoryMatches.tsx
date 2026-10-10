'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, Clock, CircleCheck, Loader2, RefreshCw, Inbox, ChevronDown, type LucideIcon } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { MatchRowSkeleton } from '@/components/Match';
import { groupMatchesByLeague, LeagueGroupSection } from '@/components/LeagueGroup';
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

/* Filter-tab pills (`.filter-tab` / `.filter-count`). Active state is a
 * separate string so its color utilities don't fight the idle ones. */
const FILTER_TAB =
  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const FILTER_TAB_IDLE = `${FILTER_TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const FILTER_TAB_ACTIVE = `${FILTER_TAB} border-accent bg-accent-soft text-accent`;

const FILTER_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const FILTER_COUNT_IDLE = `${FILTER_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const FILTER_COUNT_ACTIVE = `${FILTER_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;

/* Group heading (`.group-title` / `.group-title.is-live`). */
const GROUP_TITLE = 'inline-flex items-center gap-2 text-sm font-bold text-text';
const GROUP_TITLE_LIVE =
  'inline-flex items-center gap-2 text-sm font-bold text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]';

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

/** Render one Live/Upcoming/Finished status group. Every group is split into
 *  per-league sub-sections so the league name shows once per header,
 *  not per card. The status header is a toggle — collapsed groups show only
 *  the header row. Live stays open by default; upcoming/finished start
 *  collapsed when the list is long so the page scans faster. */
function StatusGroupSection({
  group,
  onMatchClick,
  defaultOpen,
}: {
  group: MatchGroup;
  onMatchClick: (m: Match) => void;
  defaultOpen?: boolean;
}) {
  const leagueGroups = useMemo(
    () => groupMatchesByLeague(group.items),
    [group.items]
  );
  const [open, setOpen] = useState(defaultOpen ?? group.isLive);
  return (
    <section className="mb-[22px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mb-2.5 flex w-full cursor-pointer items-center justify-between rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-border-soft/60"
      >
        <span className={group.isLive ? GROUP_TITLE_LIVE : GROUP_TITLE}>
          <group.icon className="h-[15px] w-[15px]" />
          {group.label}
          <span className="rounded-full border border-border bg-panel px-2 py-px text-[11px] font-bold text-muted">{group.items.length}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-4">
          {leagueGroups.map((lg) => (
            <LeagueGroupSection key={lg.key} group={lg} onMatchClick={onMatchClick} defaultOpen={group.isLive} />
          ))}
        </div>
      )}
    </section>
  );
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

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent no-underline hover:underline">← All sports</Link>
        <div className="inline-flex items-center gap-3">
          <span className="font-mono text-xs text-muted">{label}</span>
          <button
            type="button"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-sm)] border border-border bg-panel text-base text-muted transition-all hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void matchesQuery.refetch()}
            disabled={matchesQuery.isFetching}
            title="Refresh"
          >
            {matchesQuery.isFetching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      <section className="mb-[18px] flex items-center gap-3">
        <input
          className="flex-1 rounded-xl border border-border bg-panel px-4 py-[11px] text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
          type="search"
          placeholder="Search teams, leagues, or matches…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches && (
          <span className="flex gap-2.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-3.5 py-1.5 text-[13px] text-muted [&_strong]:text-text"><strong>{list.length}</strong> matches</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.4)] bg-live-soft px-3.5 py-1.5 text-[13px] text-[#d93025]"><span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />{liveCount} live</span>
          </span>
        )}
      </section>

      <section className="mb-4 flex flex-wrap gap-2" role="tablist">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? FILTER_TAB_ACTIVE : FILTER_TAB_IDLE}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className={tab === t.key ? FILTER_COUNT_ACTIVE : FILTER_COUNT_IDLE}>{counts[t.key]}</span>
          </button>
        ))}
      </section>

      {err && (
        <div className="mb-4 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]">
          {err}
        </div>
      )}

      {busy && !matches && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => <MatchRowSkeleton key={i} />)}
        </div>
      )}

      {!busy && matches && visible.length === 0 && (
        <section className="mb-4 rounded border border-border bg-panel px-5 py-10 text-center max-[640px]:px-4 max-[640px]:py-8">
          <Inbox className="h-9 w-9" />
          <h2 className="mt-2 mb-1.5 text-[19px]">{emptyTitle}</h2>
          <p className="mb-3.5 text-sm leading-[1.65] text-muted">{emptyDesc}</p>
        </section>
      )}

      {groups.map((g, idx) => (
        <Fragment key={g.key}>
          <StatusGroupSection
            group={g}
            onMatchClick={(m) => router.push(`/watch/${m.matchId}?sport=${m.sportType ?? sportType}`)}
          />

          {/* In-feed banner — between the first group and the rest of the list. */}
          {idx === 0 && groups.length > 1 && (
            <AdBanner slotId="sports-category-infeed" category={category} size="rectangle" />
          )}
        </Fragment>
      ))}
    </>
  );
}

