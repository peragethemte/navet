import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { themeColorValues } from '@navet/app/components/shared/theme/theme-colors';
import { useDashboardWidgetRoomOptions } from '@navet/app/features/dashboard/components/widgets/use-widget-room-options';
import { useAreaRooms, useI18n, useTheme } from '@navet/app/hooks';
import { normalizeChoreExperienceState } from '@navet/core/chore-experience';
import { memo, useEffect, useMemo, useState } from 'react';
import { getChoreCardAction } from '../../chore-card-action';
import { resolveChoreColorPalette } from '../../chore-color-palette';
import { getDefinition, getTodayChoresForParticipant } from '../../chore-dashboard-selectors';
import { getHomeworkBoard } from '../../chore-homework-selectors';
import { resolveChoreWidgetState, useChoreCardParticipant } from '../../use-chore-card-participant';
import { CHORE_CARD_EVERYONE, ChoreCardPersonDialog } from '../chore-card-person-dialog';
import type { ChoresCardRow } from '../chores-card/view';
import type { HomeworkCardRow } from '../homework-card/view';
import { PersonCardView } from './view';

export interface PersonCardData {
  participantId?: string;
  /** Header override. Empty falls back to the person's name. */
  title?: string;
  tintColor?: string;
}

export interface PersonCardProps {
  size?: CardSize;
  data?: PersonCardData;
  onUpdate?: (data: PersonCardData) => void;
  isEditMode?: boolean;
  room?: string;
  onRoomChange?: (room: string) => void;
  openSettingsRequestKey?: number;
}

/**
 * One household member's day on a single card: their own chores, the shared chores they are
 * eligible for, and their homework, split into labelled sections. One card per kid on a wall
 * display beats two cards each.
 */
export const PersonCard = memo(function PersonCard({
  size = 'medium',
  data,
  onUpdate,
  room,
  onRoomChange,
  openSettingsRequestKey = 0,
}: PersonCardProps) {
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

  // A shared "anyone" occurrence carries every eligible person in `assigneeIds`, so the common
  // chores this person can pick up arrive through the same selector as their own.
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

  const choreRows = useMemo<ChoresCardRow[]>(() => {
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

  const homeworkRows = useMemo<HomeworkCardRow[]>(() => {
    if (!workspace) return [];
    // getHomeworkBoard filters on a real participant id; it has no "everyone" sentinel.
    const board = getHomeworkBoard(workspace, {
      participantId: participantId === CHORE_CARD_EVERYONE ? undefined : participantId,
      now,
      days: 1,
    });
    const activeIds = new Set(participants.map((participant) => participant.id));
    // Unfinished homework from earlier days stays off the dashboard; the Homework page keeps it.
    const todayEntries = (board.days[0]?.entries ?? []).filter((entry) =>
      entry.definition.assignment.participantIds.some((id) => activeIds.has(id))
    );

    return todayEntries.map((entry) => {
      const assignee = entry.definition.assignment.participantIds[0] ?? '';
      return {
        definition: entry.definition,
        occurrence: entry.occurrence,
        action:
          entry.occurrence && assignee
            ? getChoreCardAction(entry.occurrence, entry.definition, assignee, execute, t)
            : undefined,
      };
    });
  }, [execute, now, participantId, participants, t, workspace]);

  const remaining =
    choreRows.filter((row) => row.occurrence.status !== 'done').length +
    homeworkRows.filter((row) => row.occurrence?.status !== 'done').length;
  const total = choreRows.length + homeworkRows.length;

  const selectedParticipant =
    participantId === CHORE_CARD_EVERYONE ? undefined : workspace?.participantsById[participantId];

  const tintColor = useMemo(() => {
    if (typeof data?.tintColor === 'string') return data.tintColor;
    if (!workspace) return undefined;
    if (remaining === 0 && total > 0) return themeColorValues.green;
    return selectedParticipant
      ? resolveChoreColorPalette(`person:${selectedParticipant.id}`, selectedParticipant.color)
          .primary
      : undefined;
  }, [data?.tintColor, remaining, selectedParticipant, total, workspace]);

  const defaultTitle = selectedParticipant?.displayName ?? t('household.personPicker.all');
  const state = resolveChoreWidgetState({
    choresEnabled,
    status,
    hasWorkspace: Boolean(workspace),
    hasRows: total > 0,
  });

  return (
    <>
      <PersonCardView
        size={size}
        theme={theme}
        state={state}
        title={data?.title?.trim() || defaultTitle}
        choreRows={choreRows}
        homeworkRows={homeworkRows}
        participantsById={workspace?.participantsById ?? {}}
        now={now}
        remaining={remaining}
        tintColor={tintColor}
        childMode={childMode}
        showPoints={showPoints}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      {isSettingsOpen ? (
        <ChoreCardPersonDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          title={defaultTitle}
          description={t('household.personCard.settingsDescription')}
          participants={participants}
          selectedParticipantId={participantId}
          cardTitle={data?.title}
          cardTitlePlaceholder={defaultTitle}
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
