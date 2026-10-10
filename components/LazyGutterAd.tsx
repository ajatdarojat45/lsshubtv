'use client';

import { useEffect, useState } from 'react';
import AdBanner from '@/components/AdBanner';

/** How far the user must scroll before the rail is revealed (px). */
const REVEAL_AFTER = 320;

/** Lazy gutter ad — the left/right rails stay empty on first paint (their
 *  height is still reserved so the layout never shifts) and the ad only mounts
 *  once the user actually scrolls the page. */
export function LazyGutterAd({ slotId }: { slotId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      if (window.scrollY < REVEAL_AFTER) return;
      setShow(true);
      window.removeEventListener('scroll', onScroll);
    };
    // Also covers a restored scroll position (back/forward navigation) and
    // ignores the stray scroll event some browsers fire during page load.
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) {
    return <div className="h-[600px] w-full" aria-hidden="true" />;
  }
  return (
    <div className="animate-[fadeIn_0.35s_ease-out]">
      <AdBanner slotId={slotId} size="skyscraper" />
    </div>
  );
}
