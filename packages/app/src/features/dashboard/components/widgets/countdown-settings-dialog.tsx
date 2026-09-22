import { CardDialogChoicePill, CardDialogSection } from '@navet/app/components/patterns';
import { BaseCardDialogWithState, Button, Input, Radio } from '@navet/app/components/primitives';
import { getInheritedDialogSectionStyle } from '@navet/app/components/shared/theme/custom-card-tint-surface';
import { getThemeColorValue } from '@navet/app/components/shared/theme/theme-colors';
import { WallpaperPreviewImage } from '@navet/app/components/shared/wallpaper-preview-image';
import {
  getThemeFocusRingClassName,
  navetRadiusTokens,
  navetTypographyTokens,
} from '@navet/app/components/system/tokens';
import { BUILT_IN_WALLPAPERS } from '@navet/app/constants/built-in-wallpapers';
import { useI18n, useTheme } from '@navet/app/hooks';
import { sanitizeImageUrl } from '@navet/app/utils/url-security';
import {
  type CountdownDisplay,
  type CountdownPrecision,
  formatLocalDateKey,
  isCountdownDateKey,
} from '@navet/core/countdown';
import { useId } from 'react';
import {
  COUNTDOWN_BACKGROUND_MAX_LENGTH,
  COUNTDOWN_TITLE_MAX_LENGTH,
  type CountdownCardData,
} from './countdown-widget-data';
import { getDashboardWidgetSurfaceTokens } from './widget-surface-tokens';

export interface CountdownSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  roomValue: string;
  roomLabel: string;
  roomOptions: Array<{ label: string; value: string }>;
  onRoomChange?: (room: string) => void;
  data: CountdownCardData;
  onUpdate: (data: Partial<CountdownCardData>) => void;
  onTintColorChange?: (color: string) => void;
}

export function CountdownSettingsDialog({
  isOpen,
  onOpenChange,
  roomValue,
  roomLabel,
  roomOptions,
  onRoomChange,
  data,
  onUpdate,
  onTintColorChange,
}: CountdownSettingsDialogProps) {
  const { theme, primaryColor } = useTheme();
  const { t } = useI18n();
  const surface = getDashboardWidgetSurfaceTokens(theme, data.tintColor);
  const sectionStyle = getInheritedDialogSectionStyle(theme, data.tintColor);
  const fieldStyle = { ...sectionStyle, background: surface.subtleFill };
  const wallpaperGroupName = useId();
  const dateErrorId = useId();
  const imageUrlErrorId = useId();
  const selectionColor = data.tintColor ?? getThemeColorValue(primaryColor);

  const precision: CountdownPrecision = data.precision === 'datetime' ? 'datetime' : 'date';
  const display: CountdownDisplay = data.display === 'full' ? 'full' : 'days';
  const background = data.background ?? '';
  const isBuiltInBackground = background.startsWith('builtin:');
  const customImageUrl = isBuiltInBackground ? '' : background;
  const hasImageUrlError =
    customImageUrl.trim().length > 0 && !sanitizeImageUrl(customImageUrl.trim());
  const dateValue = data.targetDate ?? '';
  const hasDateError = dateValue.length > 0 && !isCountdownDateKey(dateValue);
  const showDateHint = dateValue.length === 0;
  const inputClassName = `w-full ${surface.borderClassName} bg-transparent ${surface.textPrimary} rounded-xl py-2`;

  const controlsTabContent = (
    <div className="space-y-4">
      <CardDialogSection label={t('widgets.countdown.settings.name')}>
        <Input
          value={data.title ?? ''}
          onChange={(event) => onUpdate({ title: event.target.value })}
          placeholder={t('widgets.countdown.settings.namePlaceholder')}
          maxLength={COUNTDOWN_TITLE_MAX_LENGTH}
          inputClassName={inputClassName}
          style={fieldStyle}
        />
      </CardDialogSection>

      <CardDialogSection label={t('widgets.countdown.settings.precision')}>
        <div className="inline-flex items-center gap-1">
          <CardDialogChoicePill
            active={precision === 'date'}
            size="compact"
            onClick={() => onUpdate({ precision: 'date' })}
          >
            {t('widgets.countdown.settings.precisionDate')}
          </CardDialogChoicePill>
          <CardDialogChoicePill
            active={precision === 'datetime'}
            size="compact"
            onClick={() => onUpdate({ precision: 'datetime' })}
          >
            {t('widgets.countdown.settings.precisionDateTime')}
          </CardDialogChoicePill>
        </div>
      </CardDialogSection>

      <CardDialogSection label={t('widgets.countdown.settings.endsAt')}>
        <div className="flex gap-2">
          <Input
            type="date"
            value={dateValue}
            min={formatLocalDateKey(new Date())}
            onChange={(event) => onUpdate({ targetDate: event.target.value })}
            aria-label={t('widgets.countdown.settings.date')}
            invalid={hasDateError}
            aria-describedby={hasDateError || showDateHint ? dateErrorId : undefined}
            inputClassName={`${inputClassName} min-h-11`}
            style={fieldStyle}
          />
          {precision === 'datetime' ? (
            <Input
              type="time"
              value={data.targetTime ?? '00:00'}
              onChange={(event) => onUpdate({ targetTime: event.target.value })}
              aria-label={t('widgets.countdown.settings.time')}
              inputClassName={`${inputClassName} min-h-11`}
              style={fieldStyle}
            />
          ) : null}
        </div>
        {hasDateError || showDateHint ? (
          <p
            id={dateErrorId}
            role={hasDateError ? 'alert' : undefined}
            className={`mt-2 ${navetTypographyTokens.helper} ${surface.textMuted}`}
          >
            {t('widgets.countdown.settings.dateRequired')}
          </p>
        ) : null}
      </CardDialogSection>

      <CardDialogSection label={t('widgets.countdown.settings.display')}>
        <div className="inline-flex items-center gap-1">
          <CardDialogChoicePill
            active={display === 'days'}
            size="compact"
            onClick={() => onUpdate({ display: 'days' })}
          >
            {t('widgets.countdown.settings.displayDays')}
          </CardDialogChoicePill>
          <CardDialogChoicePill
            active={display === 'full'}
            size="compact"
            onClick={() => onUpdate({ display: 'full' })}
          >
            {t('widgets.countdown.settings.displayFull')}
          </CardDialogChoicePill>
        </div>
      </CardDialogSection>

      <CardDialogSection
        label={t('widgets.countdown.settings.removeWhenFinished')}
        helperText={t('widgets.countdown.settings.removeWhenFinishedDescription')}
      >
        <div className="inline-flex items-center gap-1">
          <CardDialogChoicePill
            active={data.removeWhenFinished !== false}
            size="compact"
            onClick={() => onUpdate({ removeWhenFinished: true })}
          >
            {t('common.on')}
          </CardDialogChoicePill>
          <CardDialogChoicePill
            active={data.removeWhenFinished === false}
            size="compact"
            onClick={() => onUpdate({ removeWhenFinished: false })}
          >
            {t('common.off')}
          </CardDialogChoicePill>
        </div>
      </CardDialogSection>
    </div>
  );

  const customizeTabContent = (
    <div className="space-y-4">
      <CardDialogSection label={t('widgets.countdown.settings.appearanceImage')}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {BUILT_IN_WALLPAPERS.map((wallpaper, index) => {
            const isSelected = background === wallpaper.token;
            const radioId = `${wallpaperGroupName}-${index}`;

            return (
              <label
                key={wallpaper.id}
                htmlFor={radioId}
                className={`relative aspect-square min-h-11 cursor-pointer overflow-hidden border ${navetRadiusTokens.field} ${surface.borderClassName}`}
                style={{
                  borderColor: isSelected ? selectionColor : undefined,
                  boxShadow: isSelected ? `0 0 0 2px ${selectionColor}` : undefined,
                }}
              >
                <Radio
                  id={radioId}
                  className={`absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 ${getThemeFocusRingClassName(theme)}`}
                  name={wallpaperGroupName}
                  value={wallpaper.token}
                  checked={isSelected}
                  onChange={() => onUpdate({ background: wallpaper.token })}
                />
                <WallpaperPreviewImage
                  value={wallpaper.token}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="sr-only">{wallpaper.id}</span>
              </label>
            );
          })}
        </div>
      </CardDialogSection>

      <CardDialogSection label={t('widgets.countdown.settings.imageUrl')}>
        <Input
          type="url"
          autoComplete="off"
          spellCheck={false}
          value={customImageUrl}
          placeholder={t('widgets.countdown.settings.imageUrlPlaceholder')}
          onChange={(event) => onUpdate({ background: event.target.value })}
          invalid={hasImageUrlError}
          aria-describedby={hasImageUrlError ? imageUrlErrorId : undefined}
          maxLength={COUNTDOWN_BACKGROUND_MAX_LENGTH}
          inputClassName={`${inputClassName} min-h-11`}
          style={fieldStyle}
        />
        {hasImageUrlError ? (
          <p
            id={imageUrlErrorId}
            role="alert"
            className={`mt-2 ${navetTypographyTokens.helper} ${surface.textMuted}`}
          >
            {t('widgets.countdown.settings.imageUrlInvalid')}
          </p>
        ) : null}
      </CardDialogSection>

      {background ? (
        <Button
          variant="secondary"
          className="min-h-11"
          onClick={() => onUpdate({ background: '' })}
        >
          {t('widgets.countdown.settings.removeImage')}
        </Button>
      ) : null}
    </div>
  );

  return (
    <BaseCardDialogWithState
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('widgets.countdown.settings.title')}
      roomSelector={{
        value: roomValue,
        label: roomLabel,
        options: roomOptions,
        onChange: onRoomChange,
      }}
      controlsTabContent={controlsTabContent}
      customizeTabContent={customizeTabContent}
      tintColor={data.tintColor}
      onTintColorChange={onTintColorChange}
      defaultTintAccent="#f97316"
      theme={theme}
      height="capped"
    />
  );
}
