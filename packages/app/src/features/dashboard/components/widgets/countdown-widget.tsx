import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { useAreaRooms } from '@navet/app/hooks';
import { useEffect, useState } from 'react';
import { CountdownSettingsDialog } from './countdown-settings-dialog';
import {
  type CountdownCardData,
  resolveCountdownDisplay,
  resolveCountdownTargetFromData,
} from './countdown-widget-data';
import { CountdownWidgetView } from './countdown-widget-view';
import { useCountdownClock } from './use-countdown-clock';
import { useDashboardWidgetRoomOptions } from './use-widget-room-options';

/** Whole days only have to change at midnight; the full breakdown owes the user a second hand. */
const DAYS_TICK_MS = 60 * 1000;
const FULL_TICK_MS = 1000;

export interface CountdownWidgetProps {
  size?: CardSize;
  room?: string;
  onRoomChange?: (room: string) => void;
  data?: CountdownCardData;
  onUpdate?: (data: Partial<CountdownCardData>) => void;
  isEditMode?: boolean;
  openSettingsRequestKey?: number;
}

export function CountdownWidget({
  size = 'medium',
  room,
  onRoomChange,
  data,
  onUpdate,
  openSettingsRequestKey = 0,
}: CountdownWidgetProps) {
  const rooms = useAreaRooms();
  const { roomValue, roomLabel, roomOptions } = useDashboardWidgetRoomOptions(room, rooms);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const display = resolveCountdownDisplay(data?.display);
  const target = resolveCountdownTargetFromData(data);
  const now = useCountdownClock(display === 'full' && target ? FULL_TICK_MS : DAYS_TICK_MS);
  const canConfigure = typeof onUpdate === 'function';

  useEffect(() => {
    if (openSettingsRequestKey > 0 && canConfigure) {
      setIsSettingsOpen(true);
    }
  }, [canConfigure, openSettingsRequestKey]);

  return (
    <>
      <CountdownWidgetView
        size={size}
        now={now}
        title={data?.title}
        target={target}
        display={display}
        background={data?.background}
        tintColor={data?.tintColor}
        canConfigure={canConfigure}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      {onUpdate ? (
        <CountdownSettingsDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          roomValue={roomValue}
          roomLabel={roomLabel}
          roomOptions={roomOptions}
          onRoomChange={onRoomChange}
          data={data ?? {}}
          onUpdate={onUpdate}
          onTintColorChange={(tintColor) => onUpdate({ tintColor })}
        />
      ) : null}
    </>
  );
}
