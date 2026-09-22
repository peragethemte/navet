import { INTEGRATION_PROVIDERS } from '@navet/core/integration-providers';
import type {
  ProviderContractRegistration,
  ProviderPackageRegistration,
} from '@navet/core/provider-runtime-types';
import { createSnapshotBackedProviderAdapter } from '@navet/core/snapshot-backed-adapter';
import { createICloudProviderContract } from './icloud-contract';
import { createICloudRuntimeRegistration } from './icloud-runtime-registration';

export function createICloudProviderContractRegistration(): ProviderContractRegistration {
  const contract = createICloudProviderContract();

  return {
    contract,
    providerContractAdapter: createSnapshotBackedProviderAdapter({
      providerId: 'icloud',
      providerLabel: INTEGRATION_PROVIDERS.icloud.label,
      contract,
      executeCommand: async () => {
        throw new Error('iCloud Calendar does not support commands');
      },
      // There is no interactive session to wait for; a minimal stub is what lets connect()
      // proceed for a provider configured entirely on the server.
      getSession: () => ({ providerId: 'icloud' }),
    }),
  };
}

export function createICloudProviderPackageRegistration(): ProviderPackageRegistration {
  const contractRegistration = createICloudProviderContractRegistration();

  return {
    ...contractRegistration,
    runtimeRegistration: createICloudRuntimeRegistration(contractRegistration),
  };
}
