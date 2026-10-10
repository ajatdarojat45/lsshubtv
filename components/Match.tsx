'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { Flame, Tv, Loader2, Dot } from 'lucide-react';
import { statusLabel, isLiveStatus, isStarted, formatMatchDate, matchDateMs, isPlayable } from '@/lib/matchProto';
import { countryLogoUrl, teamLogoUrl } from '@/lib/logos';
import { sportColor, sportIcon, sportLabel, sportIsScoring } from '@/lib/sports';
import type { Match, MatchDetail, Stream, Team } from '@/lib/types';
import StreamPlayer from './StreamPlayer';

export function TeamLogo({ path, name, sportType, kind = 'team' }: { path?: string; name?: string; sportType?: number; kind?: 'team' | 'league' }) {
  const [broken, setBroken] = useState(false);
  // Server actions already expand raw filenames, but cached payloads may
  // still carry a bare filename — resolve client-side as a safety net.
  const src = kind === 'league' ? countryLogoUrl(path) : teamLogoUrl(sportType, path);
  useEffect(() => { setBroken(false); }, [src]);
  if (!src || broken) {
    const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return <span className="logo logo-empty" aria-hidden="true">{initial}</span>;
  }
  // Logo hostnames change/expire often and may not resolve from the server
  // network — load straight from upstream in the browser. onError falls back
  // to the initial-letter placeholder, never a broken image.
  return <img className="logo" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

/** One side of a versus matchup. Singles render one logo+name; doubles
 * (tennis/badminton ganda) stack every player/team with their logo, matching
 * the app's "name[0] / name[2]" vs "name[1] / name[3]" pairing. */
function TeamSide({ teams, sportType }: { teams?: Team[]; sportType?: number }) {
  const list = teams?.length ? teams : [];
  if (!list.length) return <span className="row-team-name">{'?'}</span>;
  return (
    <span className="row-team-side">
      {list.map((t, i) => (
        <span className="row-team-member" key={t.teamId ?? t.playerId ?? i}>
          <TeamLogo path={t.logo} name={t.name} sportType={sportType} />
          <span className="row-team-name">{t.name || '?'}</span>
        </span>
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status?: number }) {
  const live = isLiveStatus(status);
  return (
    <span className={live ? 'status status-live' : 'status'}>
      {live && <span className="dot" />}
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
    return <div className="detail-countdown is-done" role="timer">Starting…</div>;
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

  return <div className="detail-countdown" role="timer">{clock}</div>;
}

export function MatchRowSkeleton() {
  return (
    <div className="match-row skeleton-row">
      <div className="sk sk-line w30" />
      <div className="row-main">
        <div className="sk sk-line w50" />
        <div className="sk-row">
          <div className="sk sk-circle" />
          <div className="sk sk-line w70" />
          <div className="sk sk-score" />
        </div>
      </div>
      <div className="sk sk-line w40" />
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
      className={`match-row ${live ? 'is-live' : ''}`}
      style={{ '--sport-color': color } as CSSProperties}
      onClick={onClick}
    >
      <span className="row-date">
        <span className="row-sport" title={sportName}>
          <SportIcon className="row-sport-icon" />
          <span className="row-sport-name">{sportName}</span>
        </span>
        <span className="row-date-text">{formatMatchDate(match.matchDate)}</span>
      </span>

      <span className="row-main">
        <span className="row-league">
          <TeamLogo path={match.league?.logo} name={league} kind="league" />
          <span className="row-league-name">{league}</span>
        </span>

        {scoring ? (
          <span className="row-teams">
            <span className="row-team">
              <TeamSide teams={match.homeTeams?.length ? match.homeTeams : match.home ? [match.home] : []} sportType={match.sportType} />
            </span>
            <span className="row-score">{score(match.homeScore)} : {score(match.awayScore)}</span>
            <span className="row-team away">
              <TeamSide teams={match.awayTeams?.length ? match.awayTeams : match.away ? [match.away] : []} sportType={match.sportType} />
            </span>
          </span>
        ) : (
          <span className="row-event" title={eventName}>{eventName}</span>
        )}
      </span>

      <span className="row-status">
        {match.hot && <Flame className="hot" />}
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

  if (!m) return <p className="muted">No match data.</p>;

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
    <div className="match-detail">
      <div className="detail-head">
        <TeamLogo path={m.league?.logo} name={league} kind="league" />
        <div className="detail-head-text">
          <strong>{league}</strong>
          <div className="muted">
            {formatMatchDate(m.matchDate)}
            {m.round ? ` • Round ${m.round}` : ''}
            {m.season ? ` • ${m.season}` : ''}
          </div>
        </div>
        <StatusBadge status={m.status} />
      </div>

      {versus && (
        <div className="detail-score">
          <div className="detail-team">
            <TeamSide teams={m.homeTeams?.length ? m.homeTeams : m.home ? [m.home] : []} sportType={m.sportType ?? sportType} />
          </div>
          {started ? (
            <div className="detail-score-num">
              {score(m.homeScore)} : {score(m.awayScore)}
            </div>
          ) : (
            <div className="detail-kickoff">
              <span className="detail-kickoff-time">{kickoffTime}</span>
              <span className="detail-kickoff-label">Kick-off</span>
            </div>
          )}
          <div className="detail-team">
            <TeamSide teams={m.awayTeams?.length ? m.awayTeams : m.away ? [m.away] : []} sportType={m.sportType ?? sportType} />
          </div>
        </div>
      )}

      <h4 className="stream-heading">Stream ({streams.length})</h4>

      <div className="player-area">
        {playing ? (
          <StreamPlayer
            url={playing.url}
            referer={playing.referer}
            onError={handleOffline}
            onReady={handleReady}
          />
        ) : showFrameCountdown ? (
          <div className="player-placeholder">
            <div className="player-placeholder-inner">
              <p className="pp-label">Kick-off in</p>
              <Countdown targetMs={kickoffMs} />
            </div>
          </div>
        ) : (
          <div className="player-placeholder">
            <div className="player-placeholder-inner">
              <Tv className="pp-icon" />
              <p>
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
            className={`channels-toggle ${showChannels ? 'open' : ''}`}
            onClick={() => setShowChannels((v) => !v)}
          >
            <Tv size={14} />
            Channel
          </button>
        )}

        {showChannels && streams.length > 0 && (
          <div className="channel-overlay">
            <div className="channel-overlay-head">
              <span>Select Channel</span>
              <button type="button" className="btn-icon" onClick={() => setShowChannels(false)} aria-label="Close">✕</button>
            </div>
            <div className="channel-overlay-list">
              {streams.map((s, i) => {
                const active = playing?.key === i;
                const playable = isPlayable(s);
                return (
                  <button
                    type="button"
                    key={i}
                    className={`channel-item ${active ? 'active' : ''}`}
                    onClick={() => handlePlay(s, i)}
                  >
                    <span className={`channel-dot ${playable ? 'ok' : ''}`} />
                    <span className="channel-name">{streamLabel(s, i)}</span>
                    {resolving === i ? (
                      <Loader2 className="channel-loading spin" />
                    ) : active ? (
                      <Dot className="channel-live" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {playErr && <div className="error-banner">{playErr}</div>}
    </div>
  );
}

