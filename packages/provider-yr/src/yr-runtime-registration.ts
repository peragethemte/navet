import type {
  IntegrationProviderRuntimeRegistration,
  ProviderContractRegistration,
} from '@navet/core/provider-runtime-types';
import { yrEntityRuntimeService } from './yr-snapshot';
import { yrWeatherFeatureService } from './yr-weather-feature.service';

export function createYrRuntimeRegistration(
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
      calendar: false,
      weather: true,
      notifications: false,
      tasks: false,
      conversation: false,
    },
    entityRuntimeService: yrEntityRuntimeService,
    weatherFeatureService: yrWeatherFeatureService,
  };
}
