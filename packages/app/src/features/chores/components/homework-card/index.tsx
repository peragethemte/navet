import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { themeColorValues } from '@navet/app/components/shared/theme/theme-colors';
import { useDashboardWidgetRoomOptions } from '@navet/app/features/dashboard/components/widgets/use-widget-room-options';
import { useAreaRooms, useI18n, useTheme } from '@navet/app/hooks';
import { memo, useEffect, useMemo, useState } from 'react';
import { getChoreCardAction } from '../../chore-card-action';
import { resolveChoreColorPalette } from '../../chore-color-palette';
import { getHomeworkBoard } from '../../chore-homework-selectors';
import { resolveChoreWidgetState, useChoreCardParticipant } from '../../use-chore-card-participant';
import { CHORE_CARD_EVERYONE, ChoreCardPersonDialog } from '../chore-card-person-dialog';
import { type HomeworkCardRow, HomeworkCardView } from './view';

export interface HomeworkCardData {
  participantId?: string;
  /** Header override. Empty falls back to the generic "Homework" label. */
  title?: string;
  tintColor?: string;
}

export interface HomeworkCardProps {
  size?: CardSize;
  data?: HomeworkCardData;
  onUpdate?: (data: HomeworkCardData) => void;
  isEditMode?: boolean;
  room?: string;
  onRoomChange?: (room: string) => void;
  openSettingsRequestKey?: number;
}

export const HomeworkCard = memo(function HomeworkCard({
  size = 'medium',
  data,
  onUpdate,
  room,
  onRoomChange,
  openSettingsRequestKey = 0,
}: HomeworkCardProps) {
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

  const rows = useMemo<HomeworkCardRow[]>(() => {
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

  const remaining = rows.filter((row) => row.occurrence?.status !== 'done').length;

  const tintColor = useMemo(() => {
    if (typeof data?.tintColor === 'string') return data.tintColor;
    if (!workspace) return undefined;
    if (remaining === 0 && rows.length > 0) return themeColorValues.green;
    const selected =
      participantId === CHORE_CARD_EVERYONE ? undefined : workspace.participantsById[participantId];
    return selected
      ? resolveChoreColorPalette(`person:${selected.id}`, selected.color).primary
      : undefined;
  }, [data?.tintColor, participantId, remaining, rows.length, workspace]);

  const state = resolveChoreWidgetState({
    choresEnabled,
    status,
    hasWorkspace: Boolean(workspace),
    hasRows: rows.length > 0,
  });

  return (
    <>
      <HomeworkCardView
        size={size}
        theme={theme}
        state={state}
        title={data?.title?.trim() || t('homework.card.title')}
        rows={rows}
        participantsById={workspace?.participantsById ?? {}}
        now={now}
        remaining={remaining}
        tintColor={tintColor}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      {isSettingsOpen ? (
        <ChoreCardPersonDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          title={t('homework.card.title')}
          description={t('homework.card.settingsDescription')}
          participants={participants}
          selectedParticipantId={participantId}
          cardTitle={data?.title}
          cardTitlePlaceholder={t('homework.card.title')}
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
