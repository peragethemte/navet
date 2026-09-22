import { CardEmptyState } from '@navet/app/components/patterns';
import { BaseCard } from '@navet/app/components/primitives';
import { CardSettingsActionButton } from '@navet/app/components/shared/card-settings-action-button';
import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getCustomCardTintSurface } from '@navet/app/components/shared/theme/custom-card-tint-surface';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { type ThemeType, useI18n } from '@navet/app/hooks';
import { Bus, TriangleAlert } from 'lucide-react';
import type { TransitDeparture } from '../../entur-trip';
import {
  delayMinutes,
  formatDepartureClock,
  formatJourneyDay,
  formatWalkDistance,
  minutesUntil,
} from '../../transit-format';
import type { TransitJourneyBoard } from '../../use-transit-departures';

interface TransitDeparturesCardViewProps {
  board: TransitJourneyBoard[];
  now: Date;
  hasJourneys: boolean;
  size: CardSize;
  theme: ThemeType;
  locale: string;
  use24HourTime: boolean;
  tintColor?: string;
  isEditMode: boolean;
  onOpenSettings: () => void;
}

/** How many alternatives fit without the rows becoming unreadable at a glance. */
function departuresForSize(size: CardSize): number {
  if (size === 'small') {
    return 1;
  }
  return size === 'medium' ? 2 : 3;
}

function journeysForSize(size: CardSize): number {
  return size === 'large' ? 3 : 1;
}

function DepartureRow({
  departure,
  now,
  locale,
  use24HourTime,
  theme,
  surface,
}: {
  departure: TransitDeparture;
  now: Date;
  locale: string;
  use24HourTime: boolean;
  theme: ThemeType;
  surface: ReturnType<typeof getThemeSurfaceTokens>;
}) {
  const { t } = useI18n();
  const minutes = minutesUntil(departure.departure, now);
  const lateBy = delayMinutes(departure.delaySeconds);
  const transitLeg = departure.legs.find((leg) => leg.mode !== 'foot');
  const badgeClassName =
    theme === 'light'
      ? 'border-slate-300 bg-slate-100 text-slate-800'
      : 'border-white/12 bg-white/10 text-white/80';

  const details = [
    transitLeg?.quayCode ? t('transit.platform', { code: transitLeg.quayCode }) : null,
    departure.walkDistanceMetres > 0
      ? t('transit.walk', { distance: formatWalkDistance(departure.walkDistanceMetres) })
      : null,
    departure.transfers > 0 ? t('transit.transfers', { count: departure.transfers }) : null,
  ].filter((entry): entry is string => entry !== null);

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border px-1.5 text-xs font-semibold ${badgeClassName}`}
      >
        {transitLeg?.lineCode ?? <Bus className="h-3.5 w-3.5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-base font-semibold tabular-nums ${surface.textPrimary} ${departure.cancelled ? 'line-through opacity-60' : ''}`}
          >
            {departure.predictionInaccurate ? '~' : ''}
            {formatDepartureClock(departure.departure, locale, use24HourTime)}
          </span>
          <span className={`text-xs tabular-nums ${surface.textSecondary}`}>
            {t('transit.arrives', {
              time: formatDepartureClock(departure.arrival, locale, use24HourTime),
            })}
          </span>
          <span className={`ml-auto shrink-0 text-xs tabular-nums ${surface.textSecondary}`}>
            {minutes <= 0 ? t('transit.now') : t('transit.departsIn', { minutes })}
          </span>
        </div>
        <div className={`truncate text-xs ${surface.textSecondary}`}>
          {departure.cancelled ? (
            <span className="font-medium text-red-400">{t('transit.cancelled')}</span>
          ) : lateBy > 0 ? (
            <span className="font-medium text-amber-400">
              {t('transit.delayed', { minutes: lateBy })}
            </span>
          ) : null}
          {details.length > 0 ? (
            <span>
              {departure.cancelled || lateBy > 0 ? ' · ' : ''}
              {details.join(' · ')}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function TransitDeparturesCardView({
  board,
  now,
  hasJourneys,
  size,
  theme,
  locale,
  use24HourTime,
  tintColor,
  isEditMode,
  onOpenSettings,
}: TransitDeparturesCardViewProps) {
  const { t } = useI18n();
  const surface = getThemeSurfaceTokens(theme);
  const tintSurface = getCustomCardTintSurface(theme, tintColor);
  const visible = board.slice(0, journeysForSize(size));
  const departureCount = departuresForSize(size);

  return (
    <BaseCard
      size={size}
      style={tintSurface.panelStyle}
      readableBackgroundColor={tintSurface.backgroundColor}
      overlay={
        tintSurface.glowStyle ? (
          <div
            className="pointer-events-none absolute inset-0"
            data-dashboard-glow="true"
            style={tintSurface.glowStyle}
          />
        ) : null
      }
      contentClassName="h-full"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-1 flex items-start gap-2">
          <h3 className={`min-w-0 flex-1 truncate text-sm font-semibold ${surface.textPrimary}`}>
            {t('transit.title')}
          </h3>
          <CardSettingsActionButton
            theme={theme}
            size="small"
            variant="soft"
            disableHoverEffects
            aria-label={t('transit.openSettings')}
            className="shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSettings();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>

        {!hasJourneys ? (
          <CardEmptyState
            icon={Bus}
            size={size}
            title={t('transit.empty.title')}
            description={t('transit.empty.description')}
          />
        ) : visible.length === 0 ? (
          <CardEmptyState
            icon={Bus}
            size={size}
            title={t('transit.empty.noUpcoming')}
            description={t('transit.empty.noUpcomingDescription')}
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {visible.map((entry) => {
              const dayLabel = formatJourneyDay(entry.target, locale, now);
              const departures = entry.departures.slice(0, departureCount);
              const targetKey =
                entry.journey.timeMode === 'departAfter'
                  ? ({ day: 'transit.departAfterOn', plain: 'transit.departAfter' } as const)
                  : ({ day: 'transit.arriveByOn', plain: 'transit.arriveBy' } as const);

              return (
                <section key={entry.journey.id}>
                  <div className="flex items-baseline gap-2">
                    <span className={`truncate text-sm font-medium ${surface.textPrimary}`}>
                      {entry.journey.name || entry.journey.to.name}
                    </span>
                    <span className={`ml-auto shrink-0 text-xs ${surface.textSecondary}`}>
                      {dayLabel
                        ? t(targetKey.day, {
                            day: dayLabel,
                            time: formatDepartureClock(entry.target, locale, use24HourTime),
                          })
                        : t(targetKey.plain, {
                            time: formatDepartureClock(entry.target, locale, use24HourTime),
                          })}
                    </span>
                  </div>
                  <p className={`truncate text-xs ${surface.textSecondary}`}>
                    {entry.journey.from.name} → {entry.journey.to.name}
                  </p>

                  {entry.errorKey ? (
                    <p
                      className={`mt-1 flex items-center gap-1.5 text-xs ${surface.textSecondary}`}
                    >
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                      {t(entry.errorKey)}
                    </p>
                  ) : entry.isLoading && departures.length === 0 ? (
                    <ul className="mt-1 space-y-2" aria-hidden>
                      {Array.from({ length: departureCount }, (_value, index) => (
                        <li
                          key={index}
                          className={`h-7 animate-pulse rounded-md ${theme === 'light' ? 'bg-slate-200' : 'bg-white/8'}`}
                        />
                      ))}
                    </ul>
                  ) : departures.length === 0 ? (
                    <p className={`mt-1 text-xs ${surface.textSecondary}`}>
                      {t('transit.empty.noDepartures')}
                    </p>
                  ) : (
                    <ul className={isEditMode ? 'pointer-events-none' : undefined}>
                      {departures.map((departure) => (
                        <DepartureRow
                          key={departure.id}
                          departure={departure}
                          now={now}
                          locale={locale}
                          use24HourTime={use24HourTime}
                          theme={theme}
                          surface={surface}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </BaseCard>
  );
}
