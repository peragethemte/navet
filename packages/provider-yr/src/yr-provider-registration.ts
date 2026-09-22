import { INTEGRATION_PROVIDERS } from '@navet/core/integration-providers';
import type {
  ProviderContractRegistration,
  ProviderPackageRegistration,
} from '@navet/core/provider-runtime-types';
import { createSnapshotBackedProviderAdapter } from '@navet/core/snapshot-backed-adapter';
import { createYrProviderContract } from './yr-contract';
import { setYrLocationSource, type YrLocationSource } from './yr-location-source';
import { createYrRuntimeRegistration } from './yr-runtime-registration';

export interface YrProviderRegistrationOptions {
  /** Supplies the user-configured weather location. Omit to use only the server-side defaults. */
  locationSource?: YrLocationSource;
}

export function createYrProviderContractRegistration(): ProviderContractRegistration {
  const contract = createYrProviderContract();

  return {
    contract,
    providerContractAdapter: createSnapshotBackedProviderAdapter({
      providerId: 'yr',
      providerLabel: INTEGRATION_PROVIDERS.yr.label,
      contract,
      executeCommand: async () => {
        throw new Error('Yr.no weather does not support commands');
      },
      getSession: () => ({ providerId: 'yr' }),
    }),
  };
}

export function createYrProviderPackageRegistration(
  options: YrProviderRegistrationOptions = {}
): ProviderPackageRegistration {
  setYrLocationSource(options.locationSource ?? null);
  const contractRegistration = createYrProviderContractRegistration();

  return {
    ...contractRegistration,
    runtimeRegistration: createYrRuntimeRegistration(contractRegistration),
  };
}
