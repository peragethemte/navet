import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getICloudSnapshot, resetICloudClientCache } from './icloud-client';
import type { ICloudSnapshot } from './icloud-types';

const SNAPSHOT: ICloudSnapshot = {
  configured: true,
  stale: false,
  fetchedAt: '2026-09-22T11:40:22+00:00',
  calendars: [{ entityId: 'calendar.familie', name: 'Familie', events: [] }],
};

const fetchMock = vi.fn();

function requestedPaths() {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  resetICloudClientCache();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => SNAPSHOT });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getICloudSnapshot', () => {
  it('asks the sidecar through the same-origin proxy', async () => {
    await getICloudSnapshot();

    expect(requestedPaths()).toEqual(['/__navet_icloud_proxy__/calendar/events']);
  });

  it('serves a cached snapshot instead of refetching', async () => {
    await getICloudSnapshot();
    const second = await getICloudSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(SNAPSHOT);
  });

  it('collapses parallel calls into one request', async () => {
    // The calendar hook asks for every calendar at once; each must not become its own request.
    const results = await Promise.all([
      getICloudSnapshot(),
      getICloudSnapshot(),
      getICloudSnapshot(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([SNAPSHOT, SNAPSHOT, SNAPSHOT]);
  });

  it('keeps the last snapshot when the proxy rejects the request', async () => {
    await getICloudSnapshot();
    resetTtl();
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    expect(await getICloudSnapshot()).toEqual(SNAPSHOT);
  });

  it('keeps the last snapshot when the request throws', async () => {
    await getICloudSnapshot();
    resetTtl();
    fetchMock.mockRejectedValue(new Error('network down'));

    expect(await getICloudSnapshot()).toEqual(SNAPSHOT);
  });

  it('returns null when there is nothing cached to fall back on', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    expect(await getICloudSnapshot()).toBeNull();
  });
});

/** Push time past the client's cache TTL without waiting for it. */
function resetTtl() {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60 * 1000);
}
