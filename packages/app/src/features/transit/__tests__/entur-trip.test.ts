import type { TransitJourney } from '@navet/core/transit-journey';
import { describe, expect, it } from 'vitest';
import {
  buildTripVariables,
  ENTUR_TRIP_QUERY,
  type EnturTripResponse,
  mapTripResponse,
} from '../entur-trip';

const journey: TransitJourney = {
  id: 'school',
  name: 'School',
  from: { id: 'NSR:StopPlace:2952', name: 'Sarpsborg bussterminal' },
  to: { id: 'NSR:StopPlace:2719', name: 'Greåker vgs.' },
  arriveByMinute: 8 * 60 + 15,
  leadMinutes: 120,
  weekdays: [1, 2, 3, 4, 5],
};

function busLeg(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'bus',
    line: { publicCode: '1' },
    fromPlace: { quay: { publicCode: '3' } },
    fromEstimatedCall: {
      realtime: false,
      realtimeState: 'scheduled',
      cancellation: false,
      predictionInaccurate: false,
      aimedDepartureTime: '2026-09-23T07:53:00+02:00',
      expectedDepartureTime: '2026-09-23T07:53:00+02:00',
      destinationDisplay: { frontText: 'Fredrikstad 109' },
    },
    ...overrides,
  };
}

const footLeg = {
  mode: 'foot',
  line: null,
  fromPlace: { quay: { publicCode: '' } },
  fromEstimatedCall: null,
};

function response(patterns: unknown[]): EnturTripResponse {
  return { data: { trip: { tripPatterns: patterns as never } } };
}

describe('ENTUR_TRIP_QUERY', () => {
  // Entur nulls accessMode and egressMode when modes is passed partially, which silently produces
  // a route that never walks to the stop. See navet-local/entur-api-spec.md.
  it('spells out foot access and egress', () => {
    expect(ENTUR_TRIP_QUERY).toContain('accessMode: foot');
    expect(ENTUR_TRIP_QUERY).toContain('egressMode: foot');
  });

  it('asks for an arrive-by plan', () => {
    expect(ENTUR_TRIP_QUERY).toContain('arriveBy: true');
  });
});

describe('buildTripVariables', () => {
  it('sends the stop ids and the arrival deadline', () => {
    const variables = buildTripVariables(journey, new Date('2026-09-23T08:15:00+02:00'), 3);
    expect(variables).toEqual({
      from: { place: 'NSR:StopPlace:2952' },
      to: { place: 'NSR:StopPlace:2719' },
      dateTime: '2026-09-23T06:15:00.000Z',
      numTripPatterns: 3,
    });
  });
});

describe('mapTripResponse', () => {
  it('orders arrive-by results by departure time', () => {
    const departures = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T07:53:00+02:00',
          expectedEndTime: '2026-09-23T08:14:03+02:00',
          duration: 1263,
          walkDistance: 354.06,
          legs: [busLeg(), footLeg],
        },
        {
          expectedStartTime: '2026-09-23T07:38:00+02:00',
          expectedEndTime: '2026-09-23T07:58:00+02:00',
          duration: 1200,
          walkDistance: 0,
          legs: [busLeg(), footLeg],
        },
      ])
    );

    expect(departures.map((entry) => entry.departure.toISOString())).toEqual([
      '2026-09-23T05:38:00.000Z',
      '2026-09-23T05:53:00.000Z',
    ]);
  });

  it('reads line, platform and front text from the first transit leg', () => {
    const [departure] = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T07:53:00+02:00',
          expectedEndTime: '2026-09-23T08:14:03+02:00',
          duration: 1263,
          walkDistance: 354.06,
          legs: [busLeg(), footLeg],
        },
      ])
    );

    expect(departure?.legs[0]).toEqual({
      mode: 'bus',
      lineCode: '1',
      quayCode: '3',
      frontText: 'Fredrikstad 109',
    });
    expect(departure?.walkDistanceMetres).toBe(354);
    expect(departure?.transfers).toBe(0);
  });

  it('treats an empty quay code as no platform', () => {
    const [departure] = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T07:53:00+02:00',
          expectedEndTime: '2026-09-23T08:14:03+02:00',
          legs: [busLeg({ fromPlace: { quay: { publicCode: '' } } })],
        },
      ])
    );

    expect(departure?.legs[0]?.quayCode).toBeNull();
  });

  it('counts transfers from transit legs only', () => {
    const [departure] = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T07:53:00+02:00',
          expectedEndTime: '2026-09-23T08:14:03+02:00',
          legs: [busLeg(), footLeg, busLeg({ line: { publicCode: '150' } }), footLeg],
        },
      ])
    );

    expect(departure?.transfers).toBe(1);
  });

  it('drops a walk-only itinerary', () => {
    expect(
      mapTripResponse(
        response([
          {
            expectedStartTime: '2026-09-23T07:53:00+02:00',
            expectedEndTime: '2026-09-23T08:14:03+02:00',
            legs: [footLeg],
          },
        ])
      )
    ).toEqual([]);
  });

  it('reports a live delay against the timetable', () => {
    const [departure] = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T08:02:55+02:00',
          expectedEndTime: '2026-09-23T08:20:00+02:00',
          legs: [
            busLeg({
              fromEstimatedCall: {
                realtime: true,
                realtimeState: 'updated',
                cancellation: false,
                predictionInaccurate: false,
                aimedDepartureTime: '2026-09-23T07:53:00+02:00',
                expectedDepartureTime: '2026-09-23T08:02:55+02:00',
                destinationDisplay: { frontText: 'Fredrikstad 109' },
              },
            }),
          ],
        },
      ])
    );

    expect(departure?.realtime).toBe(true);
    expect(departure?.delaySeconds).toBe(595);
  });

  it('reports no delay without a live prediction', () => {
    const [departure] = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T07:53:00+02:00',
          expectedEndTime: '2026-09-23T08:14:03+02:00',
          legs: [busLeg()],
        },
      ])
    );

    expect(departure?.realtime).toBe(false);
    expect(departure?.delaySeconds).toBeNull();
  });

  it('flags a cancelled departure', () => {
    const [departure] = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T07:53:00+02:00',
          expectedEndTime: '2026-09-23T08:14:03+02:00',
          legs: [
            busLeg({
              fromEstimatedCall: {
                realtime: true,
                realtimeState: 'canceled',
                cancellation: true,
                predictionInaccurate: false,
                aimedDepartureTime: '2026-09-23T07:53:00+02:00',
                expectedDepartureTime: '2026-09-23T07:53:00+02:00',
                destinationDisplay: { frontText: 'Fredrikstad 109' },
              },
            }),
          ],
        },
      ])
    );

    expect(departure?.cancelled).toBe(true);
  });

  it('falls back to the wall-clock duration when the field is missing', () => {
    const [departure] = mapTripResponse(
      response([
        {
          expectedStartTime: '2026-09-23T07:53:00+02:00',
          expectedEndTime: '2026-09-23T08:13:00+02:00',
          legs: [busLeg()],
        },
      ])
    );

    expect(departure?.durationSeconds).toBe(1200);
  });

  it('survives an empty or malformed response', () => {
    expect(mapTripResponse({})).toEqual([]);
    expect(mapTripResponse({ data: { trip: null } })).toEqual([]);
    expect(mapTripResponse(response([null, { legs: [busLeg()] }]))).toEqual([]);
  });
});
