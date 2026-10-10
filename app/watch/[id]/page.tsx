import type { Metadata } from 'next';
import { getMatchDetail } from '@/app/actions';
import { WatchPageContent } from '@/components/WatchPageContent';

interface PageProps {
  params: { id: string };
  searchParams: { sport?: string };
}

/** Dynamic SEO metadata — OpenGraph title/description/thumbnail fetched
 *  server-side from the match detail. */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const id = params.id;
  const sportType = Number(searchParams.sport) || 1;
  try {
    const res = await getMatchDetail({ matchId: id, sportType, language: 0, source: 'data' });
    if (!res.ok) throw new Error(res.error);
    const m = res.data.match;
    const title = m?.league?.name || m?.title || m?.name || 'Live Stream';
    const home = m?.home?.name || m?.homeTeams?.[0]?.name;
    const away = m?.away?.name || m?.awayTeams?.[0]?.name;
    const description = home && away ? `${home} vs ${away}` : title;
    const image = m?.league?.logo || m?.home?.logo || undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'video.other',
        images: image ? [{ url: image, alt: title }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: image || undefined,
      },
    };
  } catch {
    return { title: 'Live Stream', description: 'Watch live sports streaming.' };
  }
}

export default function WatchPage({ params }: PageProps) {
  return <WatchPageContent id={params.id} />;
}


