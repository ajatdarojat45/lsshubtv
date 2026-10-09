import {
  Trophy,
  Target,
  CircleDot,
  Gauge,
  Circle,
  Activity,
  Shield,
  Flag,
  Zap,
  Snowflake,
  Feather,
  CircleDashed,
  Swords,
  Bike,
  Dumbbell,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import type { Sport } from './types';

/** Single source of truth for sport categories (mapped to the app's sportType enum). */
export const SPORTS: Sport[] = [
  { value: 1, label: 'Football', icon: Trophy, color: '#22c55e' },
  { value: 2, label: 'Basketball', icon: Target, color: '#f97316' },
  { value: 3, label: 'Tennis', icon: CircleDot, color: '#a3e635' },
  { value: 7, label: 'Motorsport', icon: Gauge, color: '#ef4444', scoring: false },
  { value: 4, label: 'Baseball', icon: Circle, color: '#eab308' },
  { value: 6, label: 'Cricket', icon: Activity, color: '#4ade80' },
  { value: 8, label: 'Rugby', icon: Shield, color: '#d97706' },
  { value: 9, label: 'American Football', icon: Flag, color: '#c084fc' },
  { value: 10, label: 'Aussie Rules', icon: Zap, color: '#facc15' },
  { value: 11, label: 'Ice Hockey', icon: Snowflake, color: '#38bdf8' },
  { value: 12, label: 'Badminton', icon: Feather, color: '#2dd4bf' },
  { value: 13, label: 'Volleyball', icon: CircleDashed, color: '#fb923c' },
  { value: 14, label: 'Fighting', icon: Swords, color: '#f43f5e', scoring: false },
  { value: 15, label: 'Cycling', icon: Bike, color: '#10b981', scoring: false },
  { value: 16, label: 'Handball', icon: Dumbbell, color: '#818cf8' },
  { value: 90, label: 'Others', icon: LayoutGrid, color: '#94a3b8' },
];

export const POPULAR_SPORTS: Sport[] = SPORTS.slice(0, 4);
export const MORE_SPORTS: Sport[] = SPORTS.slice(4);

const sportByValue = new Map(SPORTS.map((s) => [s.value, s]));

export function sportLabel(code?: number): string {
  return sportByValue.get(code ?? -1)?.label ?? `Sport ${code}`;
}

export function sportIcon(code?: number): LucideIcon {
  return sportByValue.get(code ?? -1)?.icon ?? LayoutGrid;
}

export function sportColor(code?: number): string {
  return sportByValue.get(code ?? -1)?.color ?? '#94a3b8';
}

export function sportIsScoring(code?: number): boolean {
  return sportByValue.get(code ?? -1)?.scoring !== false;
}


