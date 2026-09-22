import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enturProxyPlugin } from './vite-entur-proxy-plugin.ts';

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const fetchMock = vi.fn();

function createHandler(authenticated = true): Handler {
  let handler: Handler | undefined;
  const server = {
    middlewares: {
      use: (_base: string, middleware: Handler) => {
        handler = middleware;
      },
    },
  } as unknown as ViteDevServer;

  enturProxyPlugin(() => authenticated).configureServer(server);
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

function createRequest(path: string, options: { method?: string; body?: string } = {}) {
  const request = Readable.from(
    options.body === undefined ? [] : [Buffer.from(options.body)]
  ) as unknown as IncomingMessage;
  request.url = `/__navet_entur_proxy__${path}`;
  request.method = options.method ?? 'GET';
  return request;
}

async function call(
  path: string,
  options: { method?: string; body?: string; authenticated?: boolean } = {}
) {
  const handler = createHandler(options.authenticated ?? true);
  const response = createResponse();
  await handler(createRequest(path, options), response);
  return response;
}

function upstreamCall() {
  return {
    url: String(fetchMock.mock.calls[0]?.[0] ?? ''),
    init: (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit & {
      headers?: Record<string, string>;
    },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '{"data":{}}',
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authentication', () => {
  it('refuses an unauthenticated caller', async () => {
    const response = await call('/geocoder?q=Greaker', { authenticated: false });
    expect(response.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('journey planner', () => {
  const body = JSON.stringify({ query: '{ trip { tripPatterns { duration } } }', variables: {} });

  it('forwards the GraphQL body with the client name header', async () => {
    const response = await call('/journey-planner', { method: 'POST', body });

    expect(response.statusCode).toBe(200);
    const { url, init } = upstreamCall();
    expect(url).toBe('https://api.entur.io/journey-planner/v3/graphql');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(body);
    expect(init.headers?.['ET-Client-Name']).toBe('pearlgroup-navet');
  });

  it('rejects a request without a GraphQL document', async () => {
    const response = await call('/journey-planner', {
      method: 'POST',
      body: JSON.stringify({ variables: {} }),
    });
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const response = await call('/journey-planner', { method: 'POST', body: 'not json' });
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized body', async () => {
    const response = await call('/journey-planner', {
      method: 'POST',
      body: JSON.stringify({ query: 'x'.repeat(9000) }),
    });
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a GET', async () => {
    const response = await call('/journey-planner');
    expect(response.statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an upstream failure as a bad gateway', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const response = await call('/journey-planner', { method: 'POST', body });
    expect(response.statusCode).toBe(502);
  });
});

describe('geocoder', () => {
  it('searches stop places only and caps the result count', async () => {
    await call('/geocoder?q=Gre%C3%A5ker&limit=99');

    const { url, init } = upstreamCall();
    const params = new URL(url).searchParams;
    expect(url.startsWith('https://api.entur.io/geocoder/v3/autocomplete')).toBe(true);
    expect(params.get('q')).toBe('Greåker');
    expect(params.get('layers')).toBe('stopPlace');
    expect(params.get('limit')).toBe('10');
    expect(init.headers?.['ET-Client-Name']).toBe('pearlgroup-navet');
  });

  it('passes a valid bounding box through', async () => {
    await call('/geocoder?q=skole&bbox=10.61,58.78,11.61,59.78');
    expect(new URL(upstreamCall().url).searchParams.get('bbox')).toBe('10.61,58.78,11.61,59.78');
  });

  it.each([
    ['too few values', '10.61,58.78,11.61'],
    ['out of range', '10.61,158.78,11.61,59.78'],
    ['inverted', '11.61,58.78,10.61,59.78'],
    ['not numeric', 'a,b,c,d'],
  ])('rejects a bounding box that is %s', async (_label, bbox) => {
    const response = await call(`/geocoder?q=skole&bbox=${encodeURIComponent(bbox)}`);
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires search text', async () => {
    const response = await call('/geocoder?q=%20%20');
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an absurdly long search', async () => {
    const response = await call(`/geocoder?q=${'x'.repeat(200)}`);
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('unknown paths', () => {
  it('returns not found', async () => {
    const response = await call('/vehicles');
    expect(response.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
