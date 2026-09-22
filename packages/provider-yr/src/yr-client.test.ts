import type { GeoLocation } from '@navet/core/geo-location';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getYrForecast, getYrSunTimes, resetYrClientCaches } from './yr-client';

const SARPSBORG: GeoLocation = { latitude: 59.2839, longitude: 11.1094, name: 'Sarpsborg' };
const BERGEN: GeoLocation = { latitude: 60.3913, longitude: 5.3221, name: 'Bergen' };

const fetchMock = vi.fn();

function requestedPaths() {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  resetYrClientCaches();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ properties: { timeseries: [] } }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getYrForecast', () => {
  it('lets the server pick the location when none is configured', async () => {
    await getYrForecast(null);

    expect(requestedPaths()).toEqual(['/__navet_yr_proxy__/compact']);
  });

  it('sends the configured coordinates', async () => {
    await getYrForecast(SARPSBORG);

    expect(requestedPaths()).toEqual(['/__navet_yr_proxy__/compact?lat=59.2839&lon=11.1094']);
  });

  it('serves the cached forecast for the same coordinates', async () => {
    await getYrForecast(SARPSBORG);
    await getYrForecast(SARPSBORG);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when only the display name changes', async () => {
    await getYrForecast(SARPSBORG);
    await getYrForecast({ ...SARPSBORG, name: 'Home' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches immediately when the coordinates change', async () => {
    await getYrForecast(SARPSBORG);
    await getYrForecast(BERGEN);

    expect(requestedPaths()).toEqual([
      '/__navet_yr_proxy__/compact?lat=59.2839&lon=11.1094',
      '/__navet_yr_proxy__/compact?lat=60.3913&lon=5.3221',
    ]);
  });

  it('keeps serving the last good forecast for the same place through a failure', async () => {
    const forecast = await getYrForecast(SARPSBORG);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    await expect(getYrForecast(SARPSBORG)).resolves.toBe(forecast);
  });

  it('never serves another place’s forecast through a failure', async () => {
    await getYrForecast(SARPSBORG);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    await expect(getYrForecast(BERGEN)).resolves.toBeNull();
  });
});

describe('getYrSunTimes', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          sunrise: { time: '2026-09-22T05:00:00Z' },
          sunset: { time: '2026-09-22T17:00:00Z' },
        },
      }),
    });
  });

  it('asks for the local date and the configured coordinates', async () => {
    await getYrSunTimes(new Date(2026, 8, 22), SARPSBORG);

    expect(requestedPaths()).toEqual([
      '/__navet_yr_proxy__/sunrise?date=2026-09-22&lat=59.2839&lon=11.1094',
    ]);
  });

  it('caches per date and location', async () => {
    const date = new Date(2026, 8, 22);
    await getYrSunTimes(date, SARPSBORG);
    await getYrSunTimes(date, SARPSBORG);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getYrSunTimes(date, BERGEN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('omits coordinates when the server owns the location', async () => {
    await getYrSunTimes(new Date(2026, 8, 22), null);

    expect(requestedPaths()).toEqual(['/__navet_yr_proxy__/sunrise?date=2026-09-22']);
  });
});
