/**
 * Provider-neutral configuration for a recurring public-transport journey, such as a school run.
 *
 * A journey is modelled as "be there by 08:15 on school days", not "leave after 06:30". The
 * deadline is the question a household actually asks, and the departures that satisfy it fall out
 * of the journey planner's answer. `leadMinutes` only decides how early the dashboard starts
 * showing the journey; it cannot describe a window that fails to contain the journey.
 */
export interface TransitPlace {
  /** Opaque stop identifier from the journey planner, for example `NSR:StopPlace:2952`. */
  id: string;
  name: string;
}

export interface TransitJourney {
  id: string;
  name: string;
  from: TransitPlace;
  to: TransitPlace;
  /** Target arrival time as minutes from local midnight. */
  arriveByMinute: number;
  /** How long before the arrival time the journey becomes the dashboard's active one. */
  leadMinutes: number;
  /** Days the journey runs, as `Date.getDay()` values where 0 is Sunday. */
  weekdays: number[];
}

export const MINUTES_PER_DAY = 24 * 60;
export const TRANSIT_JOURNEY_NAME_MAX_LENGTH = 40;
export const TRANSIT_PLACE_NAME_MAX_LENGTH = 80;
export const TRANSIT_LEAD_MINUTES_MIN = 5;
export const TRANSIT_LEAD_MINUTES_MAX = 12 * 60;
export const TRANSIT_LEAD_MINUTES_DEFAULT = 120;
/** Journeys are per household rather than per person, so a short list keeps the card glanceable. */
export const TRANSIT_JOURNEY_MAX_COUNT = 8;

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
/** Monday first, matching every locale Navet ships. `Date.getDay()` starts on Sunday. */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Parses `HH:MM` into minutes from midnight. Returns null for anything else. */
export function parseClockTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function formatClockTime(minuteOfDay: number): string {
  const normalized =
    ((Math.round(minuteOfDay) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeTransitPlace(value: unknown): TransitPlace | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (id.length === 0) {
    return null;
  }

  return {
    id,
    name:
      typeof value.name === 'string'
        ? value.name.trim().slice(0, TRANSIT_PLACE_NAME_MAX_LENGTH)
        : '',
  };
}

function normalizeWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<number>();
  for (const entry of value) {
    if (typeof entry === 'number' && Number.isInteger(entry) && entry >= 0 && entry <= 6) {
      unique.add(entry);
    }
  }

  return ALL_WEEKDAYS.filter((day) => unique.has(day));
}

/**
 * Returns a sanitized journey, or null when it could never resolve to a departure. Persisted
 * settings, imported dashboards, and the settings form all pass through this.
 */
export function normalizeTransitJourney(value: unknown): TransitJourney | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const from = normalizeTransitPlace(value.from);
  const to = normalizeTransitPlace(value.to);
  const arriveByMinute = clampInteger(value.arriveByMinute, 0, MINUTES_PER_DAY - 1);
  const weekdays = normalizeWeekdays(value.weekdays);

  if (id.length === 0 || !from || !to || arriveByMinute === null || weekdays.length === 0) {
    return null;
  }

  return {
    id,
    name:
      typeof value.name === 'string'
        ? value.name.trim().slice(0, TRANSIT_JOURNEY_NAME_MAX_LENGTH)
        : '',
    from,
    to,
    arriveByMinute,
    leadMinutes:
      clampInteger(value.leadMinutes, TRANSIT_LEAD_MINUTES_MIN, TRANSIT_LEAD_MINUTES_MAX) ??
      TRANSIT_LEAD_MINUTES_DEFAULT,
    weekdays,
  };
}

export function normalizeTransitJourneys(value: unknown): TransitJourney[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const journeys: TransitJourney[] = [];
  for (const entry of value) {
    const journey = normalizeTransitJourney(entry);
    if (!journey || seen.has(journey.id)) {
      continue;
    }
    seen.add(journey.id);
    journeys.push(journey);
    if (journeys.length >= TRANSIT_JOURNEY_MAX_COUNT) {
      break;
    }
  }

  return journeys;
}

/**
 * The next moment the journey must be completed by, at or after `now`, in local time. Today counts
 * only while its arrival time has not passed; a journey with no weekdays never occurs.
 */
export function nextJourneyArrival(journey: TransitJourney, now: Date): Date | null {
  if (journey.weekdays.length === 0) {
    return null;
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(0, journey.arriveByMinute, 0, 0);

    if (candidate.getTime() >= now.getTime() && journey.weekdays.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return null;
}

export function isJourneyActiveAt(journey: TransitJourney, now: Date): boolean {
  const arrival = nextJourneyArrival(journey, now);
  if (!arrival) {
    return false;
  }

  return arrival.getTime() - now.getTime() <= journey.leadMinutes * 60_000;
}

export interface TransitJourneyOccurrence {
  journey: TransitJourney;
  arrival: Date;
  active: boolean;
}

/**
 * What the card should render right now: every journey inside its lead window, earliest deadline
 * first. Outside every window it rolls forward to the single next journey, so an evening dashboard
 * shows tomorrow morning's run instead of an empty card.
 */
export function resolveTransitBoard(
  journeys: TransitJourney[],
  now: Date
): TransitJourneyOccurrence[] {
  const occurrences: TransitJourneyOccurrence[] = [];
  for (const journey of journeys) {
    const arrival = nextJourneyArrival(journey, now);
    if (!arrival) {
      continue;
    }
    occurrences.push({
      journey,
      arrival,
      active: arrival.getTime() - now.getTime() <= journey.leadMinutes * 60_000,
    });
  }

  occurrences.sort((left, right) => left.arrival.getTime() - right.arrival.getTime());

  const active = occurrences.filter((occurrence) => occurrence.active);
  return active.length > 0 ? active : occurrences.slice(0, 1);
}
