import { CardEmptyState } from '@navet/app/components/patterns';
import { BaseCard, RoundControlButton } from '@navet/app/components/primitives';
import { type CardSize, isCompactCardSize } from '@navet/app/components/shared/card-size-selector';
import { WallpaperPreviewImage } from '@navet/app/components/shared/wallpaper-preview-image';
import { navetTypographyTokens } from '@navet/app/components/system/tokens';
import { useI18n, useTheme } from '@navet/app/hooks';
import {
  type CountdownDisplay,
  type CountdownParts,
  type CountdownTarget,
  resolveCountdownState,
} from '@navet/core/countdown';
import { Hourglass, Settings2 } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { getDashboardWidgetSurfaceTokens } from './widget-surface-tokens';

export interface CountdownWidgetViewProps {
  size: CardSize;
  /** Passed in rather than read from the clock so stories and tests stay deterministic. */
  now: Date;
  title?: string;
  target: CountdownTarget | null;
  display: CountdownDisplay;
  background?: string;
  tintColor?: string;
  canConfigure?: boolean;
  onOpenSettings?: () => void;
}

/**
 * The remaining time is the whole point of the card, so it steps past the shared card-metric
 * tokens on the two hero sizes the way the climate gauge does. Everything else stays on the scale.
 */
function metricClassName(size: CardSize) {
  if (size === 'extra-large') {
    return 'text-6xl font-semibold leading-none';
  }

  if (size === 'large' || size === 'extra-wide') {
    return 'text-5xl font-semibold leading-none';
  }

  return isCompactCardSize(size)
    ? navetTypographyTokens.cardMetricSm
    : navetTypographyTokens.cardMetricLg;
}

/** Four columns cannot each take the hero step, so the breakdown stays one size down. */
function breakdownMetricClassName(size: CardSize) {
  return size === 'large' || size === 'extra-large' || size === 'extra-wide'
    ? navetTypographyTokens.cardMetricXl
    : navetTypographyTokens.cardMetricLg;
}

function titleClassName(size: CardSize) {
  if (isCompactCardSize(size)) {
    return navetTypographyTokens.titleSm;
  }

  return size === 'large' || size === 'extra-large' || size === 'extra-wide'
    ? navetTypographyTokens.sectionHeading
    : navetTypographyTokens.titleMd;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function CountdownWidgetView({
  size,
  now,
  title,
  target,
  display,
  background,
  tintColor,
  canConfigure = false,
  onOpenSettings,
}: CountdownWidgetViewProps) {
  const { theme } = useTheme();
  const { t, formatDate, formatTime } = useI18n();
  const surface = getDashboardWidgetSurfaceTokens(theme, tintColor);
  const [imageFailed, setImageFailed] = useState(false);
  const backgroundValue = background?.trim() ?? '';
  const hasImage = backgroundValue.length > 0 && !imageFailed;
  const isCompact = isCompactCardSize(size);

  useEffect(() => {
    setImageFailed(false);
  }, [backgroundValue]);

  const textPrimaryClassName = hasImage ? 'text-white' : surface.textPrimary;
  const textSecondaryClassName = hasImage ? 'text-white/76' : surface.textSecondary;

  const settingsButton =
    canConfigure && onOpenSettings ? (
      <div className="absolute right-3 top-3 z-20">
        <RoundControlButton
          theme={theme}
          size={isCompact ? 'small' : 'medium'}
          variant="soft"
          aria-label={t('widgets.countdown.settings.title')}
          onClick={(event) => {
            event.stopPropagation();
            onOpenSettings();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </RoundControlButton>
      </div>
    ) : null;

  if (!target) {
    return (
      <BaseCard size={size} style={surface.panelStyle}>
        <div className="flex h-full items-center justify-center">
          <CardEmptyState
            title={t('widgets.countdown.title')}
            description={t('widgets.countdown.setUp')}
            icon={Hourglass}
            actionLabel={canConfigure ? t('widgets.countdown.settings.title') : undefined}
            onAction={canConfigure ? onOpenSettings : undefined}
            actionIcon={canConfigure ? Settings2 : undefined}
            size={size}
            accentColor={tintColor}
          />
        </div>
      </BaseCard>
    );
  }

  const state = resolveCountdownState(target, now);
  const targetDate = new Date(state.targetAt);
  const targetLabel =
    target.precision === 'datetime'
      ? `${formatDate(targetDate)} ${formatTime(targetDate)}`
      : formatDate(targetDate);

  return (
    <BaseCard
      size={size}
      fullBleed
      frameClassName="overflow-hidden"
      contentClassName="h-full"
      disableDefaultSheen={hasImage}
      style={hasImage ? { background: 'transparent', boxShadow: 'none' } : surface.panelStyle}
    >
      <div className="relative z-[2] flex h-full flex-col">
        <CountdownBackground
          value={backgroundValue}
          hasImage={hasImage}
          onFailedChange={setImageFailed}
        />
        {settingsButton}

        <div
          className={`relative flex h-full flex-col gap-1 ${
            // Over an image the text belongs in the darkest band; on a plain surface a bottom-
            // anchored block just leaves the card looking half empty.
            hasImage ? 'justify-end' : 'justify-center'
          } ${isCompact ? 'p-3.5' : 'p-4'}`}
        >
          {state.status === 'reached' ? (
            <p className={`${metricClassName(size)} ${textPrimaryClassName}`}>
              {t('widgets.countdown.today')}
            </p>
          ) : display === 'full' ? (
            <CountdownBreakdown
              parts={state.parts}
              size={size}
              textPrimaryClassName={textPrimaryClassName}
              textSecondaryClassName={textSecondaryClassName}
            />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className={`${metricClassName(size)} tabular-nums ${textPrimaryClassName}`}>
                {state.calendarDays}
              </span>
              <span className={`${navetTypographyTokens.label} ${textSecondaryClassName}`}>
                {t(
                  state.calendarDays === 1
                    ? 'widgets.countdown.unit.day'
                    : 'widgets.countdown.unit.days'
                )}
              </span>
            </div>
          )}

          {title ? (
            <p className={`${titleClassName(size)} line-clamp-2 ${textPrimaryClassName}`}>
              {title}
            </p>
          ) : null}

          {isCompact ? null : (
            <p className={`${navetTypographyTokens.caption} ${textSecondaryClassName}`}>
              {targetLabel}
            </p>
          )}
        </div>
      </div>
    </BaseCard>
  );
}

interface CountdownBreakdownProps {
  parts: CountdownParts;
  size: CardSize;
  textPrimaryClassName: string;
  textSecondaryClassName: string;
}

function CountdownBreakdown({
  parts,
  size,
  textPrimaryClassName,
  textSecondaryClassName,
}: CountdownBreakdownProps) {
  const { t } = useI18n();

  // A compact card cannot hold four labelled columns, so it collapses to a clock line instead.
  if (isCompactCardSize(size)) {
    return (
      <div className="flex flex-col">
        <span
          className={`${navetTypographyTokens.cardMetricSm} tabular-nums ${textPrimaryClassName}`}
        >
          {parts.days}
          {t('widgets.countdown.unit.dayShort')}
        </span>
        <span className={`${navetTypographyTokens.label} tabular-nums ${textSecondaryClassName}`}>
          {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
        </span>
      </div>
    );
  }

  const columns = [
    { key: 'days', value: parts.days, label: t('widgets.countdown.unit.days') },
    { key: 'hours', value: parts.hours, label: t('widgets.countdown.unit.hours') },
    { key: 'minutes', value: parts.minutes, label: t('widgets.countdown.unit.minutes') },
    { key: 'seconds', value: parts.seconds, label: t('widgets.countdown.unit.seconds') },
  ];

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
      {columns.map((column) => (
        <div key={column.key} className="flex flex-col">
          <span
            className={`${breakdownMetricClassName(size)} tabular-nums ${textPrimaryClassName}`}
          >
            {column.key === 'days' ? column.value : pad(column.value)}
          </span>
          <span className={`${navetTypographyTokens.caption} ${textSecondaryClassName}`}>
            {column.label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface CountdownBackgroundProps {
  value: string;
  hasImage: boolean;
  onFailedChange: (failed: boolean) => void;
}

/** Memoized so the image subtree is skipped on every clock tick of a full breakdown. */
const CountdownBackground = memo(function CountdownBackground({
  value,
  hasImage,
  onFailedChange,
}: CountdownBackgroundProps) {
  if (!value) {
    return null;
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[inherit]">
      <WallpaperPreviewImage
        value={value}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onFailedChange={onFailedChange}
      />
      {hasImage ? (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.44)_54%,rgba(2,6,23,0.72)_100%)]" />
      ) : null}
    </div>
  );
});
