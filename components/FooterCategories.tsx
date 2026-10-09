'use client';

import { useRB } from '@/components/RBProvider';
import { SPORTS } from '@/lib/sports';

/** Footer category links — selecting one also drives the top tab list (via cfg). */
export function FooterCategories() {
  const { setCfg } = useRB();

  const pick = (value: number): void => {
    // Apply immediately (also covers clicking the already-current category).
    setCfg((c) => (c.sportType === value ? c : { ...c, sportType: value }));
    // Keep the URL in sync with the selected category.
    window.history.replaceState(null, '', `/?sport=${value}`);
    // The footer is at the bottom — bring the user back to the tab list.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ul className="footer-links footer-cats">
      {SPORTS.map((s) => (
        <li key={s.value}>
          <a
            href={`/?sport=${s.value}`}
            onClick={(e) => {
              e.preventDefault();
              pick(s.value);
            }}
          >
            {s.label}
          </a>
        </li>
      ))}
    </ul>
  );
}