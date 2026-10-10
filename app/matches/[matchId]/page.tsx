import { redirect } from 'next/navigation';

/** Legacy route kept for backwards compatibility — forwards to /watch/[id]. */
export default function LegacyMatchPage({ params }: { params: { matchId: string } }) {
  redirect(`/watch/${params.matchId}`);
}
