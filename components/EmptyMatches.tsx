'use client';

import type { ComponentType } from 'react';
import { CalendarX2, Inbox, SearchX } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

/** Empty-state kind → icon + default copy. `search` = query returned nothing,
 *  `filter` = a status tab is empty, `none` = the feed itself is empty. */
export type EmptyKind = 'search' | 'filter' | 'none';

const KIND_META: Record<EmptyKind, { Icon: ComponentType<LucideProps>; title: string; desc: string }> = {
  search: {
    Icon: SearchX,
    title: 'No results',
    desc: 'No matches match your search. Try a different keyword or clear the search.',
  },
  filter: {
    Icon: CalendarX2,
    title: 'Nothing here yet',
    desc: 'There are no matches in this view right now. Check another tab.',
  },
  none: {
    Icon: Inbox,
    title: 'No matches',
    desc: 'There are no matches in this category right now. Pull to refresh or try again later.',
  },
};

/** Centered empty state for "no matches": contextual icon in a soft badge,
 *  title, description, and optional action buttons (clear search / retry). */
export function EmptyMatches({
  kind,
  title,
  desc,
  onClear,
  onRetry,
  retryBusy = false,
}: {
  kind: EmptyKind;
  title?: string;
  desc?: string;
  onClear?: () => void;
  onRetry?: () => void;
  retryBusy?: boolean;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.Icon;
  return (
    <section className="mb-4 flex flex-col items-center rounded border border-border bg-panel px-5 py-12 text-center max-[640px]:px-4 max-[640px]:py-10">
      <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="m-0 mb-1.5 text-[19px] font-bold">{title ?? meta.title}</h2>
      <p className="m-0 mb-4 max-w-[380px] text-sm leading-[1.65] text-muted">{desc ?? meta.desc}</p>
      {(onClear || onRetry) && (
        <span className="flex flex-wrap items-center justify-center gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-semibold text-text transition-all hover:border-[#c7ccd2]"
            >
              Clear search
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retryBusy}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Try again
            </button>
          )}
        </span>
      )}
    </section>
  );
}
