import type { CardSize } from '@navet/app/components/shared/card-size';
import { getCardSizeOverlayStyle } from '@navet/app/components/shared/card-size-selector';
import { useTheme } from '@navet/app/hooks';
import { getStoryDocsDescription } from '@navet/app/storybook/story-docs';
import { EntityCardStoryFrame } from '@navet/app/storybook/story-frames';
import {
  buildAgendaDayKeys,
  buildMonthGridWeeks,
  expandCalendarEventsByDay,
  getMonthGridRange,
} from '@navet/core/calendar-agenda';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarAgendaDaysView } from './calendar-agenda-days-view';
import { CalendarMonthView } from './calendar-month-view';
import type { CalendarEvent } from './types';
import { useCalendarTheme } from './use-calendar-theme';

// A fixed week so the layout, the today marker and the carried-over events are the same on every
// run. 22 September 2026 is a Tuesday, which gives the month grid a leading and a trailing week.
const TODAY_KEY = '2026-09-22';
const FIRST_DAY_OF_WEEK = 1;

function at(day: number, hour: number, minute = 0) {
  return new Date(2026, 8, day, hour, minute, 0, 0).toISOString();
}

function timed(
  id: string,
  title: string,
  color: string,
  day: number,
  hour: number,
  endHour: number
): CalendarEvent {
  return {
    id,
    title,
    startTime: `${String(hour).padStart(2, '0')}:00`,
    endTime: `${String(endHour).padStart(2, '0')}:00`,
    timeDisplay: `${String(hour).padStart(2, '0')}:00`,
    startDateTime: at(day, hour),
    endDateTime: at(day, endHour),
    sortKey: at(day, hour),
    type: 'event',
    color,
  };
}

function allDay(id: string, title: string, color: string, start: string, end?: string) {
  return {
    id,
    title,
    startTime: '--',
    endTime: '--',
    timeDisplay: '--',
    startDateTime: start,
    endDateTime: end,
    isAllDay: true,
    sortKey: start,
    type: 'event',
    color,
  } satisfies CalendarEvent;
}

const events: CalendarEvent[] = [
  timed('band', 'Band practice', 'bg-indigo-500', 22, 18, 20),
  allDay('hike', 'August hiking day', 'bg-green-500', '2026-09-23'),
  timed('lesson', 'Swimming lessons', 'bg-blue-500', 23, 15, 16),
  // Two days, published the way CalDAV publishes it: the end date is exclusive.
  allDay('visit', 'Grandparents visiting', 'bg-orange-500', '2026-09-26', '2026-09-28'),
  timed('party', 'Party at number 22', 'bg-purple-500', 26, 19, 23),
  timed('meetup', 'Neighbourhood meetup', 'bg-blue-500', 28, 18, 21),
  timed('dinner', 'Dinner with Kaja and Tonje', 'bg-red-500', 29, 17, 20),
  timed('fibre', 'Fibre install, someone home', 'bg-amber-500', 30, 8, 12),
  timed('volleyball', 'Volleyball', 'bg-teal-500', 30, 18, 20),
];

function useStoryTheme() {
  const { theme } = useTheme();
  return useCalendarTheme(theme);
}

function AgendaDaysStory({
  size,
  dayCount,
  layout,
}: {
  size: CardSize;
  dayCount: number;
  layout: 'stacked' | 'split';
}) {
  const tokens = useStoryTheme();
  const dayKeys = buildAgendaDayKeys(TODAY_KEY, dayCount);
  const occurrencesByDay = expandCalendarEventsByDay(
    events,
    dayKeys[0],
    dayKeys[dayKeys.length - 1]
  );

  return (
    <EntityCardStoryFrame size={size} className="overflow-hidden rounded-3xl">
      <div className="flex h-full flex-col p-3" style={getCardSizeOverlayStyle(size)}>
        <CalendarAgendaDaysView
          dayKeys={dayKeys}
          todayDateKey={TODAY_KEY}
          occurrencesByDay={occurrencesByDay}
          layout={layout}
          textPrimary={tokens.textPrimary}
          textSecondary={tokens.textSecondary}
          dividerColor={tokens.dividerColor}
          chipBg={tokens.chipBg}
          chipHoverBg={tokens.chipHoverBg}
          onEventClick={() => undefined}
        />
      </div>
    </EntityCardStoryFrame>
  );
}

function MonthStory({ size, withEvents }: { size: CardSize; withEvents: boolean }) {
  const tokens = useStoryTheme();
  const weeks = buildMonthGridWeeks(TODAY_KEY, TODAY_KEY, FIRST_DAY_OF_WEEK);
  const { startDateKey, endDateKey } = getMonthGridRange(TODAY_KEY, FIRST_DAY_OF_WEEK);
  const occurrencesByDay = expandCalendarEventsByDay(
    withEvents ? events : [],
    startDateKey,
    endDateKey
  );

  return (
    <EntityCardStoryFrame size={size} className="overflow-hidden rounded-3xl">
      <div className="flex h-full flex-col p-3" style={getCardSizeOverlayStyle(size)}>
        <CalendarMonthView
          weeks={weeks}
          occurrencesByDay={occurrencesByDay}
          firstDayOfWeek={FIRST_DAY_OF_WEEK}
          textPrimary={tokens.textPrimary}
          textSecondary={tokens.textSecondary}
          dividerColor={tokens.dividerColor}
          chipBg={tokens.chipBg}
          chipHoverBg={tokens.chipHoverBg}
          todayBg={tokens.todayBg}
          onEventClick={() => undefined}
        />
      </div>
    </EntityCardStoryFrame>
  );
}

const meta = {
  title: 'Cards/Entity/Calendar Views',
  component: AgendaDaysStory,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['large', 'extra-large', 'extra-wide'] },
    dayCount: { control: { type: 'range', min: 3, max: 14, step: 1 } },
    layout: { control: 'inline-radio', options: ['stacked', 'split'] },
  },
  args: { size: 'extra-large', dayCount: 7, layout: 'split' },
  parameters: { docs: { description: {} } },
} satisfies Meta<typeof AgendaDaysStory>;

meta.parameters = {
  ...meta.parameters,
  docs: {
    ...meta.parameters?.docs,
    description: {
      ...meta.parameters?.docs?.description,
      component: getStoryDocsDescription(meta.title),
    },
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const AgendaSplit: Story = {};

export const AgendaStacked: Story = {
  args: { size: 'large', layout: 'stacked' },
};

export const AgendaShortestRange: Story = {
  args: { dayCount: 3, size: 'large', layout: 'stacked' },
};

export const AgendaLongestRange: Story = {
  args: { dayCount: 14 },
};

export const MonthGrid: Story = {
  // Only the widest card gives its cells room for titles; narrower ones fall back to dots.
  args: { size: 'extra-wide' },
  render: (args) => <MonthStory size={args.size} withEvents={true} />,
};

export const MonthGridNarrowCells: Story = {
  args: { size: 'extra-large' },
  render: (args) => <MonthStory size={args.size} withEvents={true} />,
};

export const MonthGridEmpty: Story = {
  render: (args) => <MonthStory size={args.size} withEvents={false} />,
};

export const Docs: Story = {
  parameters: { docsOnly: true },
};
