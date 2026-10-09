import { createHash } from 'node:crypto';
import { rot47 } from './proto';
import { DATA_API, RB_HEADERS } from './constants';

const rot13 = (s: string): string =>
  s.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });

/** RBCrypto.bruDecode: substring(8) -> URLDecode -> ROT13 -> base64 decode */
const bruDecode = (s: string): string =>
  Buffer.from(rot13(decodeURIComponent(s.substring(8))), 'base64').toString('utf8');

const md5 = (s: string): string => createHash('md5').update(s).digest('hex');

export interface MediaConfig {
  at: number;
  salt: string;
  rbHeaders: Record<string, string> | null;
}

// Media config (CSL salt + rbHeaders) fetched from /api/common/params, cached 5 min.
let mediaCfg: MediaConfig = { at: 0, salt: '00', rbHeaders: null };
// Coalesce concurrent callers so a cache expiry triggers exactly ONE upstream
// fetch instead of a thundering herd (every pending image/stream request
// re-fetching /api/common/params at once → HTTP 429).
let mediaCfgInflight: Promise<MediaConfig> | null = null;

export function getMediaConfig(): Promise<MediaConfig> {
  if (Date.now() - mediaCfg.at < 5 * 60_000) return Promise.resolve(mediaCfg);
  if (mediaCfgInflight) return mediaCfgInflight;
  mediaCfgInflight = (async () => {
    try {
      const r = await fetch(`${DATA_API}/api/common/params`, { headers: RB_HEADERS });
      const cfg = JSON.parse(rot47(await r.text()));
      const csl = JSON.parse(cfg['common:cdnSmartLink:app'] || cfg['common:cdnSmartLink'] || '{}');
      const p3 = JSON.parse(cfg['common:p2p:v3'] || '{}');
      mediaCfg = {
        at: Date.now(),
        salt: csl?.auth?.salt || '00',
        rbHeaders: p3?.basicConfig?.rbHeaders || null,
      };
    } catch (e) {
      // Keep the last good config but reset the timestamp so the next caller
      // retries after the window — never cache a failed fetch as success.
      mediaCfg.at = Date.now();
    } finally {
      mediaCfgInflight = null;
    }
    return mediaCfg;
  })();
  return mediaCfgInflight;
}

/** Rewrite CSL segment URLs (containing _ctump/_ctuph) to the fallback host. */
export function cslTransform(target: string, salt: string): string {
  try {
    const u = new URL(target);
    const mp = u.searchParams.get('_ctump');
    const ph = u.searchParams.get('_ctuph');
    if (!mp || !ph) return target;
    const domain = bruDecode(mp).split('@')[1];
    const path = bruDecode(ph);
    const bu = new URL(`https://${domain}${path}`);
    const lastSeg = bu.pathname.split('/').pop() || '';
    const ver = bu.searchParams.get('_ver') || '';
    bu.searchParams.set('_s2', md5(`${lastSeg},${ver},${salt}`));
    return bu.href;
  } catch {
    return target;
  }
}

/** Wrap a media URL so it goes through the local proxy. */
export function proxyUrl(u: string, referer?: string): string {
  return `/api/media-proxy?url=${encodeURIComponent(u)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
}
