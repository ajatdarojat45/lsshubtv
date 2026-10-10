import Link from 'next/link';
import { SPORTS } from '@/lib/sports';

/** Footer category links — route to the dedicated /sports/[slug] pages. */
export function FooterCategories() {
  return (
    <ul className="footer-links footer-cats">
      {SPORTS.map((s) => (
        <li key={s.value}>
          <Link href={`/sports/${s.slug}`}>{s.label}</Link>
        </li>
      ))}
    </ul>
  );
}