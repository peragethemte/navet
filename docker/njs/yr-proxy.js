import authStore from './auth-store.js';
import homeyStore from './homey-store.js';
import openhabStore from './openhab-store.js';

const YR_PROXY_BASE_PATH = '/__navet_yr_proxy__';
const MET_NO_BASE_URL = 'https://api.met.no';
const USER_AGENT = 'navet-dashboard/1.0 github.com/peragethemte/navet';
const DATE_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sendJson(r, statusCode, payload) {
  r.headersOut['Cache-Control'] = 'no-store';
  r.headersOut['Content-Type'] = 'application/json; charset=utf-8';
  r.return(statusCode, JSON.stringify(payload));
}

function readLocationConfig() {
  const latitude = (process.env.NAVET_YR_LATITUDE || '').trim();
  const longitude = (process.env.NAVET_YR_LONGITUDE || '').trim();
  if (!latitude || !longitude) {
    return null;
  }

  return {
    latitude: latitude,
    longitude: longitude,
    locationName: (process.env.NAVET_YR_LOCATION_NAME || '').trim(),
  };
}

// Same-origin relay for met.no's public locationforecast/sunrise APIs. Unlike the RSS proxy,
// the upstream target is fixed and trusted (never a user-supplied URL), so this only needs to
// inject the required User-Agent header and the server-configured coordinates - no SSRF guard
// or DNS-pinning transport hop is needed.
async function handleRequest(r) {
  if (
    !authStore.resolveAuthenticatedPrincipal(r, { trustIngressHeaders: false }) &&
    !homeyStore.resolveHomeySession(r) &&
    !openhabStore.resolveOpenHABSession(r)
  ) {
    sendJson(r, 401, { error: 'Authentication required' });
    return;
  }

  const suffix = r.uri.slice(YR_PROXY_BASE_PATH.length) || '/';
  const config = readLocationConfig();

  if (suffix === '/status') {
    sendJson(r, 200, {
      configured: config !== null,
      locationName: config ? config.locationName || null : null,
    });
    return;
  }

  if (!config) {
    sendJson(r, 503, { error: 'Yr.no location is not configured' });
    return;
  }

  let targetUrl;
  if (suffix === '/compact') {
    targetUrl =
      MET_NO_BASE_URL +
      '/weatherapi/locationforecast/2.0/compact?lat=' +
      encodeURIComponent(config.latitude) +
      '&lon=' +
      encodeURIComponent(config.longitude);
  } else if (suffix === '/sunrise') {
    const date = r.args.date || '';
    if (!DATE_QUERY_PATTERN.test(date)) {
      sendJson(r, 400, { error: 'A valid date=YYYY-MM-DD query parameter is required' });
      return;
    }
    targetUrl =
      MET_NO_BASE_URL +
      '/weatherapi/sunrise/3.0/sun?lat=' +
      encodeURIComponent(config.latitude) +
      '&lon=' +
      encodeURIComponent(config.longitude) +
      '&date=' +
      encodeURIComponent(date);
  } else {
    sendJson(r, 404, { error: 'Unknown Yr.no proxy path' });
    return;
  }

  try {
    const response = await ngx.fetch(targetUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const body = await response.text();
    r.headersOut['Cache-Control'] = 'no-store';
    r.headersOut['Content-Type'] = response.headers.get('Content-Type') || 'application/json';
    r.return(response.status, body);
  } catch (error) {
    sendJson(r, 502, { error: 'Unable to load Yr.no data' });
  }
}

async function handle(r) {
  return handleRequest(r);
}

export default { handle: handle };
