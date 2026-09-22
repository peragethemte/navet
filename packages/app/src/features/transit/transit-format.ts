/** Presentation helpers for the departures card. Pure so the card itself stays declarative. */

export function formatDepartureClock(value: Date, locale: string, use24HourTime: boolean): string {
  return new Intl.DateTimeFormat(locale, {
    hour: use24HourTime ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !use24HourTime,
  }).format(value);
}

export function formatJourneyDay(value: Date, locale: string, now: Date): string | null {
  const days = Math.round(
    (new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000
  );

  // Today needs no label; the times speak for themselves.
  return days === 0 ? null : new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(value);
}

/** Whole minutes until departure. Negative once the bus has left. */
export function minutesUntil(target: Date, now: Date): number {
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

export function formatWalkDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
}

/** Whole minutes behind timetable. Rounds towards zero so a 20 second delay reads as on time. */
export function delayMinutes(delaySeconds: number | null): number {
  if (delaySeconds === null) {
    return 0;
  }
  return Math.trunc(delaySeconds / 60);
}
