import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { icloudCalendarFeatureService } from './icloud-calendar-feature.service';
import { resetICloudClientCache } from './icloud-client';
import type { ICloudSnapshot } from './icloud-types';

const SNAPSHOT: ICloudSnapshot = {
  configured: true,
  stale: false,
  fetchedAt: '2026-09-22T06:00:00+00:00',
  calendars: [
    {
      entityId: 'calendar.familie',
      name: 'Familie',
      events: [
        {
          uid: 'a#2026-09-22T18:00:00+02:00',
          summary: 'Foreldremøte',
          start: { dateTime: '2026-09-22T18:00:00+02:00' },
          end: { dateTime: '2026-09-22T19:30:00+02:00' },
        },
        {
          uid: 'b#2026-09-28',
          summary: 'Høstferie',
          start: { date: '2026-09-28' },
          end: { date: '2026-10-03' },
        },
      ],
    },
    { entityId: 'calendar.jobb', name: 'Jobb', events: [] },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  resetICloudClientCache();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => SNAPSHOT });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('icloudCalendarFeatureService', () => {
  it('returns the events of the requested calendar', async () => {
    const events = await icloudCalendarFeatureService.getEvents('calendar.familie');

    expect(events.map((event) => event.summary)).toEqual(['Foreldremøte', 'Høstferie']);
  });

  it('is called with a native entity id, not a provider-scoped one', async () => {
    // The app strips the `icloud:` prefix before it reaches the service.
    expect(await icloudCalendarFeatureService.getEvents('icloud:calendar.familie')).toEqual([]);
  });

  it('returns nothing for a calendar the sidecar does not know', async () => {
    expect(await icloudCalendarFeatureService.getEvents('calendar.borte')).toEqual([]);
  });

  it('returns an empty list for a calendar with no events', async () => {
    expect(await icloudCalendarFeatureService.getEvents('calendar.jobb')).toEqual([]);
  });

  it('narrows to an explicitly requested range', async () => {
    const events = await icloudCalendarFeatureService.getEvents('calendar.familie', {
      startDateTime: '2026-09-23T00:00:00+02:00',
      endDateTime: '2026-10-10T00:00:00+02:00',
    });

    expect(events.map((event) => event.summary)).toEqual(['Høstferie']);
  });

  it('keeps an event that is already under way at the start of the range', async () => {
    const events = await icloudCalendarFeatureService.getEvents('calendar.familie', {
      startDateTime: '2026-09-22T19:00:00+02:00',
      endDateTime: '2026-09-22T23:00:00+02:00',
    });

    expect(events.map((event) => event.summary)).toEqual(['Foreldremøte']);
  });
});
