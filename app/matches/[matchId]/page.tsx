import { redirect } from 'next/navigation';

/** Legacy route kept for backwards compatibility — forwards to /watch/[id]. */
export default async function LegacyMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  redirect(`/watch/${matchId}`);
}
