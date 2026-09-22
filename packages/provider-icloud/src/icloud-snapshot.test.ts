import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetICloudClientCache } from './icloud-client';
import {
  getICloudEntitySnapshots,
  getICloudProviderState,
  stopICloudPolling,
  subscribeICloudProviderState,
} from './icloud-snapshot';
import type { ICloudSnapshot } from './icloud-types';

const SNAPSHOT: ICloudSnapshot = {
  configured: true,
  stale: false,
  fetchedAt: '2026-09-22T12:50:49+00:00',
  calendars: [
    { entityId: 'calendar.familie', name: 'Familie', color: '#FF2968', events: [] },
    { entityId: 'calendar.jobb', name: 'Jobb', events: [] },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  resetICloudClientCache();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => SNAPSHOT });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  stopICloudPolling();
  vi.unstubAllGlobals();
});

async function hydrate() {
  subscribeICloudProviderState(() => {});
  await vi.waitFor(() => {
    expect(Object.keys(getICloudEntitySnapshots())).toHaveLength(2);
  });
}

describe('iCloud entity snapshots', () => {
  it('publishes one calendar-prefixed entity per calendar', async () => {
    await hydrate();

    // The `calendar.` prefix is the whole discovery mechanism on the app side.
    expect(Object.keys(getICloudEntitySnapshots())).toEqual(['calendar.familie', 'calendar.jobb']);
  });

  it('carries the calendar name and its colour as attributes', async () => {
    await hydrate();
    const snapshots = getICloudEntitySnapshots();

    expect(snapshots['calendar.familie'].attributes).toEqual({
      friendly_name: 'Familie',
      calendar_color: '#FF2968',
    });
    expect(snapshots['calendar.jobb'].attributes).toEqual({ friendly_name: 'Jobb' });
  });

  it('reports the provider as connected and hydrated', async () => {
    await hydrate();
    const state = getICloudProviderState();

    expect(state.providerId).toBe('icloud');
    expect(state.connected).toBe(true);
    expect(state.entitiesHydrated).toBe(true);
    expect(state.error).toBeNull();
    expect(state.entities.map((entity) => entity.type)).toEqual(['calendar', 'calendar']);
  });

  it('clears everything when no Apple ID is configured', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...SNAPSHOT, configured: false, calendars: [] }),
    });

    subscribeICloudProviderState(() => {});
    await vi.waitFor(() => {
      expect(getICloudProviderState().connected).toBe(false);
    });

    expect(getICloudEntitySnapshots()).toEqual({});
    expect(getICloudProviderState().error).toBeNull();
  });
});
