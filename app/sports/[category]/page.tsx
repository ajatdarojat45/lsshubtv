import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sportBySlug, SPORTS } from '@/lib/sports';
import { SportCategoryMatches } from '@/components/SportCategoryMatches';

interface PageProps {
  params: { category: string };
}

/** Pre-render each known sport slug as a static HTML shell (Vercel-friendly). */
export function generateStaticParams() {
  return SPORTS.map((s) => ({ category: s.slug }));
}

/** Dynamic SEO metadata derived from the category slug. */
export function generateMetadata({ params }: PageProps): Metadata {
  const sport = sportBySlug(params.category);
  if (!sport) {
    return {
      title: 'Category not found',
      description: 'The requested sport category does not exist.',
    };
  }
  return {
    title: `${sport.label} — Live Streaming`,
    description: `Watch ${sport.label} live matches. Browse the latest ${sport.label} fixtures, results and highlights.`,
  };
}

export default function SportCategoryPage({ params }: PageProps) {
  const sport = sportBySlug(params.category);
  if (!sport) notFound();
  return <SportCategoryMatches sportType={sport.value} category={sport.slug} label={sport.label} />;
}
