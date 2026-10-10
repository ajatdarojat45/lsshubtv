'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export type AdBannerSize = 'leaderboard' | 'rectangle' | 'mobile-banner' | 'skyscraper';

/** Reserved height per size — reserves the space up front to prevent CLS
 *  (equivalent to Tailwind `min-h-[90px]` / `min-h-[250px]`). */
const MIN_HEIGHTS: Record<AdBannerSize, number> = {
  leaderboard: 90, // 728x90 / responsive leaderboard
  rectangle: 250, // 300x250 medium rectangle
  'mobile-banner': 60, // 320x50 mobile banner
  skyscraper: 600, // 160x600 skyscraper
};

export interface AdBannerProps {
  /** Ad slot identifier from your ad network (e.g. AdSense `data-ad-slot`). */
  slotId: string;
  /** Current sport category — forwarded to the network for targeting. */
  category?: string;
  /** Ad network script URL. Loaded once via next/script (see note below). */
  scriptSrc?: string;
  /** next/script loading strategy — keep non-blocking to protect LCP. */
  strategy?: 'lazyOnload' | 'afterInteractive';
  /** Fixed slot height (default: leaderboard). */
  size?: AdBannerSize;
  /** AdSense publisher client (ca-pub-XXXX). Enables the built-in AdSense render. */
  client?: string;
  /** Escape hatch for other networks — render your unit into `container`.
   *  Called on mount and after every route change. */
  onRender?: (
    container: HTMLElement,
    ctx: { slotId: string; category?: string; pathname: string }
  ) => void;
  className?: string;
}

/**
 * Reusable ad wrapper.
 *
 * 1. Reserves a fixed-height slot up front (no CLS).
 * 2. Lazy-loads the network script once via next/script.
 * 3. Accepts `slotId` + `category`.
 * 4. Resets & re-renders the slot automatically on every route change
 *    (e.g. navigating between `/sports/[category]` pages).
 *
 * NOTE: next/script dedupes external scripts by `src`, so multiple AdBanner
 * instances sharing `scriptSrc` load the network library only once.
 */
export default function AdBanner({
  slotId,
  category,
  scriptSrc,
  strategy = 'afterInteractive',
  size = 'leaderboard',
  client,
  onRender,
  className,
}: AdBannerProps) {
  const pathname = usePathname();
  const slotRef = useRef<HTMLDivElement>(null);

  // Keep the latest render callback in a ref so the effect does not re-run on
  // every parent render (only on route/slot changes).
  const onRenderRef = useRef(onRender);
  useEffect(() => {
    onRenderRef.current = onRender;
  }, [onRender]);

  // (Re)render the ad on mount and after every route change.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    // Reset so navigation never leaves a stale ad / double-counts impressions.
    slot.innerHTML = '';

    const ctx = { slotId, category, pathname };

    if (onRenderRef.current) {
      onRenderRef.current(slot, ctx);
    } else if (client) {
      // Built-in Google AdSense render.
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', client);
      ins.setAttribute('data-ad-slot', slotId);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      if (category) ins.setAttribute('data-ad-channel', category);
      slot.appendChild(ins);

      try {
        const w = window as Window & { adsbygoogle?: unknown[] };
        w.adsbygoogle = w.adsbygoogle || [];
        w.adsbygoogle.push({});
      } catch {
        // Script not loaded yet — AdSense flushes the queued push on load.
      }
    }

    return () => {
      slot.innerHTML = '';
    };
  }, [pathname, slotId, category, client]);

  return (
    <>
      <div
        className={`relative mb-4 flex w-full items-center justify-center overflow-hidden rounded-sm border border-border-soft bg-panel ${className ?? ''}`}
        style={{ minHeight: MIN_HEIGHTS[size] }}
        role="complementary"
        aria-label="Advertisement"
      >
        <span className="absolute left-2.5 top-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted opacity-[0.65]">
          Advertisement
        </span>
        <div ref={slotRef} className="flex w-full items-center justify-center" />
      </div>
      {scriptSrc ? <Script src={scriptSrc} strategy={strategy} /> : null}
    </>
  );
}
