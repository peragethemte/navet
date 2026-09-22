import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PreviewServer, ViteDevServer } from 'vite';
import { normalizeViteProxyTargetPath } from './vite-proxy-path.ts';
import { setSecurityHeaders } from './vite-response-security.ts';

const PROXY_BASE_PATH = '/__navet_yr_proxy__';
const MET_NO_BASE_URL = 'https://api.met.no';
const USER_AGENT = 'navet-dashboard/dev github.com/peragethemte/navet';
const DATE_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface YrLocationConfig {
  latitude: string;
  longitude: string;
  locationName: string;
}

function readYrLocationConfig(): YrLocationConfig | null {
  const latitude = process.env.NAVET_YR_LATITUDE?.trim();
  const longitude = process.env.NAVET_YR_LONGITUDE?.trim();
  if (!latitude || !longitude) {
    return null;
  }

  return {
    latitude,
    longitude,
    locationName: process.env.NAVET_YR_LOCATION_NAME?.trim() ?? '',
  };
}

function parseCoordinate(value: string | null, limit: number): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < -limit || parsed > limit) {
    return null;
  }

  return String(parsed);
}

/**
 * Coordinates sent by the dashboard win over the environment defaults. The upstream host is
 * fixed, so this is not an SSRF surface - the range check keeps malformed input from reaching
 * met.no and burning request quota on guaranteed errors.
 */
function resolveRequestLocation(
  query: URLSearchParams,
  config: YrLocationConfig | null
): { latitude: string; longitude: string } | 'invalid' | null {
  if (!query.has('lat') && !query.has('lon')) {
    return config ? { latitude: config.latitude, longitude: config.longitude } : null;
  }

  const latitude = parseCoordinate(query.get('lat'), 90);
  const longitude = parseCoordinate(query.get('lon'), 180);
  if (latitude === null || longitude === null) {
    return 'invalid';
  }

  return { latitude, longitude };
}

/**
 * Same-origin relay for met.no's public locationforecast/sunrise APIs. Unlike the RSS proxy,
 * the upstream target is fixed and trusted (never a user-supplied URL), so this only needs to
 * inject the required User-Agent header and the server-configured coordinates - no SSRF guard.
 */
export function yrProxyPlugin(
  isAuthenticated: (req: IncomingMessage, res: ServerResponse) => boolean
) {
  const sendJson = (res: ServerResponse, statusCode: number, payload: Record<string, unknown>) => {
    res.statusCode = statusCode;
    setSecurityHeaders(res);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    if (!isAuthenticated(req, res)) {
      sendJson(res, 401, { error: 'Authentication required' });
      return;
    }

    const rawUrl = req.url ?? '';
    const targetPath = normalizeViteProxyTargetPath(PROXY_BASE_PATH, rawUrl);
    const separatorIndex = targetPath.indexOf('?');
    const pathname = separatorIndex === -1 ? targetPath : targetPath.slice(0, separatorIndex);
    const query = new URL(rawUrl, 'http://localhost').searchParams;

    const config = readYrLocationConfig();

    if (pathname === '/status') {
      sendJson(res, 200, {
        configured: config !== null,
        locationName: config ? config.locationName || null : null,
      });
      return;
    }

    const location = resolveRequestLocation(query, config);
    if (location === 'invalid') {
      sendJson(res, 400, {
        error: 'lat must be between -90 and 90 and lon between -180 and 180',
      });
      return;
    }
    if (!location) {
      sendJson(res, 503, { error: 'Yr.no location is not configured' });
      return;
    }

    let upstreamUrl: URL;
    if (pathname === '/compact') {
      upstreamUrl = new URL('/weatherapi/locationforecast/2.0/compact', MET_NO_BASE_URL);
    } else if (pathname === '/sunrise') {
      const date = query.get('date') ?? '';
      if (!DATE_QUERY_PATTERN.test(date)) {
        sendJson(res, 400, { error: 'A valid date=YYYY-MM-DD query parameter is required' });
        return;
      }
      upstreamUrl = new URL('/weatherapi/sunrise/3.0/sun', MET_NO_BASE_URL);
      upstreamUrl.searchParams.set('date', date);
    } else {
      sendJson(res, 404, { error: 'Unknown Yr.no proxy path' });
      return;
    }

    upstreamUrl.searchParams.set('lat', location.latitude);
    upstreamUrl.searchParams.set('lon', location.longitude);

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      const body = await upstreamResponse.text();

      res.statusCode = upstreamResponse.status;
      setSecurityHeaders(res);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', upstreamResponse.headers.get('content-type') ?? 'application/json');
      res.end(body);
    } catch {
      sendJson(res, 502, { error: 'Unable to load Yr.no data' });
    }
  };

  return {
    name: 'navet-yr-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(PROXY_BASE_PATH, async (req, res) => {
        await handleRequest(req, res);
      });
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(PROXY_BASE_PATH, async (req, res) => {
        await handleRequest(req, res);
      });
    },
  };
}
