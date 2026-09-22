import { INTEGRATION_PROVIDERS } from '@navet/core/integration-providers';
import type {
  ProviderContractRegistration,
  ProviderPackageRegistration,
} from '@navet/core/provider-runtime-types';
import { createSnapshotBackedProviderAdapter } from '@navet/core/snapshot-backed-adapter';
import { createYrProviderContract } from './yr-contract';
import { createYrRuntimeRegistration } from './yr-runtime-registration';

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

export function createYrProviderPackageRegistration(): ProviderPackageRegistration {
  const contractRegistration = createYrProviderContractRegistration();

  return {
    ...contractRegistration,
    runtimeRegistration: createYrRuntimeRegistration(contractRegistration),
  };
}
