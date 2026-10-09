// Logo URL helpers — mirrors the decompiled Android LogoConstant.
// The API returns raw `logo` strings: either a full http(s) URL or a bare
// filename (e.g. "arsenal.png"). Bare filenames are expanded to a full URL as
// LOGO_HOST + <sport-specific path> + filename; full URLs keep their path but
// get their authority rewritten to LOGO_HOST (upstream rotates logo hosts).

export const DEFAULT_LOGO_HOST = 'https://logos1.tcllu137fien.ru';

/** Logo host — client bundle reads NEXT_PUBLIC_RB_LOGO_HOST, server actions
 * pass RB_LOGO_HOST (or the same public var) via resolveMatchLogos.
 * Read lazily (not at module top-level) so dotenv-loaded values apply. */
export function getLogoHost(): string {
  return (
    process.env.NEXT_PUBLIC_RB_LOGO_HOST ||
    process.env.RB_LOGO_HOST ||
    DEFAULT_LOGO_HOST
  );
}

export const LOGO_HOST = DEFAULT_LOGO_HOST;

const FOOTBALL_TEAM_LOGO_PATH = '/aelogo/football/team/';
const BASKETBALL_TEAM_PATH = '/aelogo/basketball/team/';
const BASEBALL_TEAM_PATH = '/aelogo/baseball/team/';
const VOLLEYBALL_TEAM_PATH = '/aelogo/volleyball/team/';
const AELOGO_V2_PATH = '/aelogo/v2/team/';
const LIN_LOGO_PATH = '/linlogo/res/image/data/';
const COUNTRY_LOGO_PATH = '/aelogo/country/';

const hostOf = (host: string): string => {
  try {
    return new URL(host).host;
  } catch {
    return host.replace(/^https?:\/\//, '').split('/')[0];
  }
};

/** Rewrite an absolute logo URL to the current logo host. */
function completedServerUrl(raw: string, logoHost?: string): string | null {
  const host = logoHost || getLogoHost();
  const t = (raw || '').trim();
  if (!t || !/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (!u.host) return null;
    u.host = hostOf(host);
    return u.toString();
  } catch {
    return null;
  }
}

function joinHost(host: string, path: string | null): string {
  if (!path) return '';
  const base = (host || DEFAULT_LOGO_HOST).replace(/\/+$/, '');
  return `${base}${path}`;
}

/** Team logo — same per-sport path mapping as LogoConstant.getTeamLogo. */
export function teamLogoUrl(
  sportType: number | undefined,
  raw: string | undefined,
  host?: string
): string {
  const logoHost = host || getLogoHost();
  const t = (raw || '').trim();
  if (!t) return '';
  const completed = completedServerUrl(t, logoHost);
  if (completed) return completed;
  // Bare filename → prefix the sport-specific directory.
  const filename = t.split('/').pop() || t;
  let dir: string | null = null;
  switch (sportType) {
    case 1: dir = FOOTBALL_TEAM_LOGO_PATH; break;
    case 2: dir = BASKETBALL_TEAM_PATH; break;
    case 3: // tennis
    case 12: // badminton
    case 6: // cricket
    case 11: // hockey
    case 16: // handball
      dir = AELOGO_V2_PATH; break;
    case 8: // rugby
    case 9: // american football
    case 10: // aussie rules
      dir = LIN_LOGO_PATH; break;
    case 4: dir = BASEBALL_TEAM_PATH; break;
    case 13: dir = VOLLEYBALL_TEAM_PATH; break;
    default:
      // Sports without a mapping in the original app (motorsport 7,
      // fighting 14, cycling 15, others 90, ...) — keep the generic path.
      dir = AELOGO_V2_PATH; break;
  }
  return joinHost(logoHost, dir ? `${dir}${filename}` : null);
}

/** League/country badge — mirrors LogoConstant.getCountryLogo. */
export function countryLogoUrl(
  raw: string | undefined,
  host?: string
): string {
  const logoHost = host || getLogoHost();
  const t = (raw || '').trim();
  if (!t) return '';
  const completed = completedServerUrl(t, logoHost);
  if (completed) return completed;
  const filename = t.split('/').pop() || t;
  return joinHost(logoHost, `${COUNTRY_LOGO_PATH}${filename}`);
}
