import { createProviderScopedMetadata } from '@navet/core/ids';
import type {
  PlatformEntityRegistryEntry,
  PlatformEntitySnapshotMap,
} from '@navet/core/provider-feature-models';
import type { ProviderEntityRuntimeService } from '@navet/core/provider-feature-services';
import type { NavetEntity, NavetProviderRoom, NavetProviderState } from '@navet/core/types';
import { getYrForecast, getYrStatus, getYrSunTimes } from './yr-client';
import { mapYrSymbolCodeToCondition } from './yr-condition-mapping';
import { pickEntryPrecipitation, pickEntrySymbolCode } from './yr-forecast-utils';

export const YR_NATIVE_ENTITY_ID = 'weather.forecast';
// Matches the forecast cache TTL: no point polling the client-side snapshot more often
// than the underlying data can change.
const STEADY_STATE_INTERVAL_MS = 30 * 60 * 1000;
// The very first refresh can race the app's own authentication handshake (the proxy requires
// an authenticated caller): back off and retry quickly instead of waiting a full interval.
const ERROR_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
const EMPTY_REGISTRY: PlatformEntityRegistryEntry[] = [];

interface YrWeatherData {
  conditionState: string;
  attributes: Record<string, unknown>;
  lastUpdated: string;
}

type RefreshOutcome = 'success' | 'not_configured' | 'error';

const EMPTY_SNAPSHOTS: PlatformEntitySnapshotMap = {};
const EMPTY_ENTITIES: NavetEntity[] = [];
const EMPTY_ROOMS: NavetProviderRoom[] = [];

let currentData: YrWeatherData | null = null;
// useSyncExternalStore requires a referentially stable snapshot between calls when nothing
// changed, so the derived entity/snapshot views are built once per refresh, not per read.
let currentEntities: NavetEntity[] = EMPTY_ENTITIES;
let currentSnapshots: PlatformEntitySnapshotMap = EMPTY_SNAPSHOTS;
let connected = false;
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
  currentData = null;
  currentEntities = EMPTY_ENTITIES;
  currentSnapshots = EMPTY_SNAPSHOTS;
}

function setCurrentData(data: YrWeatherData): void {
  currentData = data;
  currentEntities = [buildNavetEntity(data)];
  currentSnapshots = {
    [YR_NATIVE_ENTITY_ID]: {
      entityId: YR_NATIVE_ENTITY_ID,
      state: data.conditionState,
      attributes: data.attributes,
      lastUpdated: data.lastUpdated,
    },
  };
}

async function refresh(): Promise<RefreshOutcome> {
  try {
    const status = await getYrStatus();
    if (!status) {
      // Could not determine status right now (e.g. this raced app authentication) - retry
      // soon rather than treating it as a confirmed "not configured" answer.
      connected = false;
      lastError = 'Unable to reach the Yr.no proxy';
      notifyListeners();
      return 'error';
    }
    if (!status.configured) {
      connected = false;
      lastError = null;
      clearCurrentData();
      notifyListeners();
      return 'not_configured';
    }

    const forecast = await getYrForecast();
    const latest = forecast?.properties?.timeseries?.[0];
    if (!latest) {
      connected = false;
      lastError = 'No Yr.no forecast data is available yet';
      notifyListeners();
      return 'error';
    }

    const sunTimes = await getYrSunTimes(new Date());
    const locationName = status.locationName?.trim() || 'Yr.no';
    const details = latest.data.instant?.details ?? {};

    setCurrentData({
      conditionState: mapYrSymbolCodeToCondition(pickEntrySymbolCode(latest)),
      attributes: {
        friendly_name: locationName,
        location: locationName,
        temperature: details.air_temperature ?? null,
        native_unit_of_measurement: '°C',
        humidity: details.relative_humidity ?? null,
        wind_speed: details.wind_speed ?? null,
        wind_speed_unit: 'm/s',
        pressure: details.air_pressure_at_sea_level ?? null,
        pressure_unit: 'hPa',
        cloud_coverage: details.cloud_area_fraction ?? null,
        precipitation: pickEntryPrecipitation(latest) ?? 0,
        precipitation_unit: 'mm',
        sunrise: sunTimes.sunrise,
        sunset: sunTimes.sunset,
      },
      lastUpdated: latest.time,
    });
    connected = true;
    lastError = null;
    notifyListeners();
    return 'success';
  } catch (error) {
    connected = false;
    lastError = error instanceof Error ? error.message : 'Unable to load Yr.no forecast';
    notifyListeners();
    return 'error';
  }
}

function scheduleNextRefresh(delayMs: number): void {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId);
  }
  refreshTimerId = setTimeout(() => void runRefreshCycle(), delayMs);
}

async function runRefreshCycle(): Promise<void> {
  const outcome = await refresh();
  if (outcome === 'error') {
    const delay = ERROR_RETRY_DELAYS_MS[Math.min(retryAttempt, ERROR_RETRY_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    scheduleNextRefresh(delay);
    return;
  }

  retryAttempt = 0;
  scheduleNextRefresh(STEADY_STATE_INTERVAL_MS);
}

export function ensureYrPolling(): void {
  if (pollingStarted) {
    return;
  }

  pollingStarted = true;
  void runRefreshCycle();
}

export function stopYrPolling(): void {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
  pollingStarted = false;
  retryAttempt = 0;
}

function buildNavetEntity(data: YrWeatherData): NavetEntity {
  const metadata = createProviderScopedMetadata('yr', YR_NATIVE_ENTITY_ID);

  return {
    id: metadata.canonicalId,
    canonicalId: metadata.canonicalId,
    providerId: 'yr',
    externalId: metadata.nativeId,
    type: 'weather',
    name:
      typeof data.attributes.friendly_name === 'string' ? data.attributes.friendly_name : 'Yr.no',
    primaryState: data.conditionState,
    availability: 'available',
    attributes: data.attributes,
    capabilities: [],
    lastUpdated: data.lastUpdated,
  };
}

export function getYrProviderState(): NavetProviderState {
  ensureYrPolling();

  return {
    providerId: 'yr',
    connected,
    connecting: false,
    reconnecting: false,
    entitiesHydrated: currentData !== null,
    registriesHydrated: true,
    error: lastError,
    entities: currentEntities,
    rooms: EMPTY_ROOMS,
  };
}

export function subscribeYrProviderState(listener: () => void): () => void {
  ensureYrPolling();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getYrEntitySnapshots(): PlatformEntitySnapshotMap {
  ensureYrPolling();
  return currentSnapshots;
}

export const yrEntityRuntimeService: ProviderEntityRuntimeService = {
  getEntitySnapshots: getYrEntitySnapshots,
  subscribeEntitySnapshots: subscribeYrProviderState,
  getEntityRegistryEntries: () => EMPTY_REGISTRY,
  subscribeEntityRegistryEntries: () => () => {},
  getConfig: () => null,
  subscribeConfig: () => () => {},
};
