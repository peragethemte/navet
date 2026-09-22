import { describe, expect, it } from 'vitest';
import {
  formatClockTime,
  isJourneyActiveAt,
  nextJourneyArrival,
  normalizeTransitJourney,
  normalizeTransitJourneys,
  parseClockTime,
  resolveTransitBoard,
  TRANSIT_JOURNEY_MAX_COUNT,
  TRANSIT_LEAD_MINUTES_DEFAULT,
  type TransitJourney,
} from './transit-journey';

const WEEKDAYS = [1, 2, 3, 4, 5];

function journey(overrides: Partial<TransitJourney> = {}): TransitJourney {
  return {
    id: 'school',
    name: 'School',
    from: { id: 'NSR:StopPlace:2952', name: 'Sarpsborg bussterminal' },
    to: { id: 'NSR:StopPlace:2719', name: 'Greåker vgs.' },
    arriveByMinute: 8 * 60 + 15,
    leadMinutes: TRANSIT_LEAD_MINUTES_DEFAULT,
    weekdays: WEEKDAYS,
    ...overrides,
  };
}

describe('parseClockTime', () => {
  it.each([
    ['08:15', 495],
    ['0:00', 0],
    ['23:59', 1439],
    ['  06:30 ', 390],
  ])('reads %s', (value, expected) => {
    expect(parseClockTime(value)).toBe(expected);
  });

  it.each(['24:00', '08:60', '8', '08.15', '', 'morning'])('rejects %s', (value) => {
    expect(parseClockTime(value)).toBeNull();
  });
});

describe('formatClockTime', () => {
  it.each([
    [495, '08:15'],
    [0, '00:00'],
    [1439, '23:59'],
  ])('renders %s', (value, expected) => {
    expect(formatClockTime(value)).toBe(expected);
  });

  it('wraps values outside a single day', () => {
    expect(formatClockTime(1440)).toBe('00:00');
    expect(formatClockTime(-60)).toBe('23:00');
  });
});

describe('normalizeTransitJourney', () => {
  it('keeps a valid journey and sorts its weekdays', () => {
    const result = normalizeTransitJourney({ ...journey(), weekdays: [5, 1, 1, 3] });
    expect(result?.weekdays).toEqual([1, 3, 5]);
  });

  it('defaults the lead time when it is missing or out of range', () => {
    expect(normalizeTransitJourney({ ...journey(), leadMinutes: undefined })?.leadMinutes).toBe(
      TRANSIT_LEAD_MINUTES_DEFAULT
    );
    expect(normalizeTransitJourney({ ...journey(), leadMinutes: 99_999 })?.leadMinutes).toBe(720);
    expect(normalizeTransitJourney({ ...journey(), leadMinutes: 1 })?.leadMinutes).toBe(5);
  });

  it.each([
    ['no id', { id: '' }],
    ['no weekdays', { weekdays: [] }],
    ['only invalid weekdays', { weekdays: [7, -1, 'mon'] }],
    ['no origin', { from: { id: '', name: 'Nowhere' } }],
    ['no destination', { to: null }],
    ['an unusable arrival time', { arriveByMinute: 'morning' }],
  ])('rejects a journey with %s', (_label, overrides) => {
    expect(normalizeTransitJourney({ ...journey(), ...overrides })).toBeNull();
  });

  it('rejects values that are not objects', () => {
    expect(normalizeTransitJourney(null)).toBeNull();
    expect(normalizeTransitJourney([journey()])).toBeNull();
  });

  it('truncates long names rather than dropping the journey', () => {
    const result = normalizeTransitJourney({ ...journey(), name: 'x'.repeat(200) });
    expect(result?.name).toHaveLength(40);
  });
});

describe('normalizeTransitJourneys', () => {
  it('drops invalid entries and keeps the rest', () => {
    expect(normalizeTransitJourneys([journey(), null, { id: 'broken' }])).toHaveLength(1);
  });

  it('keeps only the first journey per id', () => {
    const result = normalizeTransitJourneys([
      journey({ name: 'First' }),
      journey({ name: 'Second' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('First');
  });

  it('caps the list', () => {
    const many = Array.from({ length: 20 }, (_value, index) => journey({ id: `journey-${index}` }));
    expect(normalizeTransitJourneys(many)).toHaveLength(TRANSIT_JOURNEY_MAX_COUNT);
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(normalizeTransitJourneys(undefined)).toEqual([]);
  });
});

describe('nextJourneyArrival', () => {
  it('uses today while the arrival time is still ahead', () => {
    // Tuesday 06:00 local.
    const arrival = nextJourneyArrival(journey(), new Date(2026, 8, 22, 6, 0));
    expect(arrival?.getDate()).toBe(22);
    expect(arrival?.getHours()).toBe(8);
    expect(arrival?.getMinutes()).toBe(15);
  });

  it('rolls to the next configured day once today has passed', () => {
    const arrival = nextJourneyArrival(journey(), new Date(2026, 8, 22, 9, 0));
    expect(arrival?.getDate()).toBe(23);
  });

  it('skips days the journey does not run', () => {
    // Friday evening must not offer Saturday's departure.
    const arrival = nextJourneyArrival(journey(), new Date(2026, 8, 25, 20, 0));
    expect(arrival?.getDay()).toBe(1);
    expect(arrival?.getDate()).toBe(28);
  });

  it('returns null when no day is configured', () => {
    expect(nextJourneyArrival(journey({ weekdays: [] }), new Date(2026, 8, 22, 6, 0))).toBeNull();
  });
});

describe('isJourneyActiveAt', () => {
  it('is active inside the lead window', () => {
    expect(isJourneyActiveAt(journey(), new Date(2026, 8, 22, 7, 0))).toBe(true);
  });

  it('is inactive before the lead window opens', () => {
    expect(isJourneyActiveAt(journey(), new Date(2026, 8, 22, 5, 0))).toBe(false);
  });

  it('is active exactly at the arrival time', () => {
    expect(isJourneyActiveAt(journey(), new Date(2026, 8, 22, 8, 15))).toBe(true);
  });
});

describe('resolveTransitBoard', () => {
  const school = journey({ id: 'school', arriveByMinute: 8 * 60 + 15 });
  const swimming = journey({
    id: 'swimming',
    arriveByMinute: 17 * 60,
    weekdays: [3],
  });

  it('shows every active journey, earliest deadline first', () => {
    const early = journey({ id: 'early', arriveByMinute: 7 * 60 + 30 });
    // Wednesday 06:45: both morning journeys are inside their lead window.
    const board = resolveTransitBoard([school, early], new Date(2026, 8, 23, 6, 45));
    expect(board.map((entry) => entry.journey.id)).toEqual(['early', 'school']);
    expect(board.every((entry) => entry.active)).toBe(true);
  });

  it('rolls forward to a single upcoming journey when none is active', () => {
    // Tuesday 20:00: nothing is within its lead window.
    const board = resolveTransitBoard([school, swimming], new Date(2026, 8, 22, 20, 0));
    expect(board).toHaveLength(1);
    expect(board[0]?.journey.id).toBe('school');
    expect(board[0]?.active).toBe(false);
  });

  it('ignores journeys that can never occur', () => {
    expect(resolveTransitBoard([journey({ weekdays: [] })], new Date(2026, 8, 22, 6, 0))).toEqual(
      []
    );
  });

  it('returns nothing when no journey is configured', () => {
    expect(resolveTransitBoard([], new Date(2026, 8, 22, 6, 0))).toEqual([]);
  });
});
