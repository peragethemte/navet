import icloudProxy from '@docker/njs/icloud-proxy.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const subrequest = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  authorization.auth.mockReturnValue({ userId: 'user' });
  subrequest.mockResolvedValue({ status: 200, responseText: '{"configured":true}' });
});

function request(uri: string, args = '', method = 'GET') {
  return {
    uri: `/__navet_icloud_proxy__${uri}`,
    method,
    variables: { args },
    headersOut: {} as Record<string, string>,
    subrequest,
    return: vi.fn(),
  };
}

function backendUri() {
  return String(subrequest.mock.calls[0]?.[0] ?? '');
}

function respondedJson(req: ReturnType<typeof request>) {
  return JSON.parse(String(req.return.mock.calls[0]?.[1] ?? '{}'));
}

describe('Docker iCloud proxy', () => {
  it('rejects unauthenticated requests before reaching the sidecar', async () => {
    authorization.auth.mockReturnValue(null);
    const req = request('/calendar/events');

    await icloudProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(401, expect.any(String));
    expect(respondedJson(req)).toEqual({ error: 'Authentication required' });
    expect(subrequest).not.toHaveBeenCalled();
  });

  it('accepts a Homey session as well as an installation principal', async () => {
    authorization.auth.mockReturnValue(null);
    authorization.homey.mockReturnValue({ sessionId: 'homey' });
    const req = request('/calendar/events');

    await icloudProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(200, '{"configured":true}');
  });

  it('forwards an allowed path to the internal backend location', async () => {
    const req = request('/calendar/events', 'days=7');

    await icloudProxy.handle(req);

    expect(backendUri()).toBe('/__navet_icloud_backend__/calendar/events');
    expect(subrequest.mock.calls[0]?.[1]).toEqual({ method: 'GET', args: 'days=7' });
    expect(req.return).toHaveBeenCalledWith(200, '{"configured":true}');
  });

  it('serves the health endpoint', async () => {
    const req = request('/healthz');

    await icloudProxy.handle(req);

    expect(backendUri()).toBe('/__navet_icloud_backend__/healthz');
  });

  it('refuses a path outside the allowlist', async () => {
    const req = request('/docs');

    await icloudProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(404, expect.any(String));
    expect(subrequest).not.toHaveBeenCalled();
  });

  it('refuses a write method', async () => {
    const req = request('/calendar/events', '', 'POST');

    await icloudProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(405, expect.any(String));
    expect(subrequest).not.toHaveBeenCalled();
  });

  it('reports a sidecar that is not answering', async () => {
    subrequest.mockResolvedValue({ status: 502, responseText: '' });
    const req = request('/calendar/events');

    await icloudProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(502, expect.any(String));
    expect(respondedJson(req)).toEqual({ error: 'Unable to reach the iCloud sidecar' });
  });

  it('reports a subrequest that throws', async () => {
    subrequest.mockRejectedValue(new Error('socket closed'));
    const req = request('/calendar/events');

    await icloudProxy.handle(req);

    expect(req.return).toHaveBeenCalledWith(502, expect.any(String));
  });
});
