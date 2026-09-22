import type {
  IntegrationProviderRuntimeRegistration,
  ProviderContractRegistration,
} from '@navet/core/provider-runtime-types';
import { icloudCalendarFeatureService } from './icloud-calendar-feature.service';
import { icloudEntityRuntimeService } from './icloud-snapshot';

export function createICloudRuntimeRegistration(
  registration: ProviderContractRegistration
): IntegrationProviderRuntimeRegistration {
  return {
    providerContractAdapter: registration.providerContractAdapter,
    contract: registration.contract,
    implementationStatus: 'implemented',
    capabilities: {
      pathSigning: false,
      cameraStreams: false,
    },
    featureMatrix: {
      rooms: false,
      lighting: false,
      sensors: false,
      climate: false,
      mediaControls: false,
      mediaBrowse: false,
      mediaArtwork: false,
      cameraSnapshot: false,
      cameraStreams: false,
      energyNow: false,
      calendar: true,
      weather: false,
      notifications: false,
      tasks: false,
      conversation: false,
    },
    entityRuntimeService: icloudEntityRuntimeService,
    calendarFeatureService: icloudCalendarFeatureService,
  };
}
