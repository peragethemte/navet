/**
 * The sidecar's payload shape. Event records deliberately use the Google/CalDAV vocabulary the
 * shared calendar mapper already parses, so no navet-side mapping is needed.
 */

export interface ICloudCalendarValue {
  /** Set for all-day events. The end is exclusive, as in iCalendar. */
  date?: string;
  /** Set for timed events: ISO 8601, with an offset unless the event is floating. */
  dateTime?: string;
}

export interface ICloudEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: ICloudCalendarValue;
  end: ICloudCalendarValue;
}

export interface ICloudCalendar {
  entityId: string;
  name: string;
  events: ICloudEvent[];
}

export interface ICloudSnapshot {
  configured: boolean;
  stale: boolean;
  fetchedAt: string | null;
  calendars: ICloudCalendar[];
}
