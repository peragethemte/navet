import { useI18n } from '@navet/app/hooks';
import type { CalendarDayOccurrence, CalendarMonthDay } from '@navet/core/calendar-agenda';
import { CalendarEventChip } from './calendar-event-chip';
import { formatCalendarWeekdayHeaders } from './calendar-formatters';
import type { CalendarEvent } from './types';

type OccurrencesByDay = Map<string, CalendarDayOccurrence<CalendarEvent>[]>;

// A cell narrower than this cannot carry a readable title, so the day collapses to coloured dots.
// Written out rather than composed from a constant: Tailwind only generates classes it can see.
const MAX_CHIPS_PER_CELL = 3;
const MAX_DOTS_PER_CELL = 4;

interface CalendarMonthViewProps {
  weeks: CalendarMonthDay[][];
  occurrencesByDay: OccurrencesByDay;
  firstDayOfWeek: number;
  textPrimary: string;
  textSecondary: string;
  dividerColor: string;
  chipBg: string;
  chipHoverBg: string;
  todayBg: string;
  onEventClick?: (event: CalendarEvent) => void;
}

interface MonthDayCellProps {
  day: CalendarMonthDay;
  occurrences: CalendarDayOccurrence<CalendarEvent>[];
  textPrimary: string;
  textSecondary: string;
  chipBg: string;
  chipHoverBg: string;
  todayBg: string;
  moreLabel: (count: number) => string;
  onEventClick?: (event: CalendarEvent) => void;
}

function MonthDayCell({
  day,
  occurrences,
  textPrimary,
  textSecondary,
  chipBg,
  chipHoverBg,
  todayBg,
  moreLabel,
  onEventClick,
}: MonthDayCellProps) {
  const visibleChips = occurrences.slice(0, MAX_CHIPS_PER_CELL);
  const hiddenChipCount = occurrences.length - visibleChips.length;
  const visibleDots = occurrences.slice(0, MAX_DOTS_PER_CELL);
  const hiddenDotCount = occurrences.length - visibleDots.length;

  return (
    <div
      className={`@container/day flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md p-1 ${
        day.isToday ? todayBg : ''
      }`}
      // Borrowed days from the neighbouring months stay readable but recede, so the month itself
      // keeps its shape. Past days recede less: they are still this month's history.
      style={{ opacity: day.inCurrentMonth ? (day.isPast ? 0.62 : 1) : 0.38 }}
    >
      <div
        className={`flex-shrink-0 text-[10px] leading-none ${day.isToday ? 'font-bold' : 'font-medium'}`}
        style={{ color: day.isToday ? textPrimary : textSecondary }}
      >
        {day.dayNumber}
      </div>

      {occurrences.length === 0 ? null : (
        <>
          <div className="mt-0.5 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden @min-[104px]/day:flex">
            {visibleChips.map((occurrence) => (
              <CalendarEventChip
                key={`${occurrence.event.id}-${occurrence.dateKey}`}
                event={occurrence.event}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                chipBg={chipBg}
                chipHoverBg={chipHoverBg}
                continuesFromPreviousDay={occurrence.continuesFromPreviousDay}
                continuesIntoNextDay={occurrence.continuesIntoNextDay}
                density="dense"
                onItemClick={onEventClick ? () => onEventClick(occurrence.event) : undefined}
              />
            ))}
            {hiddenChipCount > 0 ? (
              <div className="truncate text-[9px] leading-none" style={{ color: textSecondary }}>
                {moreLabel(hiddenChipCount)}
              </div>
            ) : null}
          </div>

          <div
            className="mt-1 flex flex-wrap items-center gap-0.5 @min-[104px]/day:hidden"
            aria-hidden="true"
          >
            {visibleDots.map((occurrence) => (
              <span
                key={`${occurrence.event.id}-${occurrence.dateKey}`}
                className={`h-1.5 w-1.5 rounded-full ${occurrence.event.color}`}
              />
            ))}
            {hiddenDotCount > 0 ? (
              <span className="text-[9px] leading-none" style={{ color: textSecondary }}>
                {moreLabel(hiddenDotCount)}
              </span>
            ) : null}
          </div>

          {/* The dot row carries no titles, so the count stays available to assistive tech. */}
          <span className="sr-only">
            {occurrences.map((occurrence) => occurrence.event.title).join(', ')}
          </span>
        </>
      )}
    </div>
  );
}

export function CalendarMonthView({
  weeks,
  occurrencesByDay,
  firstDayOfWeek,
  textPrimary,
  textSecondary,
  dividerColor,
  chipBg,
  chipHoverBg,
  todayBg,
  onEventClick,
}: CalendarMonthViewProps) {
  const { locale, t } = useI18n();
  const weekdayHeaders = formatCalendarWeekdayHeaders(locale, firstDayOfWeek);
  const moreLabel = (count: number) => t('calendar.moreEvents', { count });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid flex-shrink-0 grid-cols-7 gap-1 pb-1">
        {weekdayHeaders.map((weekday, index) => (
          <div
            key={`${index}-${weekday}`}
            className="truncate px-1 text-[10px] uppercase leading-none tracking-[0.1em]"
            style={{ color: textSecondary }}
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className={`h-px flex-shrink-0 ${dividerColor}`} aria-hidden="true" />

      <div
        className="mt-1 grid min-h-0 flex-1 grid-cols-7 gap-1"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.flat().map((day) => (
          <MonthDayCell
            key={day.dateKey}
            day={day}
            occurrences={occurrencesByDay.get(day.dateKey) ?? []}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            chipBg={chipBg}
            chipHoverBg={chipHoverBg}
            todayBg={todayBg}
            moreLabel={moreLabel}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}
