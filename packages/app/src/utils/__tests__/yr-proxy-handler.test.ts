import yrProxy from '@docker/njs/yr-proxy.js';
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
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetAllMocks();
  authorization.auth.mockReturnValue({ userId: 'user' });
  fetchMock.mockResolvedValue({
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '{"properties":{}}',
  });
  vi.stubGlobal('ngx', { fetch: fetchMock });
  process.env.NAVET_YR_LATITUDE = '59.3';
  process.env.NAVET_YR_LONGITUDE = '11.1';
  process.env.NAVET_YR_LOCATION_NAME = 'Sarpsborg';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

function request(uri: string, args: Record<string, string> = {}) {
  return { uri: `/__navet_yr_proxy__${uri}`, args, headersOut: {}, return: vi.fn() };
}

function upstreamUrl() {
  return String(fetchMock.mock.calls[0]?.[0] ?? '');
}

function respondedJson(req: ReturnType<typeof request>) {
  return JSON.parse(String(req.return.mock.calls[0]?.[1] ?? '{}'));
}

describe('Docker Yr.no proxy', () => {
  it('rejects unauthenticated requests before reaching met.no', async () => {
    authorization.auth.mockReturnValue(null);
    const req = request('/compact');

    await yrProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(401, expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the server-configured location through /status', async () => {
    const req = request('/status');

    await yrProxy.handle(req);

    expect(respondedJson(req)).toEqual({ configured: true, locationName: 'Sarpsborg' });
  });

  it('forwards the environment defaults when the client sends no coordinates', async () => {
    await yrProxy.handle(request('/compact'));

    expect(upstreamUrl()).toContain('lat=59.3&lon=11.1');
  });

  it('prefers coordinates supplied by the dashboard', async () => {
    await yrProxy.handle(request('/compact', { lat: '60.39', lon: '5.32' }));

    expect(upstreamUrl()).toContain('lat=60.39&lon=5.32');
  });

  it.each([
    { lat: '95', lon: '5.32' },
    { lat: '60.39', lon: '181' },
    { lat: 'Bergen', lon: '5.32' },
    { lat: '60.39', lon: '' },
    { lat: '60.39' },
  ])('rejects out-of-range or malformed coordinates %j', async (args) => {
    const req = request('/compact', args as Record<string, string>);

    await yrProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(400, expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503 when neither the client nor the server has a location', async () => {
    process.env.NAVET_YR_LATITUDE = '';
    process.env.NAVET_YR_LONGITUDE = '';
    const req = request('/compact');

    await yrProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(503, expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still serves dashboard coordinates when the server has no defaults', async () => {
    process.env.NAVET_YR_LATITUDE = '';
    process.env.NAVET_YR_LONGITUDE = '';

    await yrProxy.handle(request('/compact', { lat: '60.39', lon: '5.32' }));

    expect(upstreamUrl()).toContain('lat=60.39&lon=5.32');
  });

  it('passes the requested date and coordinates to the sunrise endpoint', async () => {
    await yrProxy.handle(request('/sunrise', { date: '2026-09-22', lat: '60.39', lon: '5.32' }));

    expect(upstreamUrl()).toContain(
      '/weatherapi/sunrise/3.0/sun?lat=60.39&lon=5.32&date=2026-09-22'
    );
  });

  it('requires a well-formed sunrise date', async () => {
    const req = request('/sunrise', { date: '22.09.2026' });

    await yrProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(400, expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
