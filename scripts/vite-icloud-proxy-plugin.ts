import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PreviewServer, ViteDevServer } from 'vite';
import { normalizeViteProxyTargetPath } from './vite-proxy-path.ts';
import { setSecurityHeaders } from './vite-response-security.ts';

const PROXY_BASE_PATH = '/__navet_icloud_proxy__';
const DEFAULT_SIDECAR_URL = 'http://127.0.0.1:8091';
const ALLOWED_PATHS = new Set(['/healthz', '/calendar/calendars', '/calendar/events']);

/**
 * Same-origin relay to the local iCloud sidecar.
 *
 * Unlike the Yr proxy this carries no logic of its own: every iCloud concern lives in the Python
 * process, so the dev plugin and the production njs module are both plain forwarders and cannot
 * drift apart. The sidecar itself is started separately with `docker/integrations-sidecar/run-dev.sh`.
 */
export function icloudProxyPlugin(
  isAuthenticated: (req: IncomingMessage, res: ServerResponse) => boolean
) {
  const sidecarUrl = process.env.NAVET_ICLOUD_SIDECAR_URL?.trim() || DEFAULT_SIDECAR_URL;

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

    if (!ALLOWED_PATHS.has(pathname)) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    try {
      const upstreamResponse = await fetch(`${sidecarUrl}${targetPath}`, {
        headers: { Accept: 'application/json' },
      });
      const body = await upstreamResponse.text();

      res.statusCode = upstreamResponse.status;
      setSecurityHeaders(res);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(body);
    } catch {
      sendJson(res, 502, { error: 'Unable to reach the iCloud sidecar' });
    }
  };

  return {
    name: 'navet-icloud-proxy',
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
