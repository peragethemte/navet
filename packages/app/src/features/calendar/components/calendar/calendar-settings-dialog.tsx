import {
  CardDialogChoicePill,
  CardDialogSection,
  SelectableCheckboxRow,
} from '@navet/app/components/patterns';
import { BaseCardDialogWithState } from '@navet/app/components/primitives';
import {
  getInheritedDialogSectionStyle,
  normalizeCustomCardTint,
} from '@navet/app/components/shared/theme/custom-card-tint-surface';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { useI18n } from '@navet/app/hooks';
import { type ThemeType, useTheme } from '@navet/app/hooks/use-theme';
import { getEntityTypeLabel } from '@navet/app/utils/entity-type-label';
import { CALENDAR_DAY_COUNT_MAX, CALENDAR_DAY_COUNT_MIN } from '@navet/core/calendar-agenda';
import { Minus, Plus } from 'lucide-react';
import { CALENDAR_VIEW_MODES, type CalendarViewMode } from './calendar-view-mode';

interface CalendarSourceOption {
  id: string;
  name: string;
  room: string;
  color: string;
}

interface CalendarSettingsDialogProps {
  entityId?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  theme: ThemeType;
  title: string;
  calendars: CalendarSourceOption[];
  selectedCalendarIds: string[];
  onSelectedCalendarIdsChange: (ids: string[]) => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
  dayCount: number;
  onDayCountChange: (dayCount: number) => void;
  tintColor?: string;
  onTintColorChange?: (color: string) => void;
}

interface DayCountButtonProps {
  label: string;
  disabled: boolean;
  surfaceClassName: string;
  style?: React.CSSProperties;
  onClick: () => void;
  children: React.ReactNode;
}

function DayCountButton({
  label,
  disabled,
  surfaceClassName,
  style,
  onClick,
  children,
}: DayCountButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${surfaceClassName}`}
    >
      {children}
    </button>
  );
}

export function CalendarSettingsDialog({
  entityId,
  isOpen,
  onOpenChange,
  theme,
  title,
  calendars,
  selectedCalendarIds,
  onSelectedCalendarIdsChange,
  viewMode,
  onViewModeChange,
  dayCount,
  onDayCountChange,
  tintColor,
  onTintColorChange,
}: CalendarSettingsDialogProps) {
  const { t } = useI18n();
  const surface = getThemeSurfaceTokens(theme);
  const entityType = getEntityTypeLabel(entityId);
  const isRealCalendarEntity =
    entityId !== undefined && calendars.some((calendar) => calendar.id === entityId);
  const roomSelectorEntityId = isRealCalendarEntity
    ? entityId
    : (selectedCalendarIds.find((id) => calendars.some((calendar) => calendar.id === id)) ??
      calendars[0]?.id);
  const { accentColor } = useTheme();
  const activeAccentColor = normalizeCustomCardTint(tintColor) ?? accentColor;
  const sectionStyle = getInheritedDialogSectionStyle(theme, tintColor, '#6366f1');

  const controlsTabContent = (
    <div className="space-y-4">
      <CardDialogSection label={t('calendar.settings.view')} className="mb-4">
        <div className="inline-flex items-center gap-1">
          {CALENDAR_VIEW_MODES.map((option) => (
            <CardDialogChoicePill
              key={option}
              active={viewMode === option}
              size="compact"
              className="min-w-0"
              onClick={() => onViewModeChange(option)}
            >
              {option === 'day'
                ? t('calendar.settings.today')
                : option === 'days'
                  ? t('calendar.settings.nextDays')
                  : t('calendar.settings.thisMonth')}
            </CardDialogChoicePill>
          ))}
        </div>
      </CardDialogSection>

      {viewMode === 'days' ? (
        <CardDialogSection label={t('calendar.settings.dayCount')} className="mb-4">
          <div className="inline-flex items-center gap-2">
            <DayCountButton
              label={t('calendar.settings.fewerDays')}
              disabled={dayCount <= CALENDAR_DAY_COUNT_MIN}
              surfaceClassName={`${surface.hoverBg} ${surface.textPrimary}`}
              style={sectionStyle}
              onClick={() => onDayCountChange(dayCount - 1)}
            >
              <Minus className="h-4 w-4" />
            </DayCountButton>

            <span
              className={`min-w-16 text-center text-sm font-semibold ${surface.textPrimary}`}
              aria-live="polite"
            >
              {t('calendar.settings.dayCountValue', { count: dayCount })}
            </span>

            <DayCountButton
              label={t('calendar.settings.moreDays')}
              disabled={dayCount >= CALENDAR_DAY_COUNT_MAX}
              surfaceClassName={`${surface.hoverBg} ${surface.textPrimary}`}
              style={sectionStyle}
              onClick={() => onDayCountChange(dayCount + 1)}
            >
              <Plus className="h-4 w-4" />
            </DayCountButton>
          </div>
        </CardDialogSection>
      ) : null}

      <CardDialogSection label={t('calendar.settings.calendars')}>
        <div className="space-y-2">
          {calendars.map((calendar) => {
            const isSelected = selectedCalendarIds.includes(calendar.id);

            return (
              <SelectableCheckboxRow
                key={calendar.id}
                checked={isSelected}
                onCheckedChange={() => {
                  onSelectedCalendarIdsChange(
                    isSelected
                      ? selectedCalendarIds.filter((id) => id !== calendar.id)
                      : [...selectedCalendarIds, calendar.id]
                  );
                }}
                label={calendar.name}
                leading={<div className={`h-5 w-1 rounded-full ${calendar.color}`} />}
                rowClassName={`items-center ${surface.hoverBg}`}
                labelClassName={`truncate ${surface.textPrimary}`}
                checkboxPaletteColor={activeAccentColor}
                style={sectionStyle}
                selectedStyle={{
                  backgroundColor:
                    theme === 'light' ? `${activeAccentColor}0d` : `${activeAccentColor}16`,
                  borderColor: `${activeAccentColor}4d`,
                }}
                unselectedStyle={sectionStyle}
              />
            );
          })}
        </div>
      </CardDialogSection>
    </div>
  );

  return (
    <BaseCardDialogWithState
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      entityId={roomSelectorEntityId}
      description={entityType}
      editableTitle={isRealCalendarEntity}
      roomSelectorFallbackRoomName={calendars[0]?.room}
      controlsTabContent={controlsTabContent}
      tintColor={tintColor}
      onTintColorChange={onTintColorChange}
      defaultTintAccent="#6366f1"
      theme={theme}
    />
  );
}
