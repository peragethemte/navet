import type { GeoLocation } from '@navet/core/geo-location';
import type { TransitJourney } from '@navet/core/transit-journey';
import {
  buildGeocoderQuery,
  buildSearchBoundingBox,
  type EnturGeocoderResponse,
  mapGeocoderResponse,
  type TransitPlaceSuggestion,
} from './entur-geocoder';
import {
  buildTripVariables,
  ENTUR_TRIP_QUERY,
  type EnturTripResponse,
  mapTripResponse,
  type TransitDeparture,
} from './entur-trip';

const PROXY_BASE_PATH = '/__navet_entur_proxy__';
/** Live predictions update every few seconds upstream, but a wall panel reads fine at this age. */
const DEPARTURE_CACHE_TTL_MS = 30 * 1000;

export class TransitRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = 'TransitRequestError';
  }
}

interface CacheEntry {
  departures: TransitDeparture[];
  fetchedAt: number;
}

const departureCache = new Map<string, CacheEntry>();

/** Exported for tests; the cache is module state shared by every card on the dashboard. */
export function clearTransitCache(): void {
  departureCache.clear();
}

export async function searchTransitPlaces(
  text: string,
  options: { location?: GeoLocation | null; signal?: AbortSignal } = {}
): Promise<TransitPlaceSuggestion[]> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const query = buildGeocoderQuery(trimmed, {
    boundingBox: options.location ? buildSearchBoundingBox(options.location) : null,
  });

  const response = await fetch(`${PROXY_BASE_PATH}/geocoder?${query}`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new TransitRequestError('Stop search failed', response.status);
  }

  return mapGeocoderResponse((await response.json()) as EnturGeocoderResponse);
}

export async function planJourney(
  journey: TransitJourney,
  searchTime: Date,
  alternatives: number,
  options: { signal?: AbortSignal } = {}
): Promise<TransitDeparture[]> {
  const variables = buildTripVariables(journey, searchTime, alternatives);
  // The same stop pair and minute answers differently per direction, so the mode belongs in the key.
  const cacheKey = `${journey.from.id}>${journey.to.id}@${variables.dateTime}:${variables.arriveBy}:${alternatives}`;
  const cached = departureCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < DEPARTURE_CACHE_TTL_MS) {
    return cached.departures;
  }

  const response = await fetch(`${PROXY_BASE_PATH}/journey-planner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ENTUR_TRIP_QUERY, variables }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new TransitRequestError('Journey planning failed', response.status);
  }

  const payload = (await response.json()) as EnturTripResponse;
  if (payload.errors && payload.errors.length > 0) {
    throw new TransitRequestError(payload.errors[0]?.message ?? 'Journey planning failed', null);
  }

  const departures = mapTripResponse(payload);
  departureCache.set(cacheKey, { departures, fetchedAt: Date.now() });
  return departures;
}
