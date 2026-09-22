import type { GeoLocation } from '@navet/core/geo-location';

/**
 * The user-configured weather location lives in the app's settings store. The provider package
 * must not reach into app state, so the app supplies this read-and-subscribe seam instead - the
 * same shape as the `getSession` accessors the other provider packages receive.
 */
export interface YrLocationSource {
  getLocation: () => GeoLocation | null;
  subscribe: (listener: () => void) => () => void;
}

let locationSource: YrLocationSource | null = null;

export function setYrLocationSource(source: YrLocationSource | null): void {
  locationSource = source;
}

export function getConfiguredYrLocation(): GeoLocation | null {
  return locationSource?.getLocation() ?? null;
}

export function subscribeYrLocation(listener: () => void): () => void {
  return locationSource?.subscribe(listener) ?? (() => {});
}
