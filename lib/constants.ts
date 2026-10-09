/** Upstream API hosts and shared app headers — configured via .env (see .env.example). */

import { required } from './env';

export const DATA_API = required(process.env.RB_DATA_API, 'RB_DATA_API');
export const LIVE_API = required(process.env.RB_LIVE_API, 'RB_LIVE_API');

/** Headers matching the original app's NetworkInterceptor. */
export const RB_HEADERS: Record<string, string> = {
  'user-agent': required(process.env.RB_USER_AGENT, 'RB_USER_AGENT'),
  origin: required(process.env.RB_ORIGIN, 'RB_ORIGIN'),
};
