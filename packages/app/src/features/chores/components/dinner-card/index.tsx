import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { useDashboardWidgetRoomOptions } from '@navet/app/features/dashboard/components/widgets/use-widget-room-options';
import { useAreaRooms, useI18n, useTheme } from '@navet/app/hooks';
import { memo, useEffect, useMemo, useState } from 'react';
import { getDinnerBoard } from '../../chore-dinner-selectors';
import { resolveChoreWidgetState, useChoreCardParticipant } from '../../use-chore-card-participant';
import { ChoreCardPersonDialog, clampChoreCardDays } from '../chore-card-person-dialog';
import { type DinnerCardRow, DinnerCardView } from './view';

export interface DinnerCardData {
  /** Days shown from today; 1 (the default) is today only. */
  days?: number;
  /** Header override. Empty falls back to the generic "Dinner" label. */
  title?: string;
  tintColor?: string;
}

export interface DinnerCardProps {
  size?: CardSize;
  data?: DinnerCardData;
  onUpdate?: (data: DinnerCardData) => void;
  isEditMode?: boolean;
  room?: string;
  onRoomChange?: (room: string) => void;
  openSettingsRequestKey?: number;
}

export const DinnerCard = memo(function DinnerCard({
  size = 'medium',
  data,
  onUpdate,
  room,
  onRoomChange,
  openSettingsRequestKey = 0,
}: DinnerCardProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const rooms = useAreaRooms();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { roomValue, roomLabel, roomOptions } = useDashboardWidgetRoomOptions(room, rooms);
  const { choresEnabled, workspace, status, now, participantId } =
    useChoreCardParticipant(undefined);
  const days = clampChoreCardDays(data?.days);

  useEffect(() => {
    if (openSettingsRequestKey > 0) setIsSettingsOpen(true);
  }, [openSettingsRequestKey]);

  const rows = useMemo<DinnerCardRow[]>(() => {
    if (!workspace) return [];
    return getDinnerBoard(workspace, { now, days }).flatMap((day) =>
      day.dinner ? [{ dateKey: day.dateKey, dinner: day.dinner }] : []
    );
  }, [days, now, workspace]);

  const state = resolveChoreWidgetState({
    choresEnabled,
    status,
    hasWorkspace: Boolean(workspace),
    hasRows: rows.length > 0,
  });
  const tintColor = typeof data?.tintColor === 'string' ? data.tintColor : undefined;

  return (
    <>
      <DinnerCardView
        size={size}
        theme={theme}
        state={state}
        title={data?.title?.trim() || t('dinner.card.title')}
        rows={rows}
        now={now}
        tintColor={tintColor}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      {isSettingsOpen ? (
        <ChoreCardPersonDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          title={t('dinner.card.title')}
          description={t('dinner.card.settingsDescription')}
          participants={[]}
          selectedParticipantId={participantId}
          cardTitle={data?.title}
          cardTitlePlaceholder={t('dinner.card.title')}
          onCardTitleChange={
            onUpdate ? (nextTitle) => onUpdate({ ...data, title: nextTitle }) : undefined
          }
          days={days}
          onDaysChange={onUpdate ? (nextDays) => onUpdate({ ...data, days: nextDays }) : undefined}
          roomValue={roomValue}
          roomLabel={roomLabel}
          roomOptions={roomOptions}
          onRoomChange={onRoomChange}
          tintColor={tintColor}
          onTintColorChange={
            onUpdate ? (nextTint) => onUpdate({ ...data, tintColor: nextTint }) : undefined
          }
        />
      ) : null}
    </>
  );
});
