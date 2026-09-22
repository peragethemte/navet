import { describe, expect, it } from 'vitest';
import { normalizeCalendarViewMode, resolveCalendarCardWindow } from '../calendar-view-mode';

const NOW = new Date(2026, 8, 22, 14, 30, 0, 0);

describe('normalizeCalendarViewMode', () => {
  it('keeps the modes the settings dialog writes', () => {
    expect(normalizeCalendarViewMode('day')).toBe('day');
    expect(normalizeCalendarViewMode('days')).toBe('days');
    expect(normalizeCalendarViewMode('month')).toBe('month');
  });

  it('reads the retired week value as the multi-day agenda', () => {
    // Every profile configured before the day count existed holds this, and must keep working.
    expect(normalizeCalendarViewMode('week')).toBe('days');
  });

  it('falls back to the multi-day agenda for anything unrecognised', () => {
    expect(normalizeCalendarViewMode(undefined)).toBe('days');
    expect(normalizeCalendarViewMode('fortnight')).toBe('days');
    expect(normalizeCalendarViewMode(3)).toBe('days');
  });
});

describe('resolveCalendarCardWindow', () => {
  it('ends day mode with today', () => {
    const window = resolveCalendarCardWindow(NOW, 'day', 7, 1);

    expect(window.startDateKey).toBe('2026-09-22');
    expect(window.endDateKey).toBe('2026-09-22');
    // Agenda views start now, so an appointment that is over drops off the card.
    expect(window.start).toEqual(NOW);
  });

  it('spans the requested number of days', () => {
    expect(resolveCalendarCardWindow(NOW, 'days', 7, 1).endDateKey).toBe('2026-09-28');
    expect(resolveCalendarCardWindow(NOW, 'days', 14, 1).endDateKey).toBe('2026-10-05');
    expect(resolveCalendarCardWindow(NOW, 'days', 99, 1).endDateKey).toBe('2026-10-05');
  });

  it('opens the month window at the top-left grid cell, not at today', () => {
    const window = resolveCalendarCardWindow(NOW, 'month', 7, 1);

    expect(window.startDateKey).toBe('2026-08-31');
    expect(window.endDateKey).toBe('2026-10-04');
    expect(window.todayDateKey).toBe('2026-09-22');
  });

  it("follows the locale's first weekday", () => {
    expect(resolveCalendarCardWindow(NOW, 'month', 7, 0).startDateKey).toBe('2026-08-30');
  });
});
