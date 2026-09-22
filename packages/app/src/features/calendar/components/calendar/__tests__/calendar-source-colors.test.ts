import { describe, expect, it } from 'vitest';
import {
  CALENDAR_SOURCE_COLOR_CLASSES,
  parseHexColor,
  resolveCalendarSourceColor,
} from '../calendar-source-colors';

describe('resolveCalendarSourceColor', () => {
  it('falls back to the position when the source has no colour of its own', () => {
    expect(resolveCalendarSourceColor(undefined, 0)).toBe('bg-blue-500');
    expect(resolveCalendarSourceColor(undefined, 1)).toBe('bg-purple-500');
  });

  it('keeps the historical rotation for providers that publish no colour', () => {
    const rotation = [0, 1, 2, 3, 4, 5].map((index) =>
      resolveCalendarSourceColor(undefined, index)
    );

    expect(rotation).toEqual([...CALENDAR_SOURCE_COLOR_CLASSES, CALENDAR_SOURCE_COLOR_CLASSES[0]]);
  });

  it('keeps Apple palette colours apart from each other', () => {
    // Apple's own swatches. Its orange is yellower than Tailwind's, which is why it lands on
    // amber and leaves yellow free for Apple's actual yellow.
    const mapped = [
      '#FF3B30',
      '#FF9500',
      '#FFCC00',
      '#34C759',
      '#007AFF',
      '#AF52DE',
      '#00C7BE',
    ].map((color) => resolveCalendarSourceColor(color, 0));

    expect(mapped).toEqual([
      'bg-red-500',
      'bg-amber-500',
      'bg-yellow-500',
      'bg-green-500',
      'bg-blue-500',
      'bg-purple-500',
      'bg-teal-500',
    ]);
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it('ignores the position once the source has a colour', () => {
    expect(resolveCalendarSourceColor('#FF3B30', 3)).toBe('bg-red-500');
  });

  it('accepts the alpha byte Apple appends', () => {
    expect(resolveCalendarSourceColor('#FF3B30FF', 0)).toBe('bg-red-500');
  });

  it('falls back when the colour is not a hex value', () => {
    expect(resolveCalendarSourceColor('rebeccapurple', 1)).toBe('bg-purple-500');
    expect(resolveCalendarSourceColor('#12345', 1)).toBe('bg-purple-500');
  });
});

describe('parseHexColor', () => {
  it('reads six and eight digit values', () => {
    expect(parseHexColor('#FF2968')).toEqual([255, 41, 104]);
    expect(parseHexColor('#ff2968ff')).toEqual([255, 41, 104]);
  });

  it('rejects anything else', () => {
    expect(parseHexColor('#fff')).toBeNull();
    expect(parseHexColor(undefined)).toBeNull();
  });
});
