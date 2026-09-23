import { CardDialogSection, SelectableCheckboxRow } from '@navet/app/components/patterns';
import { BaseCardDialogWithState, Input, Select } from '@navet/app/components/primitives';
import {
  getInheritedDialogSectionStyle,
  normalizeCustomCardTint,
} from '@navet/app/components/shared/theme/custom-card-tint-surface';
import { getThemeColorValue } from '@navet/app/components/shared/theme/theme-colors';
import { getDashboardWidgetSurfaceTokens } from '@navet/app/features/dashboard/components/widgets/widget-surface-tokens';
import { useI18n, useTheme } from '@navet/app/hooks';
import type { ChoreParticipant } from '@navet/core/chores';
import { useState } from 'react';
import { ChoreAssigneeAvatar } from './chore-card';

export const CHORE_CARD_EVERYONE = 'all';
export const CHORE_CARD_TITLE_MAX_LENGTH = 80;
/** Upper bound for "today or the next N days" on the Homework and Dinner cards. */
export const CHORE_CARD_MAX_DAYS = 7;

export function clampChoreCardDays(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(CHORE_CARD_MAX_DAYS, Math.max(1, Math.round(value)))
    : 1;
}

/**
 * Card settings for the Chores, Homework and Dinner dashboard cards. The person list is single-select:
 * a household can place one card per member on a shared display. Dinner has no person list.
 */
export function ChoreCardPersonDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  participants,
  selectedParticipantId,
  onSelectedParticipantChange,
  cardTitle,
  cardTitlePlaceholder,
  onCardTitleChange,
  days,
  onDaysChange,
  roomValue,
  roomLabel,
  roomOptions,
  onRoomChange,
  tintColor,
  onTintColorChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  participants: ChoreParticipant[];
  selectedParticipantId: string;
  /** Omitted hides the person list. */
  onSelectedParticipantChange?: (participantId: string) => void;
  /** Header the card shows. Empty falls back to `cardTitlePlaceholder`. */
  cardTitle?: string;
  cardTitlePlaceholder?: string;
  onCardTitleChange?: (title: string) => void;
  /** How many days the card shows from today. Omitted hides the control. */
  days?: number;
  onDaysChange?: (days: number) => void;
  roomValue: string;
  roomLabel: string;
  roomOptions: Array<{ label: string; value: string }>;
  onRoomChange?: (room: string) => void;
  tintColor?: string;
  onTintColorChange?: (color: string) => void;
}) {
  const { t } = useI18n();
  const { theme, primaryColor } = useTheme();
  // Profile sync trims stored strings and echoes them back, which would eat a trailing space
  // mid-typing; the field owns its text while the dialog is open.
  const [titleDraft, setTitleDraft] = useState(cardTitle ?? '');
  const surface = getDashboardWidgetSurfaceTokens(theme, tintColor);
  const rowFill = getDashboardWidgetSurfaceTokens(theme).subtleFill;
  const fieldStyle = { ...getInheritedDialogSectionStyle(theme, tintColor), background: rowFill };
  const accentHex = normalizeCustomCardTint(tintColor) ?? getThemeColorValue(primaryColor);

  const options: Array<{ id: string; label: string; participant?: ChoreParticipant }> = [
    { id: CHORE_CARD_EVERYONE, label: t('household.personPicker.all') },
    ...participants.map((participant) => ({
      id: participant.id,
      label: participant.displayName,
      participant,
    })),
  ];

  return (
    <BaseCardDialogWithState
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      roomSelector={{
        value: roomValue,
        label: roomLabel,
        options: roomOptions,
        onChange: onRoomChange,
      }}
      tintColor={tintColor}
      onTintColorChange={onTintColorChange}
      controlsTabContent={
        <div className="space-y-4">
          {onCardTitleChange ? (
            <CardDialogSection label={t('chores.card.name')}>
              <Input
                value={titleDraft}
                onChange={(event) => {
                  setTitleDraft(event.target.value);
                  onCardTitleChange(event.target.value);
                }}
                placeholder={cardTitlePlaceholder ?? t('chores.card.namePlaceholder')}
                maxLength={CHORE_CARD_TITLE_MAX_LENGTH}
                inputClassName={`w-full ${surface.borderClassName} bg-transparent ${surface.textPrimary} rounded-xl py-2`}
                style={fieldStyle}
              />
            </CardDialogSection>
          ) : null}
          {onDaysChange ? (
            <CardDialogSection label={t('chores.card.days')}>
              <Select
                value={String(clampChoreCardDays(days))}
                onChange={(event) => onDaysChange(Number(event.currentTarget.value))}
                aria-label={t('chores.card.days')}
                accentColorOverride={accentHex}
              >
                {Array.from({ length: CHORE_CARD_MAX_DAYS }, (_, index) => index + 1).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count === 1
                        ? t('chores.card.daysToday')
                        : t('chores.card.daysCount', { count })}
                    </option>
                  )
                )}
              </Select>
            </CardDialogSection>
          ) : null}
          {onSelectedParticipantChange ? (
            <CardDialogSection label={t('chores.card.person')}>
              {participants.length === 0 ? (
                <p
                  className={`rounded-2xl border px-4 py-4 text-sm ${surface.borderClassName} ${surface.textMuted}`}
                >
                  {t('chores.card.noPeople')}
                </p>
              ) : (
                <ul className="min-w-0 max-w-full space-y-1.5 sm:max-h-72 sm:overflow-y-auto sm:pr-1">
                  {options.map((option) => (
                    <li key={option.id} className="w-full min-w-0 max-w-full">
                      <SelectableCheckboxRow
                        checked={option.id === selectedParticipantId}
                        onCheckedChange={() => onSelectedParticipantChange(option.id)}
                        label={
                          <span className="block truncate" title={option.label}>
                            {option.label}
                          </span>
                        }
                        leading={
                          option.participant ? (
                            <ChoreAssigneeAvatar participant={option.participant} />
                          ) : undefined
                        }
                        rowClassName={`w-full min-w-0 max-w-full overflow-hidden ${surface.borderClassName} ${surface.textPrimary}`}
                        labelClassName="truncate"
                        checkboxPaletteColor={accentHex}
                        style={{ background: rowFill }}
                        selectedStyle={{ background: rowFill, borderColor: `${accentHex}4d` }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardDialogSection>
          ) : null}
        </div>
      }
      theme={theme}
      maxWidth="md"
      height="capped"
    />
  );
}
