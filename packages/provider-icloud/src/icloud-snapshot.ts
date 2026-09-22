import { createProviderScopedMetadata } from '@navet/core/ids';
import type {
  PlatformEntityRegistryEntry,
  PlatformEntitySnapshotMap,
} from '@navet/core/provider-feature-models';
import type { ProviderEntityRuntimeService } from '@navet/core/provider-feature-services';
import type { NavetEntity, NavetProviderRoom, NavetProviderState } from '@navet/core/types';
import { getICloudSnapshot } from './icloud-client';
import type { ICloudCalendar, ICloudEvent } from './icloud-types';

// Which calendars exist changes far less often than what is in them, and the events themselves
// arrive through the calendar feature service on its own schedule.
const STEADY_STATE_INTERVAL_MS = 15 * 60 * 1000;
// The very first refresh can race the app's authentication handshake (the proxy requires an
// authenticated caller): back off and retry quickly instead of waiting a full interval.
const ERROR_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
const EMPTY_REGISTRY: PlatformEntityRegistryEntry[] = [];
const EMPTY_SNAPSHOTS: PlatformEntitySnapshotMap = {};
const EMPTY_ENTITIES: NavetEntity[] = [];
const EMPTY_ROOMS: NavetProviderRoom[] = [];

type RefreshOutcome = 'success' | 'not_configured' | 'error';

// useSyncExternalStore requires a referentially stable snapshot between calls when nothing
// changed, so the derived views are built once per refresh, not per read.
let currentEntities: NavetEntity[] = EMPTY_ENTITIES;
let currentSnapshots: PlatformEntitySnapshotMap = EMPTY_SNAPSHOTS;
let connected = false;
// An account with no calendars is still hydrated, so this cannot be derived from the entity list.
let hydrated = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();
let pollingStarted = false;
let refreshTimerId: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function clearCurrentData(): void {
  currentEntities = EMPTY_ENTITIES;
  currentSnapshots = EMPTY_SNAPSHOTS;
  hydrated = false;
}

function setCurrentData(calendars: ICloudCalendar[], lastUpdated: string): void {
  const entities: NavetEntity[] = [];
  const snapshots: PlatformEntitySnapshotMap = {};

  for (const calendar of calendars) {
    const state = isBusy(calendar.events) ? 'on' : 'off';
    const attributes = { friendly_name: calendar.name };
    snapshots[calendar.entityId] = {
      entityId: calendar.entityId,
      state,
      attributes,
      lastUpdated,
    };
    entities.push(buildNavetEntity(calendar, state, attributes, lastUpdated));
  }

  currentEntities = entities;
  currentSnapshots = snapshots;
  hydrated = true;
}

/** Home Assistant reports a calendar entity as `on` while an event is under way; match that. */
function isBusy(events: ICloudEvent[]): boolean {
  const now = Date.now();

  return events.some((event) => {
    const start = toTimestamp(event.start.dateTime ?? event.start.date);
    const end = toTimestamp(event.end.dateTime ?? event.end.date);
    return start !== null && end !== null && start <= now && now < end;
  });
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildNavetEntity(
  calendar: ICloudCalendar,
  state: string,
  attributes: Record<string, unknown>,
  lastUpdated: string
): NavetEntity {
  const metadata = createProviderScopedMetadata('icloud', calendar.entityId);

  return {
    id: metadata.canonicalId,
    canonicalId: metadata.canonicalId,
    providerId: 'icloud',
    externalId: metadata.nativeId,
    type: 'calendar',
    name: calendar.name,
    primaryState: state,
    availability: 'available',
    attributes,
    capabilities: [],
    lastUpdated,
  };
}

async function refresh(): Promise<RefreshOutcome> {
  const snapshot = await getICloudSnapshot();
  if (!snapshot) {
    // Could not reach the sidecar right now (e.g. this raced app authentication) - retry soon
    // rather than treating it as a confirmed answer.
    connected = false;
    lastError = 'Unable to reach the iCloud sidecar';
    notifyListeners();
    return 'error';
  }

  if (!snapshot.configured) {
    connected = false;
    lastError = null;
    clearCurrentData();
    notifyListeners();
    return 'not_configured';
  }

  setCurrentData(snapshot.calendars, snapshot.fetchedAt ?? new Date().toISOString());
  connected = true;
  // A stale snapshot still renders; surfacing it as an error would hide the events that are
  // there. The sidecar keeps retrying underneath.
  lastError = null;
  notifyListeners();
  return 'success';
}

function scheduleNextRefresh(delayMs: number): void {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId);
  }
  refreshTimerId = setTimeout(() => void runRefreshCycle(), delayMs);
}

async function runRefreshCycle(): Promise<void> {
  let outcome: RefreshOutcome;
  try {
    outcome = await refresh();
  } catch (error) {
    connected = false;
    lastError = error instanceof Error ? error.message : 'Unable to load iCloud calendars';
    notifyListeners();
    outcome = 'error';
  }

  if (outcome === 'error') {
    const delay = ERROR_RETRY_DELAYS_MS[Math.min(retryAttempt, ERROR_RETRY_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    scheduleNextRefresh(delay);
    return;
  }

  retryAttempt = 0;
  scheduleNextRefresh(STEADY_STATE_INTERVAL_MS);
}

export function ensureICloudPolling(): void {
  if (pollingStarted) {
    return;
  }

  pollingStarted = true;
  void runRefreshCycle();
}

export function stopICloudPolling(): void {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
  pollingStarted = false;
  retryAttempt = 0;
}

export function getICloudProviderState(): NavetProviderState {
  ensureICloudPolling();

  return {
    providerId: 'icloud',
    connected,
    connecting: false,
    reconnecting: false,
    entitiesHydrated: hydrated,
    registriesHydrated: true,
    error: lastError,
    entities: currentEntities,
    rooms: EMPTY_ROOMS,
  };
}

export function subscribeICloudProviderState(listener: () => void): () => void {
  ensureICloudPolling();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getICloudEntitySnapshots(): PlatformEntitySnapshotMap {
  ensureICloudPolling();
  return currentSnapshots;
}

export const icloudEntityRuntimeService: ProviderEntityRuntimeService = {
  getEntitySnapshots: getICloudEntitySnapshots,
  subscribeEntitySnapshots: subscribeICloudProviderState,
  getEntityRegistryEntries: () => EMPTY_REGISTRY,
  subscribeEntityRegistryEntries: () => () => {},
  getConfig: () => null,
  subscribeConfig: () => () => {},
};
