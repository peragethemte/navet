import { BaseCardDialogWithState } from '@navet/app/components/primitives';
import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { useDashboardWidgetRoomOptions } from '@navet/app/features/dashboard/components/widgets/use-widget-room-options';
import { useAreaRooms, useI18n, useTheme } from '@navet/app/hooks';
import { useSettingsStore } from '@navet/app/stores';
import { memo, useEffect, useState } from 'react';
import { useTransitDepartures } from '../../use-transit-departures';
import { TransitDeparturesCardView } from './view';

export interface TransitCardData {
  tintColor?: string;
}

export interface TransitDeparturesCardProps {
  size?: CardSize;
  data?: TransitCardData;
  onUpdate?: (data: TransitCardData) => void;
  isEditMode?: boolean;
  room?: string;
  onRoomChange?: (room: string) => void;
  openSettingsRequestKey?: number;
}

/** Every card size requests the same number, so resizing reuses the cached plan instead of refetching. */
const REQUESTED_ALTERNATIVES = 3;

export const TransitDeparturesCard = memo(function TransitDeparturesCard({
  size = 'medium',
  data,
  onUpdate,
  isEditMode = false,
  room,
  onRoomChange,
  openSettingsRequestKey = 0,
}: TransitDeparturesCardProps) {
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const rooms = useAreaRooms();
  const use24HourTime = useSettingsStore((state) => state.use24HourTime);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { board, now, hasJourneys } = useTransitDepartures(REQUESTED_ALTERNATIVES);
  const { roomValue, roomLabel, roomOptions } = useDashboardWidgetRoomOptions(room, rooms);
  const tintColor = typeof data?.tintColor === 'string' ? data.tintColor : undefined;

  useEffect(() => {
    if (openSettingsRequestKey > 0) {
      setIsSettingsOpen(true);
    }
  }, [openSettingsRequestKey]);

  return (
    <>
      <TransitDeparturesCardView
        board={board}
        now={now}
        hasJourneys={hasJourneys}
        size={size}
        theme={theme}
        locale={locale}
        use24HourTime={use24HourTime}
        tintColor={tintColor}
        isEditMode={isEditMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      {isSettingsOpen ? (
        <BaseCardDialogWithState
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          title={t('transit.title')}
          description={t('transit.settings.description')}
          roomSelector={{
            value: roomValue,
            label: roomLabel,
            options: roomOptions,
            onChange: onRoomChange,
          }}
          tintColor={tintColor}
          onTintColorChange={
            onUpdate
              ? (nextTintColor) => onUpdate({ ...data, tintColor: nextTintColor })
              : undefined
          }
          controlsTabContent={null}
          theme={theme}
          maxWidth="md"
          height="capped"
        />
      ) : null}
    </>
  );
});
