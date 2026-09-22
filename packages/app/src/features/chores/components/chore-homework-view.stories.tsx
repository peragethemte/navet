import { themeColorValues } from '@navet/app/components/shared/theme/theme-colors';
import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type { ChoreDefinition, ChoreParticipant, ChoreWorkspaceData } from '@navet/core/chores';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { ChoreHomeworkView } from './chore-homework-view';

const NOW = new Date();

function dateKey(dayOffset: number) {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + dayOffset);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function person(id: string, displayName: string, color: string): ChoreParticipant {
  return {
    id,
    displayName,
    color,
    capabilities: ['complete'],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

const maya = person('maya', 'Maya', themeColorValues.pink);
const sam = person('sam', 'Sam', themeColorValues.teal);
const alex = person('alex', 'Alex', themeColorValues.purple);

function homework(id: string, title: string, dayOffset: number, participantId: string) {
  return createHomeworkDefinition({
    id,
    title,
    dateKey: dateKey(dayOffset),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    participantId,
    timestamp: NOW.toISOString(),
  });
}

function dayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const due = new Date(year, month - 1, day, 23, 59);
  return { scheduledAt: start.toISOString(), dueAt: due.toISOString() };
}

function buildWorkspace(definitions: ChoreDefinition[], done: string[] = []): ChoreWorkspaceData {
  return {
    schemaVersion: 2,
    participantsById: { maya, sam, alex },
    definitionsById: Object.fromEntries(definitions.map((item) => [item.id, item])),
    occurrencesById: Object.fromEntries(
      definitions.map((definition) => {
        const bounds = dayBounds(
          definition.schedule.frequency === 'once' ? definition.schedule.date : dateKey(0)
        );
        return [
          `${definition.id}:1`,
          {
            id: `${definition.id}:1`,
            definitionId: definition.id,
            ...bounds,
            assigneeIds: definition.assignment.participantIds,
            assignmentSlot: definition.assignment.participantIds[0] ?? 'shared',
            status: done.includes(definition.id) ? ('done' as const) : ('available' as const),
            updatedAt: bounds.scheduledAt,
          },
        ];
      })
    ),
    activity: [],
    outbox: [],
  };
}

const filled = buildWorkspace(
  [
    homework('maths-today', 'Maths page 42 to 43', 0, 'maya'),
    homework('reading-today', 'Read chapter 3 of the class novel', 0, 'maya'),
    homework('spelling', 'Spelling words for Friday', 1, 'maya'),
    homework('science', 'Finish the plant growth table', 3, 'maya'),
    homework('history', 'Notes on the Viking trade routes', 6, 'maya'),
    homework('french', 'Learn the ten new verbs', 2, 'sam'),
  ],
  ['reading-today']
);

const overdue = buildWorkspace([homework('maths-late', 'Maths page 38', -3, 'maya')]);

const meta = {
  title: 'Pages/Household/Homework',
  component: ChoreHomeworkView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Per-person homework board covering today and the next nine days. Entries are one line of text and are completed from the Today view like any other chore.',
      },
    },
  },
  args: {
    data: filled,
    participants: [maya, sam, alex],
    canManage: true,
    onAdd: fn(async () => true),
    onRename: fn(async () => true),
    onRemove: fn(),
    onComplete: fn(),
  },
} satisfies Meta<typeof ChoreHomeworkView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const WideDesktop: Story = {
  globals: { viewport: { value: 'desktop1440p' } },
};

export const TabletLandscape: Story = {
  globals: { viewport: { value: 'ipadPro', isRotated: true } },
};

export const TabletPortrait: Story = {
  globals: { viewport: { value: 'ipadPro' } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile1' } },
};

export const EmptyWindow: Story = {
  args: { data: buildWorkspace([]) },
};

export const CarriedForward: Story = {
  args: { data: overdue },
};

export const ManagerLocked: Story = {
  args: { canManage: false },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
};

export const DarkTheme: Story = {
  globals: { theme: 'dark' },
};

export const BlackTheme: Story = {
  globals: { theme: 'black', motion: 'reduced', effectsQuality: 'reduced' },
};

export const AddEntry: Story = {
  play: async ({ canvas, args }) => {
    const addButtons = await canvas.findAllByRole('button', {
      name: /^Add homework for Maya on/,
    });
    await userEvent.click(addButtons[0]);
    const field = await canvas.findByRole('textbox');
    await userEvent.type(field, 'Geography map work{Enter}');
    await expect(args.onAdd).toHaveBeenCalled();
    await expect(field).toHaveValue('');
  },
};
