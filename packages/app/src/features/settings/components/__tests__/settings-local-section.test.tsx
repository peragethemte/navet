import { useSettingsSectionController } from '@navet/app/features/settings/hooks/use-settings-section-controller';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import { renderWithProviders } from '@navet/app/test/render';
import { resetAppStores } from '@navet/app/test/store-reset';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsLocalSection } from '../settings-local-section';

function TestSection() {
  const controller = useSettingsSectionController();
  return <SettingsLocalSection controller={controller} />;
}

function typeCoordinates(latitude: string, longitude: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
    target: { value: latitude },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Longitude' }), {
    target: { value: longitude },
  });
}

type GeolocationBehavior = (onSuccess: PositionCallback, onError: () => void) => void;

function withGeolocation(behavior: GeolocationBehavior) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (onSuccess: PositionCallback, onError: () => void) =>
        behavior(onSuccess, onError),
    },
  });
}

describe('SettingsLocalSection', () => {
  beforeEach(async () => {
    await resetAppStores();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  it('starts on the server-configured location', () => {
    renderWithProviders(<TestSection />);

    expect(screen.getByText('Using the location configured on the server.')).toBeInTheDocument();
    expect(useSettingsStore.getState().weatherLocation).toBeNull();
  });

  it('persists a valid coordinate pair with its display name', () => {
    renderWithProviders(<TestSection />);

    typeCoordinates('59.2839', '11.1094');
    fireEvent.change(screen.getByRole('textbox', { name: 'Place name' }), {
      target: { value: '  Sarpsborg  ' },
    });

    expect(useSettingsStore.getState().weatherLocation).toEqual({
      latitude: 59.2839,
      longitude: 11.1094,
      name: 'Sarpsborg',
    });
  });

  it('accepts a comma decimal separator', () => {
    renderWithProviders(<TestSection />);

    typeCoordinates('59,3', '11,1');

    expect(useSettingsStore.getState().weatherLocation).toEqual({
      latitude: 59.3,
      longitude: 11.1,
      name: '',
    });
  });

  it('rounds to the four decimals met.no asks callers to send', () => {
    renderWithProviders(<TestSection />);

    typeCoordinates('59.28394857', '11.10941234');

    expect(useSettingsStore.getState().weatherLocation).toMatchObject({
      latitude: 59.2839,
      longitude: 11.1094,
    });
  });

  it('reports an out-of-range latitude and keeps the last valid location', () => {
    renderWithProviders(<TestSection />);

    typeCoordinates('59.3', '11.1');
    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: '95' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Latitude must be a number between -90 and 90.'
    );
    expect(useSettingsStore.getState().weatherLocation).toMatchObject({ latitude: 59.3 });
  });

  it('reports an out-of-range longitude', () => {
    renderWithProviders(<TestSection />);

    typeCoordinates('59.3', '181');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Longitude must be a number between -180 and 180.'
    );
    expect(useSettingsStore.getState().weatherLocation).toBeNull();
  });

  it('asks for the missing half of an incomplete pair', () => {
    renderWithProviders(<TestSection />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: '59.3' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Enter both latitude and longitude.');
    expect(useSettingsStore.getState().weatherLocation).toBeNull();
  });

  it('rejects text that is not a number', () => {
    renderWithProviders(<TestSection />);

    typeCoordinates('Sarpsborg', '11.1');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(useSettingsStore.getState().weatherLocation).toBeNull();
  });

  it('falls back to the server location when both coordinates are cleared', () => {
    renderWithProviders(<TestSection />);

    typeCoordinates('59.3', '11.1');
    expect(useSettingsStore.getState().weatherLocation).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use server location' }));

    expect(useSettingsStore.getState().weatherLocation).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('');
    expect(screen.getByText('Using the location configured on the server.')).toBeInTheDocument();
  });

  it('hides the device-location shortcut where the browser has no geolocation', () => {
    renderWithProviders(<TestSection />);

    expect(screen.queryByRole('button', { name: 'Use this device' })).not.toBeInTheDocument();
  });

  it('fills the coordinates the device reports', () => {
    withGeolocation((onSuccess) =>
      onSuccess({ coords: { latitude: 60.391263, longitude: 5.322054 } } as GeolocationPosition)
    );
    renderWithProviders(<TestSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Use this device' }));

    expect(useSettingsStore.getState().weatherLocation).toMatchObject({
      latitude: 60.3913,
      longitude: 5.3221,
    });
  });

  it('explains a refused device location and clears the message once the user types', () => {
    withGeolocation((_onSuccess, onError) => onError());
    renderWithProviders(<TestSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Use this device' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This device could not share its location. Enter the coordinates instead.'
    );

    typeCoordinates('59.3', '11.1');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useSettingsStore.getState().weatherLocation).toMatchObject({ latitude: 59.3 });
  });

  it('refills the fields when the location changes elsewhere', () => {
    renderWithProviders(<TestSection />);

    act(() => {
      useSettingsStore
        .getState()
        .updateSettings({ weatherLocation: { latitude: 60.39, longitude: 5.32, name: 'Bergen' } });
    });

    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('60.39');
    expect(screen.getByRole('textbox', { name: 'Place name' })).toHaveValue('Bergen');
  });
});
