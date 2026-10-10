'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { Flame } from 'lucide-react';
import { statusLabel, isLiveStatus, isStarted, formatMatchDate } from '@/lib/matchProto';
import { countryLogoUrl, teamLogoUrl } from '@/lib/logos';
import { sportColor, sportIcon, sportLabel, sportIsScoring } from '@/lib/sports';
import type { Match, Team } from '@/lib/types';
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
