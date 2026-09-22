import type { YrLocationforecastResponse, YrProxyStatus, YrSunriseResponse } from './yr-types';

const PROXY_BASE_PATH = '/__navet_yr_proxy__';
// met.no publishes new locationforecast data roughly hourly; polling well below that cadence
// keeps the dashboard fresh without hammering a free public API.
const FORECAST_CACHE_TTL_MS = 30 * 60 * 1000;
const STATUS_CACHE_TTL_MS = 30 * 60 * 1000;
// Sunrise/sunset barely drifts within a day; one lookup per local date is plenty.
const SUN_TIMES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

let statusCache: CacheEntry<YrProxyStatus> | null = null;
let forecastCache: CacheEntry<YrLocationforecastResponse> | null = null;
let sunTimesCache:
  | (CacheEntry<{ sunrise: string | null; sunset: string | null }> & { key: string })
  | null = null;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${PROXY_BASE_PATH}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function isFresh(fetchedAt: number, ttlMs: number): boolean {
  return Date.now() - fetchedAt < ttlMs;
}

/**
 * Returns null when the status could not be determined right now (e.g. a request that raced
 * app authentication) rather than caching that as "not configured" - callers should treat null
 * as "unknown, try again soon" instead of a real signal from the server.
 */
export async function getYrStatus(): Promise<YrProxyStatus | null> {
  if (statusCache && isFresh(statusCache.fetchedAt, STATUS_CACHE_TTL_MS)) {
    return statusCache.value;
  }

  const status = await fetchJson<YrProxyStatus>('/status');
  if (!status) {
    return null;
  }

  statusCache = { value: status, fetchedAt: Date.now() };
  return status;
}

export async function getYrForecast(): Promise<YrLocationforecastResponse | null> {
  if (forecastCache && isFresh(forecastCache.fetchedAt, FORECAST_CACHE_TTL_MS)) {
    return forecastCache.value;
  }

  const forecast = await fetchJson<YrLocationforecastResponse>('/compact');
  if (!forecast) {
    // Serve the last known-good forecast through a transient proxy/network failure.
    return forecastCache?.value ?? null;
  }

  forecastCache = { value: forecast, fetchedAt: Date.now() };
  return forecast;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export async function getYrSunTimes(
  date: Date
): Promise<{ sunrise: string | null; sunset: string | null }> {
  const key = localDateKey(date);
  if (sunTimesCache?.key === key && isFresh(sunTimesCache.fetchedAt, SUN_TIMES_CACHE_TTL_MS)) {
    return sunTimesCache.value;
  }

  const response = await fetchJson<YrSunriseResponse>(`/sunrise?date=${key}`);
  if (!response) {
    // Do not cache a transient failure; keep serving the previous day's value (if any) so a
    // single failed request does not blank out sunrise/sunset for hours.
    return sunTimesCache?.value ?? { sunrise: null, sunset: null };
  }

  const value = {
    sunrise: response.properties?.sunrise?.time ?? null,
    sunset: response.properties?.sunset?.time ?? null,
  };
  sunTimesCache = { key, value, fetchedAt: Date.now() };
  return value;
}
