import type { GeoLocation } from '@navet/core/geo-location';
import type { TransitPlace } from '@navet/core/transit-journey';

/**
 * Stop search against Entur's geocoder.
 *
 * v3 is the only supported version; v1 and v2 were deprecated on 2026-06-12 and renamed every
 * parameter. The picked stop's name is stored alongside its id so rendering a configured journey
 * needs no lookup.
 */
export const ENTUR_GEOCODER_RESULT_LIMIT = 6;
export const ENTUR_GEOCODER_SEARCH_RADIUS_KM = 50;

const KM_PER_LATITUDE_DEGREE = 111;

/**
 * A square-ish box around the household, as `minLon,minLat,maxLon,maxLat`.
 *
 * `bbox` is the geocoder's only hard boundary. The lat/lon focus point is a weak bias that does not
 * work for this: searching "skole" centred on Sarpsborg still ranks Kongsberg and Asker above every
 * local stop, and `radius` does not change that.
 */
export function buildSearchBoundingBox(
  location: GeoLocation,
  radiusKm = ENTUR_GEOCODER_SEARCH_RADIUS_KM
): string {
  const latitudeDelta = radiusKm / KM_PER_LATITUDE_DEGREE;
  // Meridians converge towards the poles, so a fixed longitude delta would be a tall thin box in
  // Norway. Clamped because the scale diverges at the pole.
  const longitudeScale = Math.max(Math.cos((location.latitude * Math.PI) / 180), 0.05);
  const longitudeDelta = latitudeDelta / longitudeScale;

  const round = (value: number) => Number(value.toFixed(4));
  return [
    round(location.longitude - longitudeDelta),
    round(location.latitude - latitudeDelta),
    round(location.longitude + longitudeDelta),
    round(location.latitude + latitudeDelta),
  ].join(',');
}

export interface EnturGeocoderOptions {
  /** Restricts results to a box around the household. Search is nationwide without it. */
  boundingBox?: string | null;
  limit?: number;
}

export function buildGeocoderQuery(text: string, options: EnturGeocoderOptions = {}): string {
  const params = new URLSearchParams({
    q: text.trim(),
    limit: String(options.limit ?? ENTUR_GEOCODER_RESULT_LIMIT),
    layers: 'stopPlace',
  });

  if (options.boundingBox) {
    params.set('bbox', options.boundingBox);
  }

  return params.toString();
}

export interface TransitPlaceSuggestion extends TransitPlace {
  /** Municipality and county, for telling identically named stops apart. */
  locality: string | null;
  modes: string[];
}

interface RawFeature {
  properties?: {
    id?: string | null;
    names?: { default?: string | null; display?: string | null } | null;
    address?: { locality?: string | null; county?: string | null } | null;
    transportModes?: ({ mode?: string | null } | null)[] | null;
  } | null;
}

export interface EnturGeocoderResponse {
  features?: (RawFeature | null)[] | null;
}

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapGeocoderResponse(response: EnturGeocoderResponse): TransitPlaceSuggestion[] {
  const features = response.features ?? [];
  const suggestions: TransitPlaceSuggestion[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const properties = feature?.properties;
    const id = trimToNull(properties?.id);
    const name = trimToNull(properties?.names?.display) ?? trimToNull(properties?.names?.default);
    if (!id || !name || seen.has(id)) {
      continue;
    }

    seen.add(id);
    suggestions.push({
      id,
      name,
      locality: trimToNull(properties?.address?.locality),
      modes: (properties?.transportModes ?? [])
        .map((entry) => trimToNull(entry?.mode))
        .filter((mode): mode is string => mode !== null),
    });
  }

  return suggestions;
}
