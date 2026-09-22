import type { NavetProviderContract } from '@navet/core/provider-contract';
import {
  ensureICloudPolling,
  getICloudProviderState,
  stopICloudPolling,
  subscribeICloudProviderState,
} from './icloud-snapshot';

export function createICloudProviderContract(): NavetProviderContract {
  return {
    providerId: 'icloud',
    // No interactive login exists for this provider: it is always on once the Apple ID is
    // configured server-side, so bootstrapping never depends on the shared auth session map.
    bootstrapSession: () => ({ providerId: 'icloud', connected: true }),
    initializeSession: async () => {
      ensureICloudPolling();
    },
    teardownSession: () => {
      stopICloudPolling();
    },
    getState: getICloudProviderState,
    subscribeState: subscribeICloudProviderState,
    resolveResource: (request) => ({
      id: request.deviceId,
      kind: 'unavailable',
      cacheKey: request.deviceId,
      authStrategy: 'none',
    }),
    normalizeResourceUrl: (resourceUrl) => resourceUrl,
  };
}
