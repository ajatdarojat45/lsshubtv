'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, MoreHorizontal } from 'lucide-react';
import { POPULAR_SPORTS, MORE_SPORTS } from '@/lib/sports';
import { usePrefetchCategory } from '@/lib/streamingQueries';

/** Header navigation bar — mirrors the home page toolbar: a "Live" tab, the
 *  popular sports, and a "More" button that opens the full sport picker. */
export function SportNav() {
  const pathname = usePathname();
  const prefetchCategory = usePrefetchCategory();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string): boolean => pathname === href;

  return (
    <>
      <nav className="app-nav" aria-label="Sport categories">
        <div className="sport-tabs" role="tablist">
          <Link href="/" className={`sport-tab live ${isActive('/') ? 'active' : ''}`}>
            <Radio className="sport-icon" />
            Live
          </Link>

          {POPULAR_SPORTS.map((s) => {
            const href = `/sports/${s.slug}`;
            return (
              <Link
                key={s.value}
                href={href}
                role="tab"
                aria-selected={isActive(href)}
                className={`sport-tab ${isActive(href) ? 'active' : ''}`}
                onMouseEnter={() => prefetchCategory(s.slug)}
                onFocus={() => prefetchCategory(s.slug)}
                onTouchStart={() => prefetchCategory(s.slug)}
              >
                <s.icon className="sport-icon" />
                {s.label}
              </Link>
            );
          })}

          <button
            type="button"
            className="sport-tab"
            onClick={() => setShowMore((v) => !v)}
            aria-haspopup="dialog"
            title="More sports"
          >
            <MoreHorizontal className="sport-icon" />
            More
          </button>
        </div>
      </nav>

      {showMore && (
        <div className="modal-overlay" onClick={() => setShowMore(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>All Sports</h2>
              <button type="button" className="btn-icon" onClick={() => setShowMore(false)} aria-label="Close">✕</button>
            </div>
            <div className="sport-grid">
              {MORE_SPORTS.map((s) => {
                const href = `/sports/${s.slug}`;
                return (
                  <Link
                    key={s.value}
                    href={href}
                    className={`sport-tile ${isActive(href) ? 'active' : ''}`}
                    onClick={() => setShowMore(false)}
                  >
                    <s.icon className="sport-tile-icon" />
                    <span>{s.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

