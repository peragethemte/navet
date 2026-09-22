import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCalendarEventsRequestCache,
  requestCalendarEvents,
  resolveCalendarFetchWindow,
} from '../calendar-events-request';

const getEventsMock = vi.fn();

vi.mock('@navet/app/services/integration-calendar-feature.service', () => ({
  integrationCalendarFeatureService: {
    getEvents: (...args: unknown[]) => getEventsMock(...args),
  },
}));

const WINDOW = {
  startDateTime: '2026-08-25T00:00:00.000Z',
  endDateTime: '2026-11-06T00:00:00.000Z',
};
const OTHER_WINDOW = {
  startDateTime: WINDOW.startDateTime,
  endDateTime: '2026-11-07T00:00:00.000Z',
};
const TTL = 60_000;

beforeEach(() => {
  clearCalendarEventsRequestCache();
  getEventsMock.mockReset();
  getEventsMock.mockResolvedValue([{ uid: 'a' }]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resolveCalendarFetchWindow', () => {
  it('reaches back past the start of the month and well ahead of today', () => {
    const window = resolveCalendarFetchWindow(new Date(2026, 8, 22, 14, 0, 0, 0));

    // A month grid can open up to six days before the first, so the window starts a week earlier.
    expect(new Date(window.startDateTime)).toEqual(new Date(2026, 7, 25, 0, 0, 0, 0));
    expect(new Date(window.endDateTime)).toEqual(new Date(2026, 10, 6, 23, 59, 59, 999));
  });

  it('still starts before the month when today is the first', () => {
    const window = resolveCalendarFetchWindow(new Date(2026, 8, 1, 0, 30, 0, 0));

    expect(new Date(window.startDateTime)).toEqual(new Date(2026, 7, 25, 0, 0, 0, 0));
  });
});

describe('requestCalendarEvents', () => {
  it('serves every caller of the same calendar and window from one request', async () => {
    const [first, second] = await Promise.all([
      requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL),
      requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL),
    ]);

    // The dashboard collection and each mounted card otherwise fetch the same calendar separately.
    expect(getEventsMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('fetches again for a different calendar or a different window', async () => {
    await requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL);
    await requestCalendarEvents('icloud:calendar.jobb', WINDOW, TTL);
    await requestCalendarEvents('icloud:calendar.familie', OTHER_WINDOW, TTL);

    expect(getEventsMock).toHaveBeenCalledTimes(3);
  });

  it('passes the window through to the provider', async () => {
    await requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL);

    expect(getEventsMock).toHaveBeenCalledWith('icloud:calendar.familie', WINDOW);
  });

  it('refetches once the entry has expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 14, 0, 0, 0));

    await requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL);
    vi.setSystemTime(new Date(2026, 8, 22, 14, 2, 0, 0));
    await requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL);

    expect(getEventsMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure, so a dropped connection retries on the next refresh', async () => {
    getEventsMock.mockRejectedValueOnce(new Error('offline'));

    await expect(requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL)).resolves.toEqual(
      []
    );

    getEventsMock.mockResolvedValueOnce([{ uid: 'b' }]);
    await expect(requestCalendarEvents('icloud:calendar.familie', WINDOW, TTL)).resolves.toEqual([
      { uid: 'b' },
    ]);
    expect(getEventsMock).toHaveBeenCalledTimes(2);
  });
});
