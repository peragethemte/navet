import { type GeoLocation, geoCoordinatesKey } from '@navet/core/geo-location';
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

interface KeyedCacheEntry<T> extends CacheEntry<T> {
  key: string;
}

let statusCache: CacheEntry<YrProxyStatus> | null = null;
let forecastCache: KeyedCacheEntry<YrLocationforecastResponse> | null = null;
let sunTimesCache: KeyedCacheEntry<{ sunrise: string | null; sunset: string | null }> | null = null;

/**
 * Coordinates travel to the proxy as query parameters; omitting them asks the server to use its
 * `NAVET_YR_*` environment defaults, which keeps existing deployments working untouched.
 */
function locationParams(location: GeoLocation | null): string {
  if (!location) {
    return '';
  }

  return `lat=${encodeURIComponent(location.latitude)}&lon=${encodeURIComponent(location.longitude)}`;
}

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

export async function getYrForecast(
  location: GeoLocation | null
): Promise<YrLocationforecastResponse | null> {
  const key = geoCoordinatesKey(location);
  const cached = forecastCache?.key === key ? forecastCache : null;
  if (cached && isFresh(cached.fetchedAt, FORECAST_CACHE_TTL_MS)) {
    return cached.value;
  }

  const params = locationParams(location);
  const forecast = await fetchJson<YrLocationforecastResponse>(
    params ? `/compact?${params}` : '/compact'
  );
  if (!forecast) {
    // Serve the last known-good forecast through a transient proxy/network failure, but only
    // when it belongs to the location being asked for.
    return cached?.value ?? null;
  }

  forecastCache = { key, value: forecast, fetchedAt: Date.now() };
  return forecast;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export async function getYrSunTimes(
  date: Date,
  location: GeoLocation | null
): Promise<{ sunrise: string | null; sunset: string | null }> {
  const dateKey = localDateKey(date);
  const key = `${dateKey}|${geoCoordinatesKey(location)}`;
  const cached = sunTimesCache?.key === key ? sunTimesCache : null;
  if (cached && isFresh(cached.fetchedAt, SUN_TIMES_CACHE_TTL_MS)) {
    return cached.value;
  }

  const params = locationParams(location);
  const response = await fetchJson<YrSunriseResponse>(
    `/sunrise?date=${dateKey}${params ? `&${params}` : ''}`
  );
  if (!response) {
    // Do not cache a transient failure; keep serving the previous value for this location (if
    // any) so a single failed request does not blank out sunrise/sunset for hours.
    return cached?.value ?? { sunrise: null, sunset: null };
  }

  const value = {
    sunrise: response.properties?.sunrise?.time ?? null,
    sunset: response.properties?.sunset?.time ?? null,
  };
  sunTimesCache = { key, value, fetchedAt: Date.now() };
  return value;
}

/** Test seam: drops every cached response so a suite can start from a known state. */
export function resetYrClientCaches(): void {
  statusCache = null;
  forecastCache = null;
  sunTimesCache = null;
}
