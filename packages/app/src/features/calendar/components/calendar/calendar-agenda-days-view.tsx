import { OverlayScrollArea } from '@navet/app/components/primitives';
import { useI18n } from '@navet/app/hooks';
import type { CalendarDayOccurrence } from '@navet/core/calendar-agenda';
import { CalendarEventChip } from './calendar-event-chip';
import { formatCalendarDayAndMonth, formatCalendarWeekdayName } from './calendar-formatters';
import type { CalendarEvent } from './types';

type OccurrencesByDay = Map<string, CalendarDayOccurrence<CalendarEvent>[]>;

interface CalendarAgendaDaysViewProps {
  dayKeys: string[];
  todayDateKey: string;
  occurrencesByDay: OccurrencesByDay;
  /** `split` puts the near days in their own lane beside the rest; `stacked` puts them above it. */
  layout: 'stacked' | 'split';
  textPrimary: string;
  textSecondary: string;
  dividerColor: string;
  chipBg: string;
  chipHoverBg: string;
  onEventClick?: (event: CalendarEvent) => void;
}

interface DayContentProps {
  dateKey: string;
  occurrencesByDay: OccurrencesByDay;
  textPrimary: string;
  textSecondary: string;
  chipBg: string;
  chipHoverBg: string;
  emptyLabel: string;
  onEventClick?: (event: CalendarEvent) => void;
}

/** The near days get room to breathe: one event per line, so today reads at a glance. */
function LeadDayEvents({
  dateKey,
  occurrencesByDay,
  textPrimary,
  textSecondary,
  chipBg,
  chipHoverBg,
  emptyLabel,
  onEventClick,
}: DayContentProps) {
  const occurrences = occurrencesByDay.get(dateKey) ?? [];

  if (occurrences.length === 0) {
    return (
      <div className="text-xs" style={{ color: textSecondary }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {occurrences.map((occurrence) => (
        <CalendarEventChip
          key={`${occurrence.event.id}-${occurrence.dateKey}`}
          event={occurrence.event}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          chipBg={chipBg}
          chipHoverBg={chipHoverBg}
          continuesFromPreviousDay={occurrence.continuesFromPreviousDay}
          continuesIntoNextDay={occurrence.continuesIntoNextDay}
          onItemClick={onEventClick ? () => onEventClick(occurrence.event) : undefined}
        />
      ))}
    </div>
  );
}

/**
 * A later day: its name on the left, its events flowing into as many columns as the card is wide
 * enough for. Days with nothing on them are still rendered, so the rhythm of the week stays legible.
 */
function DayRow({
  dateKey,
  locale,
  occurrencesByDay,
  textPrimary,
  textSecondary,
  chipBg,
  chipHoverBg,
  emptyLabel,
  onEventClick,
}: DayContentProps & { locale: string }) {
  const occurrences = occurrencesByDay.get(dateKey) ?? [];

  return (
    <div className="flex items-start gap-3">
      <div className="w-[68px] flex-shrink-0">
        <div className="truncate text-xs font-semibold capitalize" style={{ color: textPrimary }}>
          {formatCalendarWeekdayName(dateKey, locale)}
        </div>
        <div className="truncate text-[10px]" style={{ color: textSecondary }}>
          {formatCalendarDayAndMonth(dateKey, locale)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {occurrences.length === 0 ? (
          <div className="text-[10px]" style={{ color: textSecondary }}>
            {emptyLabel}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
            {occurrences.map((occurrence) => (
              <CalendarEventChip
                key={`${occurrence.event.id}-${occurrence.dateKey}`}
                event={occurrence.event}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                chipBg={chipBg}
                chipHoverBg={chipHoverBg}
                continuesFromPreviousDay={occurrence.continuesFromPreviousDay}
                continuesIntoNextDay={occurrence.continuesIntoNextDay}
                onItemClick={onEventClick ? () => onEventClick(occurrence.event) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarAgendaDaysView({
  dayKeys,
  todayDateKey,
  occurrencesByDay,
  layout,
  textPrimary,
  textSecondary,
  dividerColor,
  chipBg,
  chipHoverBg,
  onEventClick,
}: CalendarAgendaDaysViewProps) {
  const { locale, t } = useI18n();
  const leadKeys = dayKeys.slice(0, 2);
  const restKeys = dayKeys.slice(2);
  const emptyLabel = t('calendar.dayEmpty');
  const isSplit = layout === 'split';

  const leadLane = (
    <div className={isSplit ? 'space-y-4' : 'space-y-3'}>
      {leadKeys.map((dateKey, index) => (
        <div key={dateKey}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <div className="text-sm font-semibold capitalize" style={{ color: textPrimary }}>
              {dateKey === todayDateKey && index === 0
                ? t('calendar.today')
                : index === 1
                  ? t('calendar.tomorrow')
                  : formatCalendarWeekdayName(dateKey, locale)}
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.12em]"
              style={{ color: textSecondary }}
            >
              {formatCalendarDayAndMonth(dateKey, locale)}
            </div>
          </div>

          <LeadDayEvents
            dateKey={dateKey}
            occurrencesByDay={occurrencesByDay}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            chipBg={chipBg}
            chipHoverBg={chipHoverBg}
            emptyLabel={emptyLabel}
            onEventClick={onEventClick}
          />
        </div>
      ))}
    </div>
  );

  const restLane =
    restKeys.length === 0 ? null : (
      <div className="space-y-2">
        {restKeys.map((dateKey, index) => (
          <div key={dateKey}>
            <DayRow
              dateKey={dateKey}
              locale={locale}
              occurrencesByDay={occurrencesByDay}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              chipBg={chipBg}
              chipHoverBg={chipHoverBg}
              emptyLabel={emptyLabel}
              onEventClick={onEventClick}
            />
            {index < restKeys.length - 1 ? (
              <div className={`mt-2 h-px ${dividerColor}`} aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
    );

  if (!isSplit) {
    return (
      <OverlayScrollArea className="flex-1" contentClassName="pr-3" scrollbarStartInset={56}>
        <div className="space-y-3">
          {leadLane}
          {restLane ? <div className={`h-px ${dividerColor}`} aria-hidden="true" /> : null}
          {restLane}
        </div>
      </OverlayScrollArea>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="w-[38%] min-w-0 flex-shrink-0">
        <OverlayScrollArea className="h-full" contentClassName="pr-2" scrollbarStartInset={24}>
          {leadLane}
        </OverlayScrollArea>
      </div>

      <div className={`w-px flex-shrink-0 ${dividerColor}`} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <OverlayScrollArea className="h-full" contentClassName="pr-3" scrollbarStartInset={24}>
          {restLane}
        </OverlayScrollArea>
      </div>
    </div>
  );
}
