import { weatherLocationSource } from '@navet/app/services/weather-location.service';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import { resetAppStores } from '@navet/app/test/store-reset';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SARPSBORG = { latitude: 59.2839, longitude: 11.1094, name: 'Sarpsborg' };

describe('weatherLocationSource', () => {
  beforeEach(async () => {
    await resetAppStores();
  });

  it('reads the configured location from the settings store', () => {
    expect(weatherLocationSource.getLocation()).toBeNull();

    useSettingsStore.getState().updateSettings({ weatherLocation: SARPSBORG });

    expect(weatherLocationSource.getLocation()).toEqual(SARPSBORG);
  });

  it('notifies on a real location change', () => {
    const listener = vi.fn();
    const unsubscribe = weatherLocationSource.subscribe(listener);

    useSettingsStore.getState().updateSettings({ weatherLocation: SARPSBORG });
    expect(listener).toHaveBeenCalledTimes(1);

    useSettingsStore.getState().updateSettings({ weatherLocation: { ...SARPSBORG, name: 'Home' } });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('stays quiet for unrelated settings writes and for an unchanged location', () => {
    useSettingsStore.getState().updateSettings({ weatherLocation: SARPSBORG });
    const listener = vi.fn();
    const unsubscribe = weatherLocationSource.subscribe(listener);

    useSettingsStore.getState().updateSettings({ use24HourTime: true });
    useSettingsStore.getState().updateSettings({ weatherLocation: { ...SARPSBORG } });

    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    weatherLocationSource.subscribe(listener)();

    useSettingsStore.getState().updateSettings({ weatherLocation: SARPSBORG });

    expect(listener).not.toHaveBeenCalled();
  });
});
