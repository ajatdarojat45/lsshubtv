import { getMediaConfig, cslTransform, proxyUrl } from '@/lib/mediaProxy';
import { RB_HEADERS } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  if (!target) return new Response('invalid url param', { status: 400 });

  const referer = searchParams.get('referer');

  try {
    const cfg = await getMediaConfig();
    const headers: Record<string, string> = { ...RB_HEADERS, ...(cfg.rbHeaders ?? {}) };
    if (referer) {
      headers.referer = referer;
      try {
        headers.origin = new URL(referer).origin;
      } catch {
        /* ignore */
      }
    }

    // CSL segments are rewritten to the fallback host + _s2 signature.
    const finalUrl = cslTransform(target, cfg.salt);

    const resp = await fetch(finalUrl, { headers, redirect: 'follow' });
    const ct = resp.headers.get('content-type') || '';
    const isM3u8 =
      ct.includes('mpegurl') || ct.includes('m3u8') || target.split('?')[0].endsWith('.m3u8');

    if (isM3u8 && resp.ok) {
      const base = new URL(target);
      const text = await resp.text();
      const rewritten = text
        .split('\n')
        .map((line) => {
          const t = line.trim();
          if (!t) return line;
          if (t.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
              try {
                return `URI="${proxyUrl(new URL(uri, base).href, referer ?? undefined)}"`;
              } catch {
                return `URI="${uri}"`;
              }
            });
          }
          try {
            return proxyUrl(new URL(t, base).href, referer ?? undefined);
          } catch {
            return line;
          }
        })
        .join('\n');
      return new Response(rewritten, {
        status: resp.status,
        headers: {
          'content-type': 'application/vnd.apple.mpegurl',
          'access-control-allow-origin': '*',
        },
      });
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    return new Response(buf, {
      status: resp.status,
      headers: {
        'content-type': ct || 'application/octet-stream',
        'access-control-allow-origin': '*',
        'content-length': String(buf.length),
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 502 });
  }
}
