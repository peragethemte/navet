import authStore from './auth-store.js';
import homeyStore from './homey-store.js';
import openhabStore from './openhab-store.js';

const ICLOUD_PROXY_BASE_PATH = '/__navet_icloud_proxy__';
const ICLOUD_BACKEND_PATH = '/__navet_icloud_backend__';
// The sidecar is local and read-only, but an allowlist keeps the public surface exactly the
// three endpoints the dashboard uses rather than everything the process happens to serve.
const ALLOWED_PATHS = ['/healthz', '/calendar/calendars', '/calendar/events'];

function sendJson(r, statusCode, payload) {
  r.headersOut['Cache-Control'] = 'no-store';
  r.headersOut['Content-Type'] = 'application/json; charset=utf-8';
  r.return(statusCode, JSON.stringify(payload));
}

function resolveRequestPath(r) {
  const uri = r.uri || '';
  if (uri.indexOf(ICLOUD_PROXY_BASE_PATH) !== 0) {
    return null;
  }

  const path = uri.slice(ICLOUD_PROXY_BASE_PATH.length) || '/';
  return ALLOWED_PATHS.indexOf(path) === -1 ? null : path;
}

async function handle(r) {
  if (!authStore.resolveAuthenticatedPrincipal(r, { trustIngressHeaders: false }) &&
      !homeyStore.resolveHomeySession(r) && !openhabStore.resolveOpenHABSession(r)) {
    sendJson(r, 401, { error: 'Authentication required' });
    return;
  }

  if (r.method !== 'GET') {
    sendJson(r, 405, { error: 'Method not allowed' });
    return;
  }

  const path = resolveRequestPath(r);
  if (!path) {
    sendJson(r, 404, { error: 'Not found' });
    return;
  }

  try {
    // Unlike the Yr proxy this never reaches the internet: the sidecar owns the iCloud session,
    // so the request only has to cross a local socket. Request headers, including the caller's
    // cookies, are stripped by the internal location.
    const response = await r.subrequest(ICLOUD_BACKEND_PATH + path, {
      method: 'GET',
      args: r.variables.args || '',
    });

    if (response.status >= 500) {
      sendJson(r, 502, { error: 'Unable to reach the iCloud sidecar' });
      return;
    }

    r.headersOut['Cache-Control'] = 'no-store';
    r.headersOut['X-Content-Type-Options'] = 'nosniff';
    r.headersOut['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    r.headersOut['Content-Type'] = 'application/json; charset=utf-8';
    r.return(response.status, response.responseText);
  } catch (error) {
    sendJson(r, 502, { error: 'Unable to reach the iCloud sidecar' });
  }
}

export default { handle: handle };
