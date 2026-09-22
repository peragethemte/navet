import { useSettingsStore } from '@navet/app/stores/settings-store';
import { isSameGeoLocation } from '@navet/core/geo-location';
import type { YrLocationSource } from '@navet/provider-yr';

/**
 * Bridges the shared `weatherLocation` setting into the Yr.no provider package, which owns no app
 * state of its own. The listener only fires on a real value change so that unrelated settings
 * writes - or a rename that keeps the same coordinates - do not restart the forecast poll.
 */
export const weatherLocationSource: YrLocationSource = {
  getLocation: () => useSettingsStore.getState().weatherLocation,
  subscribe: (listener) =>
    useSettingsStore.subscribe((state, previousState) => {
      if (!isSameGeoLocation(state.weatherLocation, previousState.weatherLocation)) {
        listener();
      }
    }),
};
