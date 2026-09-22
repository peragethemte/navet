import { runProviderPackageRegistrationTests } from '@navet/core/provider-package-test-suite';
import { describe, expect, it } from 'vitest';
import { createICloudProviderPackageRegistration } from './icloud-provider-registration';

runProviderPackageRegistrationTests({
  providerName: 'iCloud Calendar',
  providerId: 'icloud',
  createRegistration: createICloudProviderPackageRegistration,
  expectedStatus: 'implemented',
  supportedFeatures: ['calendar'],
  unsupportedFeatures: ['rooms', 'lighting', 'sensors', 'climate', 'weather', 'conversation'],
});

describe('iCloud provider package registration', () => {
  it('registers the calendar feature service and an entity runtime service', () => {
    const { runtimeRegistration } = createICloudProviderPackageRegistration();

    expect(runtimeRegistration.calendarFeatureService).toBeDefined();
    expect(runtimeRegistration.entityRuntimeService).toBeDefined();
    expect(runtimeRegistration.weatherFeatureService).toBeUndefined();
  });

  it('rejects commands rather than pretending to support them', async () => {
    const { providerContractAdapter } = createICloudProviderPackageRegistration();

    // A read-only provider must never resolve a command. With no entities loaded the adapter
    // rejects on entity lookup, before it would reach the throwing command translator.
    await expect(
      providerContractAdapter.execute({
        type: 'turn_on',
        entityId: 'icloud:calendar.familie',
      })
    ).rejects.toThrow();
  });

  it('bootstraps without an interactive session', () => {
    const { contract } = createICloudProviderPackageRegistration();

    expect(contract.bootstrapSession?.({})).toEqual({ providerId: 'icloud', connected: true });
  });
});
