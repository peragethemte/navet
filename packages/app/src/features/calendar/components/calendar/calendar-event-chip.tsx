import { useI18n } from '@navet/app/hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCalendarEventTimeLabel } from './calendar-formatters';
import type { CalendarEvent } from './types';

interface CalendarEventChipProps {
  event: CalendarEvent;
  textPrimary: string;
  textSecondary: string;
  chipBg: string;
  chipHoverBg: string;
  continuesFromPreviousDay?: boolean;
  continuesIntoNextDay?: boolean;
  /** `dense` drops the time line, for month cells too small to carry two lines of text. */
  density?: 'default' | 'dense';
  onItemClick?: () => void;
}

/**
 * One event inside a day, sized for a row of columns or a month cell.
 *
 * Distinct from `CalendarEventItem` on purpose: the list item is a stacked row with its own time and
 * location lines, while a chip has to stay on one or two tight lines and carry the arrows that say
 * an event runs on from yesterday or into tomorrow.
 */
export function CalendarEventChip({
  event,
  textPrimary,
  textSecondary,
  chipBg,
  chipHoverBg,
  continuesFromPreviousDay = false,
  continuesIntoNextDay = false,
  density = 'default',
  onItemClick,
}: CalendarEventChipProps) {
  const { t } = useI18n();
  const isInteractive = typeof onItemClick === 'function';
  const isDense = density === 'dense';
  const timeLabel = formatCalendarEventTimeLabel(event, t('calendar.allDay'));

  const className = `flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md px-1.5 text-left ${chipBg} ${
    isDense ? 'py-0.5' : 'py-1'
  } ${isInteractive ? `${chipHoverBg} transition-colors` : ''}`;

  const content = (
    <>
      {continuesFromPreviousDay ? (
        <ChevronLeft
          className="h-3 w-3 flex-shrink-0"
          style={{ color: textSecondary }}
          aria-label={t('calendar.continuesFromPreviousDay')}
        />
      ) : (
        <span className={`min-h-4 w-0.5 flex-shrink-0 self-stretch rounded-full ${event.color}`} />
      )}

      <span className="min-w-0 flex-1">
        {isDense ? null : (
          <span
            className="block truncate text-[10px] leading-none"
            style={{ color: textSecondary }}
          >
            {timeLabel}
          </span>
        )}
        <span
          className={`block truncate font-semibold ${isDense ? 'text-[10px] leading-tight' : 'mt-0.5 text-xs leading-tight'}`}
          style={{ color: textPrimary }}
        >
          {event.title}
        </span>
      </span>

      {continuesIntoNextDay ? (
        <ChevronRight
          className="h-3 w-3 flex-shrink-0"
          style={{ color: textSecondary }}
          aria-label={t('calendar.continuesIntoNextDay')}
        />
      ) : null}
    </>
  );

  if (!isInteractive) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={(uiEvent) => {
        uiEvent.stopPropagation();
        onItemClick();
      }}
    >
      {content}
    </button>
  );
}
