import { CardDialogSection, SelectableCheckboxRow } from '@navet/app/components/patterns';
import { BaseCardDialogWithState } from '@navet/app/components/primitives';
import { normalizeCustomCardTint } from '@navet/app/components/shared/theme/custom-card-tint-surface';
import { getThemeColorValue } from '@navet/app/components/shared/theme/theme-colors';
import { getDashboardWidgetSurfaceTokens } from '@navet/app/features/dashboard/components/widgets/widget-surface-tokens';
import { useI18n, useTheme } from '@navet/app/hooks';
import type { ChoreParticipant } from '@navet/core/chores';
import { ChoreAssigneeAvatar } from './chore-card';

export const CHORE_CARD_EVERYONE = 'all';

/**
 * Card settings for the Chores and Homework dashboard cards. The person list is single-select:
 * a household can place one card per member on a shared display.
 */
export function ChoreCardPersonDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  participants,
  selectedParticipantId,
  onSelectedParticipantChange,
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
  onSelectedParticipantChange: (participantId: string) => void;
  roomValue: string;
  roomLabel: string;
  roomOptions: Array<{ label: string; value: string }>;
  onRoomChange?: (room: string) => void;
  tintColor?: string;
  onTintColorChange?: (color: string) => void;
}) {
  const { t } = useI18n();
  const { theme, primaryColor } = useTheme();
  const surface = getDashboardWidgetSurfaceTokens(theme, tintColor);
  const rowFill = getDashboardWidgetSurfaceTokens(theme).subtleFill;
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
      }
      theme={theme}
      maxWidth="md"
      height="capped"
    />
  );
}
