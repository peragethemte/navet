import authStore from './auth-store.js';
import homeyStore from './homey-store.js';
import openhabStore from './openhab-store.js';

const ENTUR_PROXY_BASE_PATH = '/__navet_entur_proxy__';
const JOURNEY_PLANNER_URL = 'https://api.entur.io/journey-planner/v3/graphql';
const GEOCODER_URL = 'https://api.entur.io/geocoder/v3/autocomplete';
// Entur asks every consumer to identify itself as <company>-<application> and reserves the right
// to block anonymous traffic. Browsers cannot set this header, which is why the relay exists.
const CLIENT_NAME = 'pearlgroup-navet';
const MAX_REQUEST_BODY_LENGTH = 8192;
const MAX_SEARCH_TEXT_LENGTH = 100;
const MAX_SEARCH_LIMIT = 10;

function sendJson(r, statusCode, payload) {
  r.headersOut['Cache-Control'] = 'no-store';
  r.headersOut['Content-Type'] = 'application/json; charset=utf-8';
  r.return(statusCode, JSON.stringify(payload));
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

/** `minLon,minLat,maxLon,maxLat`, the geocoder's only hard boundary on results. */
function parseBoundingBox(value) {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  const parts = value.split(',');
  if (parts.length !== 4) {
    return null;
  }

  const numbers = [];
  for (let index = 0; index < 4; index += 1) {
    const parsed = Number(parts[index]);
    const limit = index % 2 === 0 ? 180 : 90;
    if (!isFinite(parsed) || parsed < -limit || parsed > limit) {
      return null;
    }
    numbers.push(parsed);
  }

  if (numbers[0] >= numbers[2] || numbers[1] >= numbers[3]) {
    return null;
  }

  return numbers.join(',');
}

function parseSearchLimit(value) {
  if (value === undefined || value === '') {
    return String(MAX_SEARCH_LIMIT);
  }

  const parsed = Number(value);
  if (!isFinite(parsed) || parsed < 1) {
    return null;
  }

  return String(Math.min(MAX_SEARCH_LIMIT, Math.floor(parsed)));
}

async function relay(r, url, options) {
  try {
    const response = await ngx.fetch(url, options);
    const body = await response.text();
    r.headersOut['Cache-Control'] = 'no-store';
    r.headersOut['Content-Type'] = response.headers.get('Content-Type') || 'application/json';
    r.return(response.status, body);
  } catch (error) {
    sendJson(r, 502, { error: 'Unable to load transit data' });
  }
}

async function handleJourneyPlanner(r) {
  if (r.method !== 'POST') {
    sendJson(r, 405, { error: 'The journey planner accepts POST only' });
    return;
  }

  const body = r.requestText || '';
  if (body.length === 0 || body.length > MAX_REQUEST_BODY_LENGTH) {
    sendJson(r, 400, { error: 'A GraphQL request body is required' });
    return;
  }

  // The upstream host is fixed, so this is not an SSRF surface. Requiring a parsed GraphQL
  // document keeps malformed dashboard state from burning Entur's request budget.
  const parsed = parseJson(body);
  if (!parsed || typeof parsed.query !== 'string' || parsed.query === '') {
    sendJson(r, 400, { error: 'A GraphQL request body is required' });
    return;
  }

  await relay(r, JOURNEY_PLANNER_URL, {
    method: 'POST',
    headers: {
      'ET-Client-Name': CLIENT_NAME,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body,
  });
}

/**
 * njs decodes `r.args`, but the RSS proxy already carries a fallback for values that arrive still
 * encoded, so tolerate both. A literal percent sign never appears in a stop name, and malformed
 * input throws rather than corrupting the search.
 */
function readSearchText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  if (/%[0-9A-Fa-f]{2}/.test(value)) {
    try {
      return decodeURIComponent(value).trim();
    } catch (error) {
      return value.trim();
    }
  }

  return value.trim();
}

async function handleGeocoder(r) {
  const text = readSearchText(r.args.q);
  if (text === '' || text.length > MAX_SEARCH_TEXT_LENGTH) {
    sendJson(r, 400, { error: 'A q query parameter is required' });
    return;
  }

  const limit = parseSearchLimit(r.args.limit);
  if (limit === null) {
    sendJson(r, 400, { error: 'limit must be a positive number' });
    return;
  }

  let targetUrl =
    GEOCODER_URL + '?q=' + encodeURIComponent(text) + '&limit=' + limit + '&layers=stopPlace';

  if (r.args.bbox !== undefined) {
    const boundingBox = parseBoundingBox(r.args.bbox);
    if (boundingBox === null) {
      sendJson(r, 400, { error: 'bbox must be minLon,minLat,maxLon,maxLat' });
      return;
    }
    targetUrl += '&bbox=' + encodeURIComponent(boundingBox);
  }

  await relay(r, targetUrl, {
    headers: { 'ET-Client-Name': CLIENT_NAME, Accept: 'application/json' },
  });
}

// Same-origin relay for Entur's public JourneyPlanner and geocoder APIs. Both targets are fixed
// and trusted, so this only authenticates the caller and injects the required client-name header.
async function handleRequest(r) {
  if (
    !authStore.resolveAuthenticatedPrincipal(r, { trustIngressHeaders: false }) &&
    !homeyStore.resolveHomeySession(r) &&
    !openhabStore.resolveOpenHABSession(r)
  ) {
    sendJson(r, 401, { error: 'Authentication required' });
    return;
  }

  const suffix = r.uri.slice(ENTUR_PROXY_BASE_PATH.length) || '/';

  if (suffix === '/journey-planner') {
    await handleJourneyPlanner(r);
    return;
  }

  if (suffix === '/geocoder') {
    await handleGeocoder(r);
    return;
  }

  sendJson(r, 404, { error: 'Unknown Entur proxy path' });
}

async function handle(r) {
  return handleRequest(r);
}

export default { handle: handle };
