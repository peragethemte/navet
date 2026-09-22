import { describe, expect, it } from 'vitest';
import {
  formatClockTime,
  isJourneyActiveAt,
  journeySearchTime,
  nextJourneyTarget,
  normalizeTransitJourney,
  normalizeTransitJourneys,
  parseClockTime,
  resolveTransitBoard,
  TRANSIT_DEPART_TRAIL_MINUTES,
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
    timeMode: 'arriveBy',
    targetMinute: 8 * 60 + 15,
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
    ['an unusable target time', { targetMinute: 'morning' }],
  ])('rejects a journey with %s', (_label, overrides) => {
    expect(normalizeTransitJourney({ ...journey(), ...overrides })).toBeNull();
  });

  it('rejects values that are not objects', () => {
    expect(normalizeTransitJourney(null)).toBeNull();
    expect(normalizeTransitJourney([journey()])).toBeNull();
  });

  it('reads the target time journeys saved before the timing mode existed', () => {
    const { targetMinute: _dropped, ...legacy } = journey();
    const result = normalizeTransitJourney({ ...legacy, arriveByMinute: 7 * 60 + 40 });
    expect(result?.targetMinute).toBe(7 * 60 + 40);
    expect(result?.timeMode).toBe('arriveBy');
  });

  it('keeps a depart-after mode and rejects anything else', () => {
    expect(normalizeTransitJourney({ ...journey(), timeMode: 'departAfter' })?.timeMode).toBe(
      'departAfter'
    );
    expect(normalizeTransitJourney({ ...journey(), timeMode: 'whenever' })?.timeMode).toBe(
      'arriveBy'
    );
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

describe('nextJourneyTarget', () => {
  it('uses today while the arrival time is still ahead', () => {
    // Tuesday 06:00 local.
    const target = nextJourneyTarget(journey(), new Date(2026, 8, 22, 6, 0));
    expect(target?.getDate()).toBe(22);
    expect(target?.getHours()).toBe(8);
    expect(target?.getMinutes()).toBe(15);
  });

  it('rolls to the next configured day once today has passed', () => {
    const target = nextJourneyTarget(journey(), new Date(2026, 8, 22, 9, 0));
    expect(target?.getDate()).toBe(23);
  });

  it('skips days the journey does not run', () => {
    // Friday evening must not offer Saturday's departure.
    const target = nextJourneyTarget(journey(), new Date(2026, 8, 25, 20, 0));
    expect(target?.getDay()).toBe(1);
    expect(target?.getDate()).toBe(28);
  });

  it('keeps a depart-after journey for its trail, then rolls forward', () => {
    const home = journey({ timeMode: 'departAfter', targetMinute: 16 * 60 });
    const trailEnd = new Date(2026, 8, 22, 16, TRANSIT_DEPART_TRAIL_MINUTES);
    expect(nextJourneyTarget(home, new Date(2026, 8, 22, 16, 30))?.getDate()).toBe(22);
    expect(nextJourneyTarget(home, trailEnd)?.getDate()).toBe(22);
    expect(nextJourneyTarget(home, new Date(trailEnd.getTime() + 60_000))?.getDate()).toBe(23);
  });

  it('returns null when no day is configured', () => {
    expect(nextJourneyTarget(journey({ weekdays: [] }), new Date(2026, 8, 22, 6, 0))).toBeNull();
  });
});

describe('journeySearchTime', () => {
  const target = new Date(2026, 8, 22, 16, 0);

  it('plans an arrive-by journey from its deadline whatever the clock says', () => {
    const arriveBy = journey({ targetMinute: 16 * 60 });
    expect(journeySearchTime(arriveBy, target, new Date(2026, 8, 22, 16, 20))).toEqual(target);
  });

  it('plans a depart-after journey from its target until that passes', () => {
    const home = journey({ timeMode: 'departAfter', targetMinute: 16 * 60 });
    expect(journeySearchTime(home, target, new Date(2026, 8, 22, 15, 30))).toEqual(target);
  });

  it('rolls a depart-after journey forward with the clock, floored to the minute', () => {
    const home = journey({ timeMode: 'departAfter', targetMinute: 16 * 60 });
    const result = journeySearchTime(home, target, new Date(2026, 8, 22, 16, 20, 42, 500));
    expect(result).toEqual(new Date(2026, 8, 22, 16, 20));
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

  it('stays active past a depart-after target, inside the trail', () => {
    const home = journey({ timeMode: 'departAfter', targetMinute: 16 * 60 });
    expect(isJourneyActiveAt(home, new Date(2026, 8, 22, 16, 30))).toBe(true);
  });
});

describe('resolveTransitBoard', () => {
  const school = journey({ id: 'school', targetMinute: 8 * 60 + 15 });
  const swimming = journey({
    id: 'swimming',
    targetMinute: 17 * 60,
    weekdays: [3],
  });

  it('shows every active journey, earliest deadline first', () => {
    const early = journey({ id: 'early', targetMinute: 7 * 60 + 30 });
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

  it('carries the rolling search time of an active depart-after journey', () => {
    const home = journey({ id: 'home', timeMode: 'departAfter', targetMinute: 16 * 60 });
    const board = resolveTransitBoard([home], new Date(2026, 8, 22, 16, 25, 30));
    expect(board[0]?.target).toEqual(new Date(2026, 8, 22, 16, 0));
    expect(board[0]?.searchTime).toEqual(new Date(2026, 8, 22, 16, 25));
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
