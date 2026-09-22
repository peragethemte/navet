import { renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
