import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { themeColorValues } from '@navet/app/components/shared/theme/theme-colors';
import { useDashboardWidgetRoomOptions } from '@navet/app/features/dashboard/components/widgets/use-widget-room-options';
import { useAreaRooms, useI18n, useTheme } from '@navet/app/hooks';
import { normalizeChoreExperienceState } from '@navet/core/chore-experience';
import { memo, useEffect, useMemo, useState } from 'react';
import { getChoreCardAction } from '../../chore-card-action';
import { getChorePaletteKey, resolveChoreColorPalette } from '../../chore-color-palette';
import { getDefinition, getTodayChoresForParticipant } from '../../chore-dashboard-selectors';
import { resolveChoreWidgetState, useChoreCardParticipant } from '../../use-chore-card-participant';
import { CHORE_CARD_EVERYONE, ChoreCardPersonDialog } from '../chore-card-person-dialog';
import { type ChoresCardRow, ChoresCardView } from './view';

export interface ChoresCardData {
  participantId?: string;
  /** Header override. Empty falls back to the generic "Chores" label. */
  title?: string;
  tintColor?: string;
}

export interface ChoresCardProps {
  size?: CardSize;
  data?: ChoresCardData;
  onUpdate?: (data: ChoresCardData) => void;
  isEditMode?: boolean;
  room?: string;
  onRoomChange?: (room: string) => void;
  openSettingsRequestKey?: number;
}

export const ChoresCard = memo(function ChoresCard({
  size = 'medium',
  data,
  onUpdate,
  room,
  onRoomChange,
  openSettingsRequestKey = 0,
}: ChoresCardProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const rooms = useAreaRooms();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { roomValue, roomLabel, roomOptions } = useDashboardWidgetRoomOptions(room, rooms);
  const { choresEnabled, workspace, status, execute, now, participants, participantId } =
    useChoreCardParticipant(data?.participantId);

  useEffect(() => {
    if (openSettingsRequestKey > 0) setIsSettingsOpen(true);
  }, [openSettingsRequestKey]);

  const experience = useMemo(
    () => (workspace ? normalizeChoreExperienceState(workspace.experience) : undefined),
    [workspace]
  );
  const showPoints = experience ? experience.gamificationMode !== 'off' : false;
  const childMode = experience?.gamificationMode === 'adventure';

  const occurrences = useMemo(
    () =>
      workspace
        ? getTodayChoresForParticipant(workspace, participantId, now, {
            includeHomework: false,
            carryOver: false,
          })
        : [],
    [now, participantId, workspace]
  );
  const pending = useMemo(
    () => occurrences.filter((occurrence) => occurrence.status !== 'done'),
    [occurrences]
  );

  const rows = useMemo<ChoresCardRow[]>(() => {
    if (!workspace || !experience) return [];
    return occurrences.flatMap((occurrence) => {
      const definition = getDefinition(workspace, occurrence);
      if (!definition) return [];
      const storedPresentation = experience.presentationByDefinitionId[definition.id];
      const presentation =
        experience.gamificationMode === 'off' && storedPresentation
          ? { ...storedPresentation, points: undefined, childTitle: undefined }
          : storedPresentation;
      return [
        {
          definition,
          occurrence,
          presentation,
          action: getChoreCardAction(occurrence, definition, participantId, execute, t),
        },
      ];
    });
  }, [execute, experience, occurrences, participantId, t, workspace]);

  const tintColor = useMemo(() => {
    if (typeof data?.tintColor === 'string') return data.tintColor;
    if (!workspace) return undefined;
    if (pending.length === 0 && occurrences.length > 0) return themeColorValues.green;
    const selected =
      participantId === CHORE_CARD_EVERYONE ? undefined : workspace.participantsById[participantId];
    if (selected) return resolveChoreColorPalette(`person:${selected.id}`, selected.color).primary;
    const first = rows[0];
    return first
      ? resolveChoreColorPalette(getChorePaletteKey(first.definition), first.presentation?.color)
          .primary
      : undefined;
  }, [data?.tintColor, occurrences.length, participantId, pending.length, rows, workspace]);

  const state = resolveChoreWidgetState({
    choresEnabled,
    status,
    hasWorkspace: Boolean(workspace),
    hasRows: rows.length > 0,
  });

  return (
    <>
      <ChoresCardView
        size={size}
        theme={theme}
        state={state}
        title={data?.title?.trim() || t('chores.card.title')}
        rows={rows}
        participantsById={workspace?.participantsById ?? {}}
        now={now}
        remaining={pending.length}
        tintColor={tintColor}
        childMode={childMode}
        showPoints={showPoints}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      {isSettingsOpen ? (
        <ChoreCardPersonDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          title={t('chores.card.title')}
          description={t('chores.card.settingsDescription')}
          participants={participants}
          selectedParticipantId={participantId}
          cardTitle={data?.title}
          cardTitlePlaceholder={t('chores.card.title')}
          onCardTitleChange={
            onUpdate ? (nextTitle) => onUpdate({ ...data, title: nextTitle }) : undefined
          }
          onSelectedParticipantChange={(nextParticipantId) =>
            onUpdate?.({
              ...data,
              participantId:
                nextParticipantId === CHORE_CARD_EVERYONE ? undefined : nextParticipantId,
            })
          }
          roomValue={roomValue}
          roomLabel={roomLabel}
          roomOptions={roomOptions}
          onRoomChange={onRoomChange}
          tintColor={typeof data?.tintColor === 'string' ? data.tintColor : undefined}
          onTintColorChange={
            onUpdate ? (nextTint) => onUpdate({ ...data, tintColor: nextTint }) : undefined
          }
        />
      ) : null}
    </>
  );
});
