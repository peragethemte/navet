import { Button } from '@navet/app/components/primitives/button';
import { Input } from '@navet/app/components/primitives/input';
import { Select } from '@navet/app/components/primitives/select';
import { navetTypographyTokens } from '@navet/app/components/system/tokens';
import { cn } from '@navet/app/components/ui/utils';
import { searchTransitPlaces } from '@navet/app/features/transit/entur-client';
import type { TransitPlaceSuggestion } from '@navet/app/features/transit/entur-geocoder';
import { useI18n } from '@navet/app/hooks';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import {
  formatClockTime,
  parseClockTime,
  TRANSIT_JOURNEY_MAX_COUNT,
  TRANSIT_JOURNEY_NAME_MAX_LENGTH,
  TRANSIT_LEAD_MINUTES_DEFAULT,
  type TransitJourney,
  type TransitPlace,
  WEEKDAY_DISPLAY_ORDER,
} from '@navet/core/transit-journey';
import { Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { SettingsSectionStyles } from '../hooks/settings-section-styles';

const SEARCH_DEBOUNCE_MS = 300;
const LEAD_MINUTE_OPTIONS = [30, 60, 90, 120, 180, 240];
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

function createJourneyId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `journey:${crypto.randomUUID()}`;
  }
  return `journey:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createDraft(): TransitJourney {
  return {
    id: createJourneyId(),
    name: '',
    from: { id: '', name: '' },
    to: { id: '', name: '' },
    arriveByMinute: 8 * 60,
    leadMinutes: TRANSIT_LEAD_MINUTES_DEFAULT,
    weekdays: DEFAULT_WEEKDAYS,
  };
}

function isComplete(journey: TransitJourney): boolean {
  return journey.from.id.length > 0 && journey.to.id.length > 0 && journey.weekdays.length > 0;
}

/** A reference week starting on a Sunday, so `Date.getDay()` indexes it directly. */
const WEEKDAY_REFERENCE = new Date(2024, 0, 7);

function useWeekdayLabels(locale: string) {
  return useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    return WEEKDAY_DISPLAY_ORDER.map((day) => {
      const date = new Date(WEEKDAY_REFERENCE);
      date.setDate(WEEKDAY_REFERENCE.getDate() + day);
      return { day, short: short.format(date), long: long.format(date) };
    });
  }, [locale]);
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

function StopField({
  id,
  label,
  styles,
  value,
  onChange,
}: {
  id: string;
  label: string;
  styles: SettingsSectionStyles;
  value: TransitPlace;
  onChange: (place: TransitPlace) => void;
}) {
  const { t } = useI18n();
  const weatherLocation = useSettingsStore((state) => state.weatherLocation);
  const [query, setQuery] = useState(value.name);
  const [suggestions, setSuggestions] = useState<TransitPlaceSuggestion[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'error'>('idle');
  const selectedNameRef = useRef(value.name);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === selectedNameRef.current) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    setStatus('searching');
    const timer = setTimeout(() => {
      searchTransitPlaces(trimmed, { location: weatherLocation, signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) {
            setSuggestions(results);
            setStatus('idle');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setStatus('error');
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, weatherLocation]);

  const select = (suggestion: TransitPlaceSuggestion) => {
    selectedNameRef.current = suggestion.name;
    setQuery(suggestion.name);
    setSuggestions([]);
    onChange({ id: suggestion.id, name: suggestion.name });
  };

  return (
    <Field id={id} label={label} styles={styles}>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        value={query}
        placeholder={t('settings.local.transit.searchPlaceholder')}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      {status === 'error' ? (
        <p role="alert" className="px-1 text-sm leading-5 text-red-400">
          {t('settings.local.transit.searchError')}
        </p>
      ) : suggestions.length > 0 ? (
        <ul className="grid gap-1">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                className={cn(
                  'w-full rounded-lg px-2 py-1.5 text-left text-sm',
                  styles.subtleColor,
                  styles.hoverBg
                )}
                onClick={() => select(suggestion)}
              >
                {suggestion.name}
              </button>
            </li>
          ))}
        </ul>
      ) : status === 'searching' ? (
        <p className={cn('px-1 text-sm leading-5', styles.subtleColor)}>
          {t('settings.local.transit.searching')}
        </p>
      ) : null}
    </Field>
  );
}

function JourneyEditor({
  journey,
  styles,
  onChange,
  onRemove,
}: {
  journey: TransitJourney;
  styles: SettingsSectionStyles;
  onChange: (journey: TransitJourney) => void;
  onRemove: () => void;
}) {
  const { t, locale } = useI18n();
  const weekdays = useWeekdayLabels(locale);
  const [timeDraft, setTimeDraft] = useState(() => formatClockTime(journey.arriveByMinute));

  const toggleWeekday = (day: number) => {
    const next = journey.weekdays.includes(day)
      ? journey.weekdays.filter((entry) => entry !== day)
      : [...journey.weekdays, day].sort((left, right) => left - right);
    onChange({ ...journey, weekdays: next });
  };

  return (
    <div
      className={cn('grid gap-3 rounded-xl border p-3', styles.insetBorderColor, styles.insetBg)}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field id={`${journey.id}-name`} label={t('settings.local.transit.name')} styles={styles}>
            <Input
              id={`${journey.id}-name`}
              type="text"
              autoComplete="off"
              maxLength={TRANSIT_JOURNEY_NAME_MAX_LENGTH}
              value={journey.name}
              placeholder={t('settings.local.transit.namePlaceholder')}
              onChange={(event) => onChange({ ...journey, name: event.currentTarget.value })}
            />
          </Field>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="small"
          className="mt-6 rounded-full"
          aria-label={t('settings.local.transit.remove')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StopField
          id={`${journey.id}-from`}
          label={t('settings.local.transit.from')}
          styles={styles}
          value={journey.from}
          onChange={(from) => onChange({ ...journey, from })}
        />
        <StopField
          id={`${journey.id}-to`}
          label={t('settings.local.transit.to')}
          styles={styles}
          value={journey.to}
          onChange={(to) => onChange({ ...journey, to })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`${journey.id}-arrive-by`}
          label={t('settings.local.transit.arriveBy')}
          styles={styles}
        >
          <Input
            id={`${journey.id}-arrive-by`}
            type="time"
            value={timeDraft}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setTimeDraft(next);
              const parsed = parseClockTime(next);
              if (parsed !== null) {
                onChange({ ...journey, arriveByMinute: parsed });
              }
            }}
          />
        </Field>
        <Field id={`${journey.id}-lead`} label={t('settings.local.transit.lead')} styles={styles}>
          <Select
            id={`${journey.id}-lead`}
            value={String(journey.leadMinutes)}
            onChange={(event) => onChange({ ...journey, leadMinutes: Number(event.target.value) })}
          >
            {LEAD_MINUTE_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t('settings.local.transit.leadMinutes', { minutes })}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-1.5">
        <span
          className={cn('px-1', navetTypographyTokens.caption, 'font-medium', styles.subtleColor)}
        >
          {t('settings.local.transit.days')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {weekdays.map(({ day, short, long }) => {
            const active = journey.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={long}
                className={cn(
                  'h-9 min-w-11 rounded-full border px-3 text-sm capitalize transition-colors',
                  active
                    ? cn(
                        'border-transparent font-medium',
                        styles.floatingButtonBg,
                        styles.floatingButtonText
                      )
                    : cn(styles.borderColor, styles.chipTextColor, styles.chipHoverBg)
                )}
                onClick={() => toggleWeekday(day)}
              >
                {short}
              </button>
            );
          })}
        </div>
      </div>

      {!isComplete(journey) ? (
        <p className={cn('text-sm leading-5', styles.subtleColor)}>
          {t('settings.local.transit.incomplete')}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsTransitJourneys({ styles }: { styles: SettingsSectionStyles }) {
  const { t } = useI18n();
  const journeys = useSettingsStore((state) => state.transitJourneys);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  // Incomplete journeys never reach the store, so the editor keeps them until they resolve.
  const [drafts, setDrafts] = useState<TransitJourney[]>([]);
  const entries = useMemo(() => [...journeys, ...drafts], [journeys, drafts]);

  const commit = (next: TransitJourney[]) => {
    updateSettings({ transitJourneys: next.filter(isComplete) });
    setDrafts(next.filter((journey) => !isComplete(journey)));
  };

  return (
    <div className="grid max-w-xl gap-3">
      {entries.length === 0 ? (
        <p className={cn('text-sm leading-5', styles.subtleColor)}>
          {t('settings.local.transit.empty')}
        </p>
      ) : (
        entries.map((journey) => (
          <JourneyEditor
            key={journey.id}
            journey={journey}
            styles={styles}
            onChange={(next) =>
              commit(entries.map((entry) => (entry.id === next.id ? next : entry)))
            }
            onRemove={() => commit(entries.filter((entry) => entry.id !== journey.id))}
          />
        ))
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="small"
          className="rounded-full"
          leading={<Plus className="h-4 w-4" />}
          disabled={entries.length >= TRANSIT_JOURNEY_MAX_COUNT}
          onClick={() => setDrafts((current) => [...current, createDraft()])}
        >
          {t('settings.local.transit.add')}
        </Button>
      </div>
    </div>
  );
}
