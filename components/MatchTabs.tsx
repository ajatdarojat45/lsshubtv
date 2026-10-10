'use client';

import { useState } from 'react';
import type { MatchAnalysis, MatchLineup, MatchEvents, Team } from '@/lib/types';
import type { PlayerEventStats } from '@/lib/matchProto';
import { computePlayerEventStats } from '@/lib/matchProto';
import { H2H } from '@/components/H2H';
import { Lineup } from '@/components/Lineup';
import { Timeline } from '@/components/Timeline';

type TabId = 'h2h' | 'lineup' | 'timeline';

/** Split a match-events list into per-team player-stat maps (keyed by playerId).
 *  Attributes each event to home/away by teamSide, reusing the shared
 *  computePlayerEventStats rules so goal/assist/card/sub logic stays in one place. */
function teamStats(events: MatchEvents | undefined): {
  home: Map<number, PlayerEventStats>;
  away: Map<number, PlayerEventStats>;
} {
  const home = new Map<number, PlayerEventStats>();
  const away = new Map<number, PlayerEventStats>();
  if (!events) return { home, away };
  const blank = (): PlayerEventStats => ({
    goals: 0,
    assists: 0,
    yellow: 0,
    red: 0,
    subIn: false,
    subOut: false,
  });
  for (const e of events) {
    const map = e.teamSide === 2 ? away : home;
    const merged = computePlayerEventStats([e]);
    for (const [id, st] of merged) {
      const cur = map.get(id) ?? blank();
      cur.goals += st.goals;
      cur.assists += st.assists;
      cur.yellow += st.yellow;
      cur.red += st.red;
      cur.subIn = cur.subIn || st.subIn;
      cur.subOut = cur.subOut || st.subOut;
      map.set(id, cur);
    }
  }
  return { home, away };
}

/** Panelled tab strip wrapping Head-to-Head, Lineups and Timeline. Tabs with no
 *  data are hidden; if only one has data it renders directly with no strip. */
export function MatchTabs({
  analysis,
  lineup,
  events,
  homeTeam,
  awayTeam,
  sportType,
}: {
  analysis?: MatchAnalysis;
  lineup?: MatchLineup;
  events?: MatchEvents;
  homeTeam?: Team;
  awayTeam?: Team;
  sportType?: number;
}) {
  const [active, setActive] = useState<TabId>('h2h');

  const hasH2H = !!analysis && analysis.h2h.length > 0;
  const hasLineup = !!lineup && (lineup.home.length > 0 || lineup.away.length > 0);
  const hasTimeline = !!events && events.some((e) =>
    [101, 102, 103, 104, 105, 106, 107, 108, 109, 10020, 10021].includes(e.eventType)
  );

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'h2h', label: 'Head to Head', show: hasH2H },
    { id: 'lineup', label: 'Lineups', show: hasLineup },
    { id: 'timeline', label: 'Timeline', show: hasTimeline },
  ];
  const available = tabs.filter((t) => t.show);
  if (!available.length) return null;

  const stats = teamStats(events);
  const content = (id: TabId) => {
    switch (id) {
      case 'h2h':
        return <H2H analysis={analysis!} homeTeam={homeTeam} awayTeam={awayTeam} />;
      case 'lineup':
        return (
          <Lineup
            lineup={lineup!}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            sportType={sportType}
            homeStats={stats.home}
            awayStats={stats.away}
          />
        );
      case 'timeline':
        return <Timeline events={events!} sportType={sportType} />;
      default:
        return null;
    }
  };

  // Single tab — render it directly (no strip, and drop the component's own
  // outer panel margin since it sits where the strip would have).
  if (available.length === 1) return content(available[0].id);

  // Keep the active tab valid if data arrives/changes.
  const current = available.some((t) => t.id === active) ? active : available[0].id;

  return (
    <div className="mb-4">
      <div className="mb-0 flex flex-wrap gap-1 border-b border-border">
        {available.map((t) => {
          const on = t.id === current;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-[14px] font-semibold transition-colors duration-150 ${
                on
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{content(current)}</div>
    </div>
  );
}
