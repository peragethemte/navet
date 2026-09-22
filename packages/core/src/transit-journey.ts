/**
 * Provider-neutral configuration for a recurring public-transport journey, such as a school run.
 *
 * A journey states one time of day and what that time means. "Be there by 08:15 on school days" is
 * the question a household asks on the way out, and the departures that satisfy it fall out of the
 * journey planner's answer. Coming home the question inverts: "what leaves after 16:00", where the
 * time is a floor rather than a deadline. `timeMode` picks between the two, and `leadMinutes` only
 * decides how early the dashboard starts showing the journey; it cannot describe a window that
 * fails to contain the journey.
 */
export interface TransitPlace {
  /** Opaque stop identifier from the journey planner, for example `NSR:StopPlace:2952`. */
  id: string;
  name: string;
}

/** Whether `targetMinute` is the arrival deadline or the earliest acceptable departure. */
export type TransitTimeMode = 'arriveBy' | 'departAfter';

export interface TransitJourney {
  id: string;
  name: string;
  from: TransitPlace;
  to: TransitPlace;
  timeMode: TransitTimeMode;
  /**
   * Minutes from local midnight. The arrival deadline in `arriveBy` mode, the earliest departure
   * in `departAfter` mode.
   */
  targetMinute: number;
  /** How long before the target time the journey becomes the dashboard's active one. */
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
/**
 * How long a `departAfter` journey outlives its own time. The target is a floor, not a deadline, so
 * dropping it the minute it passes would hide the journey home from anyone still standing there.
 */
export const TRANSIT_DEPART_TRAIL_MINUTES = 60;

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
  // `arriveByMinute` is what journeys saved before the timing mode existed carry.
  const targetMinute = clampInteger(
    value.targetMinute ?? value.arriveByMinute,
    0,
    MINUTES_PER_DAY - 1
  );
  const weekdays = normalizeWeekdays(value.weekdays);

  if (id.length === 0 || !from || !to || targetMinute === null || weekdays.length === 0) {
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
    timeMode: value.timeMode === 'departAfter' ? 'departAfter' : 'arriveBy',
    targetMinute,
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

function trailMs(journey: TransitJourney): number {
  return journey.timeMode === 'departAfter' ? TRANSIT_DEPART_TRAIL_MINUTES * 60_000 : 0;
}

/**
 * The journey's next target time in local time: the arrival deadline, or the earliest departure.
 * Today counts while its target has not passed, plus the depart-after trail; a journey with no
 * weekdays never occurs.
 */
export function nextJourneyTarget(journey: TransitJourney, now: Date): Date | null {
  if (journey.weekdays.length === 0) {
    return null;
  }

  const trail = trailMs(journey);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(0, journey.targetMinute, 0, 0);

    if (
      candidate.getTime() + trail >= now.getTime() &&
      journey.weekdays.includes(candidate.getDay())
    ) {
      return candidate;
    }
  }

  return null;
}

/**
 * When to ask the journey planner about. An arrive-by journey always asks about its deadline. A
 * depart-after journey asks about its target until that passes, then rolls forward with the clock
 * so the board never offers departures that have already gone. Rounded down to the whole minute so
 * a ticking clock does not produce a new request every few seconds.
 */
export function journeySearchTime(journey: TransitJourney, target: Date, now: Date): Date {
  if (journey.timeMode !== 'departAfter' || now.getTime() <= target.getTime()) {
    return target;
  }

  const floored = new Date(now);
  floored.setSeconds(0, 0);
  return floored;
}

export function isJourneyActiveAt(journey: TransitJourney, now: Date): boolean {
  const target = nextJourneyTarget(journey, now);
  if (!target) {
    return false;
  }

  return target.getTime() - now.getTime() <= journey.leadMinutes * 60_000;
}

export interface TransitJourneyOccurrence {
  journey: TransitJourney;
  target: Date;
  /** The moment handed to the journey planner, which for a depart-after journey rolls with `now`. */
  searchTime: Date;
  active: boolean;
}

/**
 * What the card should render right now: every journey inside its lead window, earliest target
 * first. Outside every window it rolls forward to the single next journey, so an evening dashboard
 * shows tomorrow morning's run instead of an empty card.
 */
export function resolveTransitBoard(
  journeys: TransitJourney[],
  now: Date
): TransitJourneyOccurrence[] {
  const occurrences: TransitJourneyOccurrence[] = [];
  for (const journey of journeys) {
    const target = nextJourneyTarget(journey, now);
    if (!target) {
      continue;
    }
    occurrences.push({
      journey,
      target,
      searchTime: journeySearchTime(journey, target, now),
      active: target.getTime() - now.getTime() <= journey.leadMinutes * 60_000,
    });
  }

  occurrences.sort((left, right) => left.target.getTime() - right.target.getTime());

  const active = occurrences.filter((occurrence) => occurrence.active);
  return active.length > 0 ? active : occurrences.slice(0, 1);
}
