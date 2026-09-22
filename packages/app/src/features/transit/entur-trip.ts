import type { TransitJourney } from '@navet/core/transit-journey';

/**
 * Trip planning against Entur's JourneyPlanner v3 GraphQL API.
 *
 * Two details in this file are load-bearing and fail silently if changed:
 *
 * - `modes` has no schema-level defaults. The resolver only applies foot access and egress when the
 *   argument is omitted entirely, so a partial object nulls them and the planner refuses to walk to
 *   or from the stop. Spelling out both is equivalent to the default and additionally removes the
 *   walk-only itinerary between close stops.
 * - `arriveBy: true` returns patterns latest-arrival first. The board sorts by departure.
 */
export const ENTUR_TRIP_QUERY = `query NavetTransitTrip(
  $from: Location!
  $to: Location!
  $dateTime: DateTime!
  $numTripPatterns: Int!
) {
  trip(
    from: $from
    to: $to
    dateTime: $dateTime
    arriveBy: true
    numTripPatterns: $numTripPatterns
    modes: { accessMode: foot, egressMode: foot, directMode: null }
  ) {
    tripPatterns {
      expectedStartTime
      expectedEndTime
      duration
      walkDistance
      legs {
        mode
        line {
          publicCode
        }
        fromPlace {
          quay {
            publicCode
          }
        }
        fromEstimatedCall {
          realtime
          realtimeState
          cancellation
          predictionInaccurate
          aimedDepartureTime
          expectedDepartureTime
          destinationDisplay {
            frontText
          }
        }
      }
    }
  }
}`;

export interface EnturTripVariables {
  from: { place: string };
  to: { place: string };
  dateTime: string;
  numTripPatterns: number;
}

export function buildTripVariables(
  journey: TransitJourney,
  arrival: Date,
  alternatives: number
): EnturTripVariables {
  return {
    from: { place: journey.from.id },
    to: { place: journey.to.id },
    dateTime: arrival.toISOString(),
    numTripPatterns: alternatives,
  };
}

export interface TransitLeg {
  mode: string;
  /** The line number as shown on the bus, for example `1`. */
  lineCode: string | null;
  /** Where the leg starts, for example platform `3`. Entur returns an empty string when unnamed. */
  quayCode: string | null;
  /** The destination shown on the front of the vehicle. */
  frontText: string | null;
}

export interface TransitDeparture {
  id: string;
  departure: Date;
  arrival: Date;
  durationSeconds: number;
  walkDistanceMetres: number;
  transfers: number;
  legs: TransitLeg[];
  /** True only when the first transit leg carries a live prediction rather than the timetable. */
  realtime: boolean;
  /** Seconds behind timetable, negative when early. Null without a live prediction. */
  delaySeconds: number | null;
  cancelled: boolean;
  predictionInaccurate: boolean;
}

interface RawEstimatedCall {
  realtime?: boolean | null;
  realtimeState?: string | null;
  cancellation?: boolean | null;
  predictionInaccurate?: boolean | null;
  aimedDepartureTime?: string | null;
  expectedDepartureTime?: string | null;
  destinationDisplay?: { frontText?: string | null } | null;
}

interface RawLeg {
  mode?: string | null;
  line?: { publicCode?: string | null } | null;
  fromPlace?: { quay?: { publicCode?: string | null } | null } | null;
  fromEstimatedCall?: RawEstimatedCall | null;
}

interface RawTripPattern {
  expectedStartTime?: string | null;
  expectedEndTime?: string | null;
  duration?: number | null;
  walkDistance?: number | null;
  legs?: (RawLeg | null)[] | null;
}

export interface EnturTripResponse {
  data?: { trip?: { tripPatterns?: (RawTripPattern | null)[] | null } | null } | null;
  errors?: { message?: string }[] | null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapLeg(leg: RawLeg): TransitLeg {
  return {
    mode: typeof leg.mode === 'string' ? leg.mode : 'unknown',
    lineCode: trimToNull(leg.line?.publicCode),
    quayCode: trimToNull(leg.fromPlace?.quay?.publicCode),
    frontText: trimToNull(leg.fromEstimatedCall?.destinationDisplay?.frontText),
  };
}

function mapTripPattern(pattern: RawTripPattern): TransitDeparture | null {
  const departure = parseDate(pattern.expectedStartTime);
  const arrival = parseDate(pattern.expectedEndTime);
  if (!departure || !arrival) {
    return null;
  }

  const rawLegs = (pattern.legs ?? []).filter((leg): leg is RawLeg => Boolean(leg));
  const legs = rawLegs.map(mapLeg);
  const transitLegs = rawLegs.filter((leg) => leg.mode !== 'foot');

  // A pure walk is a valid itinerary but never a departure board entry. Belt and braces alongside
  // the explicit foot access and egress in the query.
  if (transitLegs.length === 0) {
    return null;
  }

  const firstCall = transitLegs[0]?.fromEstimatedCall ?? null;
  const aimed = parseDate(firstCall?.aimedDepartureTime);
  const expected = parseDate(firstCall?.expectedDepartureTime);
  const realtime = firstCall?.realtime === true;

  return {
    id: `${departure.toISOString()}-${transitLegs.map((leg) => leg.line?.publicCode ?? '').join('-')}`,
    departure,
    arrival,
    durationSeconds:
      typeof pattern.duration === 'number' && Number.isFinite(pattern.duration)
        ? pattern.duration
        : Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / 1000)),
    walkDistanceMetres:
      typeof pattern.walkDistance === 'number' && Number.isFinite(pattern.walkDistance)
        ? Math.round(pattern.walkDistance)
        : 0,
    transfers: Math.max(0, transitLegs.length - 1),
    legs,
    realtime,
    delaySeconds:
      realtime && aimed && expected
        ? Math.round((expected.getTime() - aimed.getTime()) / 1000)
        : null,
    cancelled: rawLegs.some((leg) => leg.fromEstimatedCall?.cancellation === true),
    predictionInaccurate: firstCall?.predictionInaccurate === true,
  };
}

/**
 * Turns a trip response into departures ordered by departure time. Entur returns arrive-by results
 * latest first, and drops nothing that would otherwise render as an empty row.
 */
export function mapTripResponse(response: EnturTripResponse): TransitDeparture[] {
  const patterns = response.data?.trip?.tripPatterns ?? [];
  const departures: TransitDeparture[] = [];

  for (const pattern of patterns) {
    if (!pattern) {
      continue;
    }
    const departure = mapTripPattern(pattern);
    if (departure) {
      departures.push(departure);
    }
  }

  return departures.sort((left, right) => left.departure.getTime() - right.departure.getTime());
}
