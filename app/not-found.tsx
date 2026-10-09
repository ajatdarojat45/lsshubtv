import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="panel empty-state">
      <Compass className="empty-icon" />
      <h2>Page not found</h2>
      <p className="muted">The address you're looking for is not available.</p>
      <Link href="/" className="btn-back">← Back to matches</Link>
    </section>
  );
}
