import type { NavetProviderContract } from '@navet/core/provider-contract';
import {
  ensureYrPolling,
  getYrProviderState,
  stopYrPolling,
  subscribeYrProviderState,
} from './yr-snapshot';

export function createYrProviderContract(): NavetProviderContract {
  return {
    providerId: 'yr',
    // No interactive login exists for this provider: it is always on once its location is
    // configured server-side, so bootstrapping never depends on the shared auth session map.
    bootstrapSession: () => ({ providerId: 'yr', connected: true }),
    initializeSession: async () => {
      ensureYrPolling();
    },
    teardownSession: () => {
      stopYrPolling();
    },
    getState: getYrProviderState,
    subscribeState: subscribeYrProviderState,
    resolveResource: (request) => ({
      id: request.deviceId,
      kind: 'unavailable',
      cacheKey: request.deviceId,
      authStrategy: 'none',
    }),
    normalizeResourceUrl: (resourceUrl) => resourceUrl,
  };
}
