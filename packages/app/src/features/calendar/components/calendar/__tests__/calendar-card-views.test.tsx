import type { CardSize } from '@navet/app/components/shared/card-size';
import { renderWithProviders } from '@navet/app/test/render';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarCard } from '../../calendar-card';
import type { CalendarEvent } from '../types';

// The card resolves its calendars from a provider collection; the story and demo path feeds it
// events directly instead, which is what this exercises.
vi.mock('@navet/app/hooks/use-provider-calendar-devices', () => ({
  useProviderCalendarDevices: () => [],
  useProviderCalendarDevicesCollection: () => [],
}));

const NOW = new Date(2026, 8, 22, 9, 0, 0, 0);

function at(day: number, hour: number) {
  return new Date(2026, 8, day, hour, 0, 0, 0).toISOString();
}

const events: CalendarEvent[] = [
  {
    id: 'band',
    title: 'Band practice',
    startTime: '18:00',
    endTime: '20:00',
    timeDisplay: '18:00',
    startDateTime: at(22, 18),
    endDateTime: at(22, 20),
    sortKey: at(22, 18),
    type: 'event',
    color: 'bg-indigo-500',
  },
  {
    id: 'meetup',
    title: 'Neighbourhood meetup',
    startTime: '18:00',
    endTime: '21:00',
    timeDisplay: '18:00',
    startDateTime: at(25, 18),
    endDateTime: at(25, 21),
    sortKey: at(25, 18),
    type: 'event',
    color: 'bg-blue-500',
  },
];

function renderCard(size: CardSize) {
  return renderWithProviders(
    <CalendarCard id="calendar.family" name="Family Calendar" events={events} size={size} />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('CalendarCard view routing', () => {
  // A card added to a dashboard is medium by default. The multi-day agenda has to be visible there,
  // or the view a user picked in settings silently does nothing on the size most cards actually are.
  it.each<CardSize>(['medium', 'large', 'extra-large', 'extra-wide'])(
    'shows the multi-day agenda at %s',
    (size) => {
      renderCard(size);

      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Tomorrow')).toBeInTheDocument();
      expect(screen.getByText('Band practice')).toBeInTheDocument();
    }
  );

  it('keeps the compact list on a small tile', () => {
    renderCard('small');

    // No lane headings: a 176 px square has no room for them.
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.getByText('Band practice')).toBeInTheDocument();
  });

  it('renders the month grid once the view mode is month', () => {
    localStorage.setItem(
      'navet-calendar-card-view-modes',
      JSON.stringify({ 'calendar.family': 'month' })
    );

    renderCard('large');

    // Every day of the month is a cell, including days with nothing on them. Mid-month days are
    // unique whichever weekday the locale starts on; the borrowed days at either end are not.
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  it('reads a profile still holding the retired week mode as the multi-day agenda', () => {
    localStorage.setItem(
      'navet-calendar-card-view-modes',
      JSON.stringify({ 'calendar.family': 'week' })
    );

    renderCard('large');

    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
