import type {
  PlatformCalendarEvent,
  PlatformCalendarRequestOptions,
} from '@navet/core/provider-feature-models';
import type { ProviderCalendarFeatureService } from '@navet/core/provider-feature-services';
import { getICloudSnapshot } from './icloud-client';
import type { ICloudEvent } from './icloud-types';

export const icloudCalendarFeatureService: ProviderCalendarFeatureService = {
  async getEvents(entityId, options) {
    const snapshot = await getICloudSnapshot();
    const calendar = snapshot?.calendars.find((entry) => entry.entityId === entityId);
    if (!calendar) {
      return [];
    }

    const events = calendar.events.filter((event) => isWithinRequestedRange(event, options));

    // The shared contract carries calendar events untyped on purpose; the field names above are
    // the real agreement with the app's calendar mapper.
    return events as unknown as PlatformCalendarEvent[];
  },
};

/**
 * The sidecar already serves a bounded window, so this narrows it to the range the card asked for.
 * A request reaching past the sidecar's own window simply returns what the sidecar holds.
 */
function isWithinRequestedRange(
  event: ICloudEvent,
  options: PlatformCalendarRequestOptions | undefined
): boolean {
  const start = toTimestamp(event.start.dateTime ?? event.start.date);
  const end = toTimestamp(event.end.dateTime ?? event.end.date) ?? start;
  if (start === null || end === null) {
    return true;
  }

  const rangeStart = toTimestamp(options?.startDateTime);
  const rangeEnd = toTimestamp(options?.endDateTime);

  if (rangeStart !== null && end < rangeStart) {
    return false;
  }

  return rangeEnd === null || start <= rangeEnd;
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
