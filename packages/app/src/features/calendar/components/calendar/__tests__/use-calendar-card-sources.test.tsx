import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarCardSources } from '../use-calendar-card-sources';

const useProviderCalendarDevicesCollectionMock = vi.fn();

vi.mock('@navet/app/hooks', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  usePersistedState: (_key: string, initial: unknown) => useState(initial),
  useProviderCalendarDevicesCollection: (
    ...args: Parameters<typeof useProviderCalendarDevicesCollectionMock>
  ) => useProviderCalendarDevicesCollectionMock(...args),
}));

const ICLOUD_CARD_ID = 'icloud:calendar.navet_overview';

function calendarCollection() {
  return [
    {
      id: ICLOUD_CARD_ID,
      name: 'Calendar',
      room: 'Unknown',
      sourceIds: ['icloud:calendar.familie', 'icloud:calendar.jobb'],
      sources: [
        { id: 'icloud:calendar.familie', name: 'Familie', room: 'Unknown', events: [] },
        { id: 'icloud:calendar.jobb', name: 'Jobb', room: 'Unknown', events: [] },
      ],
      events: [],
    },
  ];
}

beforeEach(() => {
  useProviderCalendarDevicesCollectionMock.mockReset();
  useProviderCalendarDevicesCollectionMock.mockReturnValue(calendarCollection());
});

describe('useCalendarCardSources', () => {
  it('resolves its calendars from the provider named in the card id', () => {
    // A calendar-only provider is never the current session, so resolving from the current
    // provider would leave the source picker empty next to a hub such as Homey.
    renderHook(() => useCalendarCardSources(ICLOUD_CARD_ID));

    expect(useProviderCalendarDevicesCollectionMock).toHaveBeenCalledWith('icloud');
  });

  it('falls back to the current provider when there is no card id', () => {
    renderHook(() => useCalendarCardSources());

    expect(useProviderCalendarDevicesCollectionMock).toHaveBeenCalledWith(undefined);
  });

  it('falls back to the current provider when the card id is not provider-scoped', () => {
    renderHook(() => useCalendarCardSources('calendar.legacy_card'));

    expect(useProviderCalendarDevicesCollectionMock).toHaveBeenCalledWith(undefined);
  });

  it('offers every source of the aggregate card as a selectable calendar', () => {
    const { result } = renderHook(() => useCalendarCardSources(ICLOUD_CARD_ID));

    expect(result.current.availableCalendars.map((calendar) => calendar.id)).toEqual([
      'icloud:calendar.familie',
      'icloud:calendar.jobb',
    ]);
    expect(result.current.selectedCalendarIds).toEqual([
      'icloud:calendar.familie',
      'icloud:calendar.jobb',
    ]);
  });
});

const NOW = new Date('2026-09-22T10:00:00+02:00');

function event(id: string, startIso: string, endIso: string) {
  return {
    id,
    title: id,
    startTime: '10:00',
    endTime: '11:00',
    timeDisplay: '10:00',
    type: 'event' as const,
    color: 'bg-blue-500',
    startDateTime: startIso,
    endDateTime: endIso,
    sortKey: startIso,
  };
}

function collectionWithEvents() {
  return [
    {
      id: ICLOUD_CARD_ID,
      name: 'Calendar',
      room: 'Unknown',
      sourceIds: ['icloud:calendar.familie'],
      sources: [
        {
          id: 'icloud:calendar.familie',
          name: 'Familie',
          room: 'Unknown',
          events: [
            event('later-today', '2026-09-22T18:00:00+02:00', '2026-09-22T19:00:00+02:00'),
            event('tomorrow', '2026-09-23T08:00:00+02:00', '2026-09-23T09:00:00+02:00'),
            event('next-week', '2026-09-30T08:00:00+02:00', '2026-09-30T09:00:00+02:00'),
          ],
        },
      ],
      events: [],
    },
  ];
}

describe('calendar view windows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useProviderCalendarDevicesCollectionMock.mockReturnValue(collectionWithEvents());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows only what is left of today in day mode', () => {
    const { result } = renderHook(() => useCalendarCardSources(ICLOUD_CARD_ID));

    act(() => {
      result.current.setViewMode('day');
    });

    expect(result.current.selectedEvents.map((item) => item.id)).toEqual(['later-today']);
  });

  it('keeps the week window rolling past midnight', () => {
    const { result } = renderHook(() => useCalendarCardSources(ICLOUD_CARD_ID));

    act(() => {
      result.current.setViewMode('week');
    });

    expect(result.current.selectedEvents.map((item) => item.id)).toEqual([
      'later-today',
      'tomorrow',
    ]);
  });

  it('reaches further ahead in month mode', () => {
    const { result } = renderHook(() => useCalendarCardSources(ICLOUD_CARD_ID));

    act(() => {
      result.current.setViewMode('month');
    });

    expect(result.current.selectedEvents.map((item) => item.id)).toEqual([
      'later-today',
      'tomorrow',
      'next-week',
    ]);
  });
});
