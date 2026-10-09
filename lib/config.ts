// Client-safe app defaults. Every value comes from a NEXT_PUBLIC_* variable in
// .env (see .env.example) — each is referenced statically here so Next.js can
// inline it into the browser bundle.

import { int, required } from './env';

export const DEFAULT_STREAM_ID = int(
  process.env.NEXT_PUBLIC_RB_STREAM_ID,
  'NEXT_PUBLIC_RB_STREAM_ID'
);
export const DEFAULT_CHANNEL_ID = int(
  process.env.NEXT_PUBLIC_RB_CHANNEL_ID,
  'NEXT_PUBLIC_RB_CHANNEL_ID'
);
export const DEFAULT_SITE_TYPE = int(
  process.env.NEXT_PUBLIC_RB_SITE_TYPE,
  'NEXT_PUBLIC_RB_SITE_TYPE'
);
export const DEFAULT_CONTINENT = required(
  process.env.NEXT_PUBLIC_RB_CONTINENT,
  'NEXT_PUBLIC_RB_CONTINENT'
);
export const DEFAULT_COUNTRY = required(
  process.env.NEXT_PUBLIC_RB_COUNTRY,
  'NEXT_PUBLIC_RB_COUNTRY'
);
export const DEFAULT_DEVICE_ID = required(
  process.env.NEXT_PUBLIC_RB_DEVICE_ID,
  'NEXT_PUBLIC_RB_DEVICE_ID'
);
/** Activation code may legitimately be empty. */
export const DEFAULT_ACTIVATION_CODE = process.env.NEXT_PUBLIC_RB_ACTIVATION_CODE ?? '';
