'use client';

import { useEffect, useState } from 'react';
import AdBanner from '@/components/AdBanner';

/** Lazy gutter ad — defers loading until the user scrolls, instead of firing
 *  on initial page load (keeps the first paint lighter). */
export function LazyGutterAd({ slotId }: { slotId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setShow(true);
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) {
    return <div className="gutter-ad-placeholder" aria-hidden="true" />;
  }
  return <AdBanner slotId={slotId} size="skyscraper" />;
}
