import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { yrProxyPlugin } from './vite-yr-proxy-plugin.ts';

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

  yrProxyPlugin(() => authenticated).configureServer(server);
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
  await handler({ url: `/__navet_yr_proxy__${path}` } as IncomingMessage, response);
  return response;
}

function upstreamUrl() {
  return String(fetchMock.mock.calls[0]?.[0] ?? '');
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '{"properties":{}}',
  });
  vi.stubGlobal('fetch', fetchMock);
  process.env.NAVET_YR_LATITUDE = '59.3';
  process.env.NAVET_YR_LONGITUDE = '11.1';
  process.env.NAVET_YR_LOCATION_NAME = 'Sarpsborg';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe('dev Yr.no proxy', () => {
  it('rejects unauthenticated requests before reaching met.no', async () => {
    const response = await call('/compact', { authenticated: false });

    expect(response.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the server-configured location through /status', async () => {
    const response = await call('/status');

    expect(JSON.parse(response.body)).toEqual({ configured: true, locationName: 'Sarpsborg' });
  });

  it('forwards the environment defaults when the client sends no coordinates', async () => {
    await call('/compact');

    expect(upstreamUrl()).toContain('lat=59.3&lon=11.1');
  });

  it('prefers coordinates supplied by the dashboard', async () => {
    await call('/compact?lat=60.39&lon=5.32');

    expect(upstreamUrl()).toContain('lat=60.39&lon=5.32');
  });

  it.each(['lat=95&lon=5.32', 'lat=60.39&lon=181', 'lat=Bergen&lon=5.32', 'lat=60.39'])(
    'rejects out-of-range or malformed coordinates (%s)',
    async (query) => {
      const response = await call(`/compact?${query}`);

      expect(response.statusCode).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('answers 503 when neither the client nor the server has a location', async () => {
    process.env.NAVET_YR_LATITUDE = '';
    process.env.NAVET_YR_LONGITUDE = '';

    const response = await call('/compact');

    expect(response.statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the requested date and coordinates to the sunrise endpoint', async () => {
    await call('/sunrise?date=2026-09-22&lat=60.39&lon=5.32');

    const url = upstreamUrl();
    expect(url).toContain('/weatherapi/sunrise/3.0/sun');
    expect(url).toContain('date=2026-09-22');
    expect(url).toContain('lat=60.39');
    expect(url).toContain('lon=5.32');
  });

  it('requires a well-formed sunrise date', async () => {
    const response = await call('/sunrise?date=22.09.2026');

    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
