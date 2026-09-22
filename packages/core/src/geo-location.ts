/**
 * Provider-neutral geographic coordinates for features that need a place rather than a device:
 * weather forecasts today, public-transport departures next.
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  /** Display label for the place. May be empty when the user has not named it. */
  name: string;
}

export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;
export const GEO_LOCATION_NAME_MAX_LENGTH = 60;

// met.no asks callers to truncate coordinates so their cache stays effective, and four decimals
// is roughly 11 m - far more precision than a household weather forecast needs.
const COORDINATE_DECIMALS = 4;

export function isValidLatitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= LATITUDE_MIN &&
    value <= LATITUDE_MAX
  );
}

export function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= LONGITUDE_MIN &&
    value <= LONGITUDE_MAX
  );
}

export function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

/**
 * Parses free-typed coordinate input. Accepts a comma decimal separator because Norwegian and
 * most other supported locales type `59,28` rather than `59.28`.
 */
export function parseCoordinate(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCoordinate(value: number): string {
  return String(roundCoordinate(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Returns a sanitized location, or null when the coordinates are missing or out of range.
 * Persisted values, imported dashboards, and typed input all pass through this.
 */
export function normalizeGeoLocation(value: unknown): GeoLocation | null {
  if (!isRecord(value)) {
    return null;
  }

  const { latitude, longitude, name } = value;
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
    name: typeof name === 'string' ? name.trim().slice(0, GEO_LOCATION_NAME_MAX_LENGTH) : '',
  };
}

export function isSameGeoLocation(left: GeoLocation | null, right: GeoLocation | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return (
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.name === right.name
  );
}

/** Stable cache key for the coordinates alone: renaming a place must not refetch its forecast. */
export function geoCoordinatesKey(location: GeoLocation | null): string {
  return location ? `${location.latitude},${location.longitude}` : 'default';
}
