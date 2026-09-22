import { Button } from '@navet/app/components/primitives/button';
import { Input } from '@navet/app/components/primitives/input';
import { navetTypographyTokens } from '@navet/app/components/system/tokens';
import { cn } from '@navet/app/components/ui/utils';
import { useI18n } from '@navet/app/hooks';
import type { WeatherLocation } from '@navet/app/stores/settings-store';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import {
  formatCoordinate,
  GEO_LOCATION_NAME_MAX_LENGTH,
  isValidLatitude,
  isValidLongitude,
  parseCoordinate,
  roundCoordinate,
} from '@navet/core/geo-location';
import { LocateFixed, MapPin } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { SettingsSectionStyles } from '../hooks/settings-section-styles';
import type { SettingsSectionController } from '../hooks/use-settings-section-controller';
import { SettingsItem, SettingsSectionShell } from './settings-section-shell';

interface SettingsLocalSectionProps {
  controller: SettingsSectionController;
}

interface LocationDraft {
  latitude: string;
  longitude: string;
  name: string;
}

const EMPTY_DRAFT: LocationDraft = { latitude: '', longitude: '', name: '' };
const DEVICE_LOCATION_TIMEOUT_MS = 10_000;

function toDraft(location: WeatherLocation | null): LocationDraft {
  if (!location) {
    return EMPTY_DRAFT;
  }

  return {
    latitude: formatCoordinate(location.latitude),
    longitude: formatCoordinate(location.longitude),
    name: location.name,
  };
}

function locationKey(location: WeatherLocation | null): string {
  return location ? `${location.latitude}|${location.longitude}|${location.name}` : '';
}

function Field({
  children,
  id,
  label,
  styles,
}: {
  children: ReactNode;
  id: string;
  label: string;
  styles: SettingsSectionStyles;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className={cn('px-1', navetTypographyTokens.caption, 'font-medium', styles.subtleColor)}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function SettingsLocalSection({ controller }: SettingsLocalSectionProps) {
  const { t } = useI18n();
  const { styles } = controller;
  const weatherLocation = useSettingsStore((state) => state.weatherLocation);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const [draft, setDraft] = useState(() => toDraft(weatherLocation));
  const [deviceLocationState, setDeviceLocationState] = useState<'idle' | 'locating' | 'error'>(
    'idle'
  );
  // Tracks the persisted value this section itself produced so a remote profile sync can refill
  // the fields without reformatting what the user is still typing.
  const appliedKeyRef = useRef(locationKey(weatherLocation));

  const persistedKey = locationKey(weatherLocation);
  useEffect(() => {
    if (appliedKeyRef.current === persistedKey) {
      return;
    }

    appliedKeyRef.current = persistedKey;
    setDraft(toDraft(weatherLocation));
  }, [persistedKey, weatherLocation]);

  const latitude = parseCoordinate(draft.latitude);
  const longitude = parseCoordinate(draft.longitude);
  const hasLatitude = draft.latitude.trim().length > 0;
  const hasLongitude = draft.longitude.trim().length > 0;
  const latitudeInvalid = hasLatitude && !isValidLatitude(latitude);
  const longitudeInvalid = hasLongitude && !isValidLongitude(longitude);
  const incomplete = hasLatitude !== hasLongitude;

  const applyDraft = (next: LocationDraft) => {
    setDraft(next);
    // Typing is the recovery path the failed lookup asked for, so retire its message.
    setDeviceLocationState('idle');

    if (next.latitude.trim().length === 0 && next.longitude.trim().length === 0) {
      appliedKeyRef.current = '';
      updateSettings({ weatherLocation: null });
      return;
    }

    const nextLatitude = parseCoordinate(next.latitude);
    const nextLongitude = parseCoordinate(next.longitude);
    if (!isValidLatitude(nextLatitude) || !isValidLongitude(nextLongitude)) {
      // Keep the last valid location in place until the coordinates make sense again.
      return;
    }

    const location: WeatherLocation = {
      latitude: roundCoordinate(nextLatitude),
      longitude: roundCoordinate(nextLongitude),
      name: next.name.trim().slice(0, GEO_LOCATION_NAME_MAX_LENGTH),
    };
    appliedKeyRef.current = locationKey(location);
    updateSettings({ weatherLocation: location });
  };

  const supportsDeviceLocation = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const useDeviceLocation = () => {
    setDeviceLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyDraft({
          latitude: formatCoordinate(position.coords.latitude),
          longitude: formatCoordinate(position.coords.longitude),
          name: draft.name,
        });
      },
      () => setDeviceLocationState('error'),
      { timeout: DEVICE_LOCATION_TIMEOUT_MS }
    );
  };

  const errorMessage = latitudeInvalid
    ? t('settings.local.weatherLocation.latitudeError')
    : longitudeInvalid
      ? t('settings.local.weatherLocation.longitudeError')
      : incomplete
        ? t('settings.local.weatherLocation.incompleteError')
        : deviceLocationState === 'error'
          ? t('settings.local.weatherLocation.deviceLocationError')
          : null;

  return (
    <SettingsSectionShell
      id="local"
      icon={MapPin}
      title={t('settings.local.sectionTitle')}
      description={t('settings.local.sectionDescription')}
      styles={styles}
    >
      <SettingsItem
        title={t('settings.local.weatherLocation.title')}
        description={t('settings.local.weatherLocation.description')}
        styles={styles}
      >
        <div className="grid max-w-xl gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="weather-location-latitude"
              label={t('settings.local.weatherLocation.latitude')}
              styles={styles}
            >
              <Input
                id="weather-location-latitude"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.latitude}
                invalid={latitudeInvalid}
                placeholder="59.2839"
                onChange={(event) => applyDraft({ ...draft, latitude: event.currentTarget.value })}
              />
            </Field>
            <Field
              id="weather-location-longitude"
              label={t('settings.local.weatherLocation.longitude')}
              styles={styles}
            >
              <Input
                id="weather-location-longitude"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.longitude}
                invalid={longitudeInvalid}
                placeholder="11.1094"
                onChange={(event) => applyDraft({ ...draft, longitude: event.currentTarget.value })}
              />
            </Field>
          </div>

          <Field
            id="weather-location-name"
            label={t('settings.local.weatherLocation.name')}
            styles={styles}
          >
            <Input
              id="weather-location-name"
              type="text"
              autoComplete="off"
              maxLength={GEO_LOCATION_NAME_MAX_LENGTH}
              value={draft.name}
              placeholder={t('settings.local.weatherLocation.namePlaceholder')}
              onChange={(event) => applyDraft({ ...draft, name: event.currentTarget.value })}
            />
          </Field>

          {errorMessage ? (
            <p role="alert" className="text-sm leading-5 text-red-400">
              {errorMessage}
            </p>
          ) : (
            <p className={cn('text-sm leading-5', styles.subtleColor)}>
              {weatherLocation
                ? t('settings.local.weatherLocation.hint')
                : t('settings.local.weatherLocation.usingServerDefault')}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {supportsDeviceLocation ? (
              <Button
                type="button"
                variant="secondary"
                size="small"
                className="rounded-full"
                leading={<LocateFixed className="h-4 w-4" />}
                loading={deviceLocationState === 'locating'}
                onClick={useDeviceLocation}
              >
                {t('settings.local.weatherLocation.useDeviceLocation')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="small"
              className="rounded-full"
              disabled={weatherLocation === null && draft === EMPTY_DRAFT}
              onClick={() => applyDraft(EMPTY_DRAFT)}
            >
              {t('settings.local.weatherLocation.useServerDefault')}
            </Button>
          </div>
        </div>
      </SettingsItem>
    </SettingsSectionShell>
  );
}
