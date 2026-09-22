import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PreviewServer, ViteDevServer } from 'vite';
import { normalizeViteProxyTargetPath } from './vite-proxy-path.ts';
import { setSecurityHeaders } from './vite-response-security.ts';

const PROXY_BASE_PATH = '/__navet_entur_proxy__';
const JOURNEY_PLANNER_URL = 'https://api.entur.io/journey-planner/v3/graphql';
const GEOCODER_URL = 'https://api.entur.io/geocoder/v3/autocomplete';
// Entur asks every consumer to identify itself as <company>-<application> and reserves the right
// to block anonymous traffic. Browsers cannot set this header, which is why the relay exists.
const CLIENT_NAME = 'pearlgroup-navet';
const MAX_REQUEST_BODY_LENGTH = 8192;
const MAX_SEARCH_TEXT_LENGTH = 100;
const MAX_SEARCH_LIMIT = 10;

/** `minLon,minLat,maxLon,maxLat`, the geocoder's only hard boundary on results. */
function parseBoundingBox(value: string | null): string | null {
  if (value === null || value === '') {
    return null;
  }

  const parts = value.split(',');
  if (parts.length !== 4) {
    return null;
  }

  const numbers: number[] = [];
  for (const [index, part] of parts.entries()) {
    const parsed = Number(part);
    const limit = index % 2 === 0 ? 180 : 90;
    if (!Number.isFinite(parsed) || parsed < -limit || parsed > limit) {
      return null;
    }
    numbers.push(parsed);
  }

  if (numbers[0]! >= numbers[2]! || numbers[1]! >= numbers[3]!) {
    return null;
  }

  return numbers.join(',');
}

function parseSearchLimit(value: string | null): string | null {
  if (value === null || value === '') {
    return String(MAX_SEARCH_LIMIT);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return String(Math.min(MAX_SEARCH_LIMIT, Math.floor(parsed)));
}

async function readRequestBody(req: IncomingMessage): Promise<string | null> {
  let body = '';
  for await (const chunk of req) {
    body += String(chunk);
    if (body.length > MAX_REQUEST_BODY_LENGTH) {
      return null;
    }
  }
  return body;
}

/**
 * Same-origin relay for Entur's public JourneyPlanner and geocoder APIs. Both targets are fixed
 * and trusted, so this only authenticates the caller and injects the required client-name header.
 */
export function enturProxyPlugin(
  isAuthenticated: (req: IncomingMessage, res: ServerResponse) => boolean
) {
  const sendJson = (res: ServerResponse, statusCode: number, payload: Record<string, unknown>) => {
    res.statusCode = statusCode;
    setSecurityHeaders(res);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  const relay = async (res: ServerResponse, url: string, init: RequestInit) => {
    try {
      const upstreamResponse = await fetch(url, init);
      const body = await upstreamResponse.text();

      res.statusCode = upstreamResponse.status;
      setSecurityHeaders(res);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Type',
        upstreamResponse.headers.get('content-type') ?? 'application/json'
      );
      res.end(body);
    } catch {
      sendJson(res, 502, { error: 'Unable to load transit data' });
    }
  };

  const handleJourneyPlanner = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'The journey planner accepts POST only' });
      return;
    }

    const body = await readRequestBody(req);
    // The upstream host is fixed, so this is not an SSRF surface. Requiring a parsed GraphQL
    // document keeps malformed dashboard state from burning Entur's request budget.
    let parsed: unknown = null;
    if (body !== null && body.length > 0) {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = null;
      }
    }

    if (
      body === null ||
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { query?: unknown }).query !== 'string' ||
      (parsed as { query: string }).query === ''
    ) {
      sendJson(res, 400, { error: 'A GraphQL request body is required' });
      return;
    }

    await relay(res, JOURNEY_PLANNER_URL, {
      method: 'POST',
      headers: {
        'ET-Client-Name': CLIENT_NAME,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    });
  };

  const handleGeocoder = async (query: URLSearchParams, res: ServerResponse) => {
    const text = (query.get('q') ?? '').trim();
    if (text === '' || text.length > MAX_SEARCH_TEXT_LENGTH) {
      sendJson(res, 400, { error: 'A q query parameter is required' });
      return;
    }

    const limit = parseSearchLimit(query.get('limit'));
    if (limit === null) {
      sendJson(res, 400, { error: 'limit must be a positive number' });
      return;
    }

    const upstreamUrl = new URL(GEOCODER_URL);
    upstreamUrl.searchParams.set('q', text);
    upstreamUrl.searchParams.set('limit', limit);
    upstreamUrl.searchParams.set('layers', 'stopPlace');

    if (query.has('bbox')) {
      const boundingBox = parseBoundingBox(query.get('bbox'));
      if (boundingBox === null) {
        sendJson(res, 400, { error: 'bbox must be minLon,minLat,maxLon,maxLat' });
        return;
      }
      upstreamUrl.searchParams.set('bbox', boundingBox);
    }

    await relay(res, upstreamUrl.toString(), {
      headers: { 'ET-Client-Name': CLIENT_NAME, Accept: 'application/json' },
    });
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

    if (pathname === '/journey-planner') {
      await handleJourneyPlanner(req, res);
      return;
    }

    if (pathname === '/geocoder') {
      await handleGeocoder(new URL(rawUrl, 'http://localhost').searchParams, res);
      return;
    }

    sendJson(res, 404, { error: 'Unknown Entur proxy path' });
  };

  return {
    name: 'navet-entur-proxy',
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
