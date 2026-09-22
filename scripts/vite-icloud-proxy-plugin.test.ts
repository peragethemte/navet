import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { icloudProxyPlugin } from './vite-icloud-proxy-plugin.ts';

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const fetchMock = vi.fn();
const originalEnv = { ...process.env };

function createHandler(authenticated = true): Handler {
  let handler: Handler | undefined;
  const server = {
    middlewares: {
      use: (_base: string, middleware: Handler) => {
        handler = middleware;
      },
    },
  } as unknown as ViteDevServer;

  icloudProxyPlugin(() => authenticated).configureServer(server);
  if (!handler) {
    throw new Error('The plugin did not register a middleware');
  }
  return handler;
}

function createResponse() {
  const body: string[] = [];
  const response = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (chunk?: string) => {
      if (chunk) {
        body.push(chunk);
      }
    },
    get body() {
      return body.join('');
    },
  };
  return response as typeof response & ServerResponse;
}

async function call(path: string, options: { authenticated?: boolean } = {}) {
  const handler = createHandler(options.authenticated ?? true);
  const response = createResponse();
  await handler({ url: `/__navet_icloud_proxy__${path}` } as IncomingMessage, response);
  return response;
}

function upstreamUrl() {
  return String(fetchMock.mock.calls[0]?.[0] ?? '');
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    status: 200,
    text: async () => '{"configured":true,"calendars":[]}',
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe('icloudProxyPlugin', () => {
  it('refuses an unauthenticated caller without reaching the sidecar', async () => {
    const response = await call('/calendar/events', { authenticated: false });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'Authentication required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards an allowed path to the local sidecar', async () => {
    const response = await call('/calendar/events');

    expect(upstreamUrl()).toBe('http://127.0.0.1:8091/calendar/events');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('{"configured":true,"calendars":[]}');
  });

  it('keeps the query string when forwarding', async () => {
    await call('/calendar/events?days=7&calendar=calendar.familie');

    expect(upstreamUrl()).toBe(
      'http://127.0.0.1:8091/calendar/events?days=7&calendar=calendar.familie'
    );
  });

  it('honours a sidecar url from the environment', async () => {
    process.env.NAVET_ICLOUD_SIDECAR_URL = 'http://127.0.0.1:9000';

    await call('/healthz');

    expect(upstreamUrl()).toBe('http://127.0.0.1:9000/healthz');
  });

  it('rejects a path the sidecar does not serve', async () => {
    const response = await call('/calendar/../../etc/passwd');

    expect(response.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a sidecar that is not running', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await call('/calendar/events');

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body)).toEqual({ error: 'Unable to reach the iCloud sidecar' });
  });

  it('passes an upstream failure status through', async () => {
    fetchMock.mockResolvedValue({ status: 503, text: async () => '{"detail":"starting"}' });

    const response = await call('/calendar/events');

    expect(response.statusCode).toBe(503);
  });
});
