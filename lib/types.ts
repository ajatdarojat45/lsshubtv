// Domain types shared across the app.

import type { LucideIcon } from 'lucide-react';

export type MatchSource = 'data' | 'live';

export interface Team {
  teamId?: number;
  playerId?: number;
  name?: string;
  nameMap?: Record<number, string>;
  logo?: string;
  country?: string;
  countryLogo?: string;
  hot?: boolean;
  score?: number;
}

export interface League {
  leagueId?: number;
  name?: string;
  nameMap?: Record<number, string>;
  logo?: string;
  country?: string;
  countryLogo?: string;
  hot?: boolean;
}

export interface Contender {
  sportType?: number;
  name?: string;
  team?: Team;
}

export interface Match {
  source?: MatchSource;
  matchId?: number;
  sportType?: number;
  matchDate?: number;
  status?: number;
  showStatus?: number;
  scoringMatch?: boolean;
  league?: League;
  season?: string;
  stage?: string;
  name?: string;
  title?: string;
  group?: string;
  round?: string;
  hot?: boolean;
  home?: Team;
  away?: Team;
  /** Doubles/multiple players per side (tennis/badminton ganda, ...).
   * Even-indexed contenders = home side, odd-indexed = away side,
   * mirroring HomeContenderState pairing (0+2 vs 1+3). */
  homeTeams?: Team[];
  awayTeams?: Team[];
  homeScore?: number;
  awayScore?: number;
  contenders?: Contender[];
}

export interface Stream {
  streamId?: number;
  channelId?: number;
  name?: string;
  url?: string;
  streamStatus?: number;
  status?: number;
  availableType?: number;
  recommend?: boolean;
  priority?: number;
  siteType?: number;
  fullName?: string;
  urlCdnType?: number;
  headers: Record<string, string>;
  extra: Record<string, string>;
  matchId?: number;
  pageUrl?: string;
}

export interface MatchDetail {
  source?: MatchSource;
  match?: Match;
  streams?: Stream[];
  channels?: Stream[];
}

export interface MatchList {
  list: Match[];
  source: MatchSource;
}

export interface Sport {
  value: number;
  label: string;
  icon: LucideIcon;
  color: string;
  /** Whether the sport uses a home/away score (defaults to true). */
  scoring?: boolean;
}

export interface AppConfig {
  sportType: number;
  language: number;
  streamId: number;
  channelId: number;
  siteType: number;
  continent: string;
  country: string;
  deviceId: string;
  activationCode: string;
}
