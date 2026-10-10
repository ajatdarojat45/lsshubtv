import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="mb-4 rounded border border-border bg-panel px-5 py-10 text-center max-[640px]:px-4 max-[640px]:py-8">
      <Compass className="h-9 w-9" />
      <h2 className="mt-2 mb-1.5 text-[19px]">Page not found</h2>
      <p className="mb-3.5 text-sm leading-[1.65] text-muted">The address you're looking for is not available.</p>
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent no-underline hover:underline">← Back to matches</Link>
    </section>
  );
}
