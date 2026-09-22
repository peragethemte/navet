import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { themeColorValues } from '@navet/app/components/shared/theme/theme-colors';
import { useDashboardWidgetRoomOptions } from '@navet/app/features/dashboard/components/widgets/use-widget-room-options';
import { useAreaRooms, useI18n, useTheme } from '@navet/app/hooks';
import { settingsSelectors } from '@navet/app/stores/selectors';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import { memo, useEffect, useMemo, useState } from 'react';
import { getChoreCardAction } from '../../chore-card-action';
import { resolveChoreColorPalette } from '../../chore-color-palette';
import { getHomeworkBoard, type HomeworkBoardEntry } from '../../chore-homework-selectors';
import { useChoreWorkspaceStore } from '../../chore-workspace-store';
import { useChoreClock } from '../../use-chore-clock';
import { useChoreMaterialization } from '../../use-chore-materialization';
import { useChoreWorkspaceSync } from '../../use-chore-workspace-sync';
import { CHORE_CARD_EVERYONE, ChoreCardPersonDialog } from '../chore-card-person-dialog';
import type { ChoreWidgetCardState } from '../chore-widget-card-shell';
import { type HomeworkCardRow, HomeworkCardView } from './view';

export interface HomeworkCardData {
  participantId?: string;
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

function homeworkDate(entry: HomeworkBoardEntry) {
  return entry.definition.schedule.frequency === 'once' ? entry.definition.schedule.date : '';
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
  const choresEnabled = useSettingsStore(settingsSelectors.choresEnabled);
  const workspace = useChoreWorkspaceStore((state) => state.data);
  const status = useChoreWorkspaceStore((state) => state.status);
  const execute = useChoreWorkspaceStore((state) => state.execute);
  const now = useChoreClock();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { roomValue, roomLabel, roomOptions } = useDashboardWidgetRoomOptions(room, rooms);

  useChoreWorkspaceSync(choresEnabled);
  useChoreMaterialization({ enabled: choresEnabled });

  useEffect(() => {
    if (openSettingsRequestKey > 0) setIsSettingsOpen(true);
  }, [openSettingsRequestKey]);

  const participants = useMemo(
    () =>
      workspace
        ? Object.values(workspace.participantsById).filter((participant) => !participant.pausedAt)
        : [],
    [workspace]
  );
  const storedParticipantId = data?.participantId;
  const participantId =
    storedParticipantId &&
    participants.some((participant) => participant.id === storedParticipantId)
      ? storedParticipantId
      : CHORE_CARD_EVERYONE;

  const rows = useMemo<HomeworkCardRow[]>(() => {
    if (!workspace) return [];
    // getHomeworkBoard filters on a real participant id; it has no "everyone" sentinel.
    const board = getHomeworkBoard(workspace, {
      participantId: participantId === CHORE_CARD_EVERYONE ? undefined : participantId,
      now,
      days: 1,
    });
    const activeIds = new Set(participants.map((participant) => participant.id));
    const keep = (entry: HomeworkBoardEntry) =>
      entry.definition.assignment.participantIds.some((id) => activeIds.has(id));
    // The board orders overdue by creation time; on a card the oldest due date reads better.
    const overdueEntries = [...board.overdue]
      .filter(keep)
      .sort((left, right) => homeworkDate(left).localeCompare(homeworkDate(right)));
    const todayEntries = (board.days[0]?.entries ?? []).filter(keep);

    return [...overdueEntries, ...todayEntries].map((entry) => {
      const assignee = entry.definition.assignment.participantIds[0] ?? '';
      return {
        definition: entry.definition,
        occurrence: entry.occurrence,
        overdue: overdueEntries.includes(entry),
        action:
          entry.occurrence && assignee
            ? getChoreCardAction(entry.occurrence, entry.definition, assignee, execute, t)
            : undefined,
      };
    });
  }, [execute, now, participantId, participants, t, workspace]);

  const remaining = rows.filter((row) => row.occurrence?.status !== 'done').length;
  const overdue = rows.filter((row) => row.overdue && row.occurrence?.status !== 'done').length;

  const tintColor = useMemo(() => {
    if (typeof data?.tintColor === 'string') return data.tintColor;
    if (!workspace) return undefined;
    if (overdue > 0) return themeColorValues.red;
    if (remaining === 0 && rows.length > 0) return themeColorValues.green;
    const selected =
      participantId === CHORE_CARD_EVERYONE ? undefined : workspace.participantsById[participantId];
    return selected
      ? resolveChoreColorPalette(`person:${selected.id}`, selected.color).primary
      : undefined;
  }, [data?.tintColor, overdue, participantId, remaining, rows.length, workspace]);

  const state: ChoreWidgetCardState = !choresEnabled
    ? 'disabled'
    : status === 'unavailable' || status === 'unauthorized' || status === 'error'
      ? 'unavailable'
      : !workspace
        ? 'loading'
        : rows.length === 0
          ? 'empty'
          : 'ready';

  return (
    <>
      <HomeworkCardView
        size={size}
        theme={theme}
        state={state}
        rows={rows}
        participantsById={workspace?.participantsById ?? {}}
        now={now}
        remaining={remaining}
        overdue={overdue}
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
