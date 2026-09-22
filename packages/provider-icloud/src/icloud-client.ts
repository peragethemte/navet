import type { ICloudSnapshot } from './icloud-types';

const PROXY_BASE_PATH = '/__navet_icloud_proxy__';
// The sidecar polls iCloud on its own schedule, so this only decides how often the browser asks
// it for the snapshot it already holds. Well under the app's own five-minute calendar refresh.
const SNAPSHOT_CACHE_TTL_MS = 60 * 1000;

interface CacheEntry {
  value: ICloudSnapshot;
  fetchedAt: number;
}

let snapshotCache: CacheEntry | null = null;
let pendingRequest: Promise<ICloudSnapshot | null> | null = null;

/**
 * Fetch the whole snapshot once and let every caller share it.
 *
 * navet asks for events one calendar entity at a time, in parallel, so without the in-flight
 * dedupe a household with ten calendars would issue ten identical requests per refresh.
 */
export async function getICloudSnapshot(): Promise<ICloudSnapshot | null> {
  if (snapshotCache && Date.now() - snapshotCache.fetchedAt < SNAPSHOT_CACHE_TTL_MS) {
    return snapshotCache.value;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = requestSnapshot().finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
}

async function requestSnapshot(): Promise<ICloudSnapshot | null> {
  try {
    const response = await fetch(`${PROXY_BASE_PATH}/calendar/events`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      // A 401 here is the proxy's auth gate, which the first request after a reload can lose a
      // race with. Keep serving the last snapshot rather than blanking the card.
      return snapshotCache?.value ?? null;
    }

    const snapshot = (await response.json()) as ICloudSnapshot;
    snapshotCache = { value: snapshot, fetchedAt: Date.now() };
    return snapshot;
  } catch {
    return snapshotCache?.value ?? null;
  }
}

/** Test seam: drops the cached snapshot so a suite can start from a known state. */
export function resetICloudClientCache(): void {
  snapshotCache = null;
  pendingRequest = null;
}
