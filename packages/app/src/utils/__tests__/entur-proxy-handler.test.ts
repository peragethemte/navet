import enturProxy from '@docker/njs/entur-proxy.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authorization = vi.hoisted(() => ({ auth: vi.fn(), homey: vi.fn(), openhab: vi.fn() }));
vi.mock('@docker/njs/auth-store.js', () => ({
  default: { resolveAuthenticatedPrincipal: authorization.auth },
}));
vi.mock('@docker/njs/homey-store.js', () => ({
  default: { resolveHomeySession: authorization.homey },
}));
vi.mock('@docker/njs/openhab-store.js', () => ({
  default: { resolveOpenHABSession: authorization.openhab },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  authorization.auth.mockReturnValue({ userId: 'user' });
  fetchMock.mockResolvedValue({
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '{"data":{}}',
  });
  vi.stubGlobal('ngx', { fetch: fetchMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function request(
  uri: string,
  options: { args?: Record<string, string>; method?: string; body?: string } = {}
) {
  return {
    uri: `/__navet_entur_proxy__${uri}`,
    method: options.method ?? 'GET',
    args: options.args ?? {},
    requestText: options.body,
    headersOut: {} as Record<string, string>,
    return: vi.fn(),
  };
}

function upstreamCall() {
  return {
    url: String(fetchMock.mock.calls[0]?.[0] ?? ''),
    init: (fetchMock.mock.calls[0]?.[1] ?? {}) as {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    },
  };
}

function respondedStatus(req: ReturnType<typeof request>) {
  return Number(req.return.mock.calls[0]?.[0]);
}

describe('Docker Entur proxy', () => {
  it('rejects unauthenticated requests before reaching Entur', async () => {
    authorization.auth.mockReturnValue(null);
    const req = request('/geocoder', { args: { q: 'Greåker' } });

    await enturProxy.handle(req);

    expect(respondedStatus(req)).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a Homey session', async () => {
    authorization.auth.mockReturnValue(null);
    authorization.homey.mockReturnValue({ sessionId: 'homey' });
    const req = request('/geocoder', { args: { q: 'Greåker' } });

    await enturProxy.handle(req);

    expect(fetchMock).toHaveBeenCalled();
  });

  it('forwards a GraphQL document with the required client name', async () => {
    const body = JSON.stringify({ query: '{ trip { tripPatterns { duration } } }' });
    const req = request('/journey-planner', { method: 'POST', body });

    await enturProxy.handle(req);

    const { url, init } = upstreamCall();
    expect(url).toBe('https://api.entur.io/journey-planner/v3/graphql');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(body);
    expect(init.headers?.['ET-Client-Name']).toBe('pearlgroup-navet');
  });

  it('rejects a journey-planner request that is not a POST', async () => {
    const req = request('/journey-planner', { body: '{"query":"{}"}' });

    await enturProxy.handle(req);

    expect(respondedStatus(req)).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty body', undefined],
    ['a body that is not JSON', 'not json'],
    ['a body without a query', '{"variables":{}}'],
  ])('rejects %s', async (_label, body) => {
    const req = request('/journey-planner', { method: 'POST', body });

    await enturProxy.handle(req);

    expect(respondedStatus(req)).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches stop places only and caps the result count', async () => {
    const req = request('/geocoder', { args: { q: 'Greåker', limit: '99' } });

    await enturProxy.handle(req);

    const { url, init } = upstreamCall();
    const params = new URL(url).searchParams;
    expect(params.get('q')).toBe('Greåker');
    expect(params.get('layers')).toBe('stopPlace');
    expect(params.get('limit')).toBe('10');
    expect(init.headers?.['ET-Client-Name']).toBe('pearlgroup-navet');
  });

  it('accepts search text that arrives still percent-encoded', async () => {
    const req = request('/geocoder', { args: { q: 'Gre%C3%A5ker' } });

    await enturProxy.handle(req);

    expect(new URL(upstreamCall().url).searchParams.get('q')).toBe('Greåker');
  });

  it('passes a valid bounding box through', async () => {
    const req = request('/geocoder', { args: { q: 'skole', bbox: '10.61,58.78,11.61,59.78' } });

    await enturProxy.handle(req);

    expect(new URL(upstreamCall().url).searchParams.get('bbox')).toBe('10.61,58.78,11.61,59.78');
  });

  it.each([
    ['too few values', '10.61,58.78,11.61'],
    ['out of range', '10.61,158.78,11.61,59.78'],
    ['inverted', '11.61,58.78,10.61,59.78'],
  ])('rejects a bounding box that is %s', async (_label, bbox) => {
    const req = request('/geocoder', { args: { q: 'skole', bbox } });

    await enturProxy.handle(req);

    expect(respondedStatus(req)).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires search text', async () => {
    const req = request('/geocoder', { args: { q: '  ' } });

    await enturProxy.handle(req);

    expect(respondedStatus(req)).toBe(400);
  });

  it('reports an upstream failure as a bad gateway', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const req = request('/geocoder', { args: { q: 'Greåker' } });

    await enturProxy.handle(req);

    expect(respondedStatus(req)).toBe(502);
  });

  it('returns not found for an unknown path', async () => {
    const req = request('/vehicles');

    await enturProxy.handle(req);

    expect(respondedStatus(req)).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
