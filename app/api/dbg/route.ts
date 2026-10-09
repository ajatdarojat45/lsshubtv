import { NextResponse } from 'next/server';
import { getMatches } from '@/app/actions';

/** TEMP DEBUG: verify home/away decode for football + tennis. */
export async function GET() {
  const out: Record<string, unknown> = {};
  for (const sportType of [1, 3]) {
    const res = await getMatches({ source: 'data', sportType, language: 0 });
    if (!res.ok) {
      out[sportType] = { error: res.error };
      continue;
    }
    out[sportType] = {
      total: res.data.list.length,
      sample: res.data.list.slice(0, 3).map((m) => ({
        matchId: m.matchId,
        title: m.title ?? m.name ?? null,
        home: m.home?.name ?? null,
        away: m.away?.name ?? null,
      })),
    };
  }
  return NextResponse.json(out);
}
