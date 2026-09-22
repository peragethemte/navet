import { describe, expect, it } from 'vitest';
import {
  delayMinutes,
  formatDepartureClock,
  formatJourneyDay,
  formatWalkDistance,
  minutesUntil,
} from '../transit-format';

describe('formatDepartureClock', () => {
  const value = new Date(2026, 8, 23, 7, 53);

  it('renders a 24-hour clock', () => {
    expect(formatDepartureClock(value, 'nb-NO', true)).toBe('07:53');
  });

  it('renders a 12-hour clock', () => {
    expect(formatDepartureClock(value, 'en-US', false)).toMatch(/7:53\s?AM/i);
  });
});

describe('formatJourneyDay', () => {
  const now = new Date(2026, 8, 22, 20, 0);

  it('omits the day for today', () => {
    expect(formatJourneyDay(new Date(2026, 8, 22, 22, 0), 'en-GB', now)).toBeNull();
  });

  it('names a later day', () => {
    expect(formatJourneyDay(new Date(2026, 8, 23, 8, 15), 'en-GB', now)).toBe('Wednesday');
  });
});

describe('minutesUntil', () => {
  const now = new Date(2026, 8, 22, 7, 0);

  it('counts forward', () => {
    expect(minutesUntil(new Date(2026, 8, 22, 7, 12), now)).toBe(12);
  });

  it('goes negative once the departure has passed', () => {
    expect(minutesUntil(new Date(2026, 8, 22, 6, 58), now)).toBe(-2);
  });
});

describe('formatWalkDistance', () => {
  it.each([
    [0, '0 m'],
    [354, '354 m'],
    [1200, '1.2 km'],
  ])('renders %s metres', (metres, expected) => {
    expect(formatWalkDistance(metres)).toBe(expected);
  });
});

describe('delayMinutes', () => {
  it.each([
    [null, 0],
    [40, 0],
    [595, 9],
    [-130, -2],
  ])('renders %s seconds', (seconds, expected) => {
    expect(delayMinutes(seconds)).toBe(expected);
  });
});
