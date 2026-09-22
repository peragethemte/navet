import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { useTheme } from '@navet/app/hooks';
import type { ChoreDefinition, ChoreOccurrence, ChoreParticipant } from '@navet/core/chores';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChoreWidgetCardState } from '../chore-widget-card-shell';
import { type ChoresCardRow, ChoresCardView } from './view';

const NOW = new Date(2026, 8, 22, 17, 30);
const TIMESTAMP = '2026-09-22T06:00:00.000Z';

const PARTICIPANTS: Record<string, ChoreParticipant> = {
  sam: {
    id: 'sam',
    displayName: 'Sam',
    color: '#0891b2',
    capabilities: ['complete'],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  lea: {
    id: 'lea',
    displayName: 'Lea',
    color: '#db2777',
    capabilities: ['complete'],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
};

function definition(
  id: string,
  title: string,
  participantId: string,
  icon: string
): ChoreDefinition {
  return {
    id,
    title,
    icon,
    roomRef: { canonicalId: `room:${id}`, label: 'Kitchen' },
    enabled: true,
    assignment: { mode: 'person', participantIds: [participantId] },
    schedule: {
      frequency: 'daily',
      startDate: '2026-09-01',
      time: '17:00',
      timeZone: 'Europe/Oslo',
    },
    dueWindowMinutes: 120,
    approval: { required: false, approverIds: [] },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function occurrence(
  definitionId: string,
  participantId: string,
  status: ChoreOccurrence['status'],
  dueAt: string
): ChoreOccurrence {
  return {
    id: `occ-${definitionId}`,
    definitionId,
    scheduledAt: '2026-09-22T15:00:00.000Z',
    dueAt,
    assigneeIds: [participantId],
    assignmentSlot: participantId,
    status,
    completedBy: status === 'done' ? participantId : undefined,
    completedAt: status === 'done' ? '2026-09-22T15:20:00.000Z' : undefined,
    updatedAt: TIMESTAMP,
  };
}

const LATER = '2026-09-22T20:00:00.000Z';
const PAST = '2026-09-22T12:00:00.000Z';

function rows(variant: 'default' | 'overdue' | 'allDone'): ChoresCardRow[] {
  const entries: Array<[string, string, string, string, ChoreOccurrence['status'], string]> = [
    ['dishes', 'Empty the dishwasher', 'sam', 'Utensils', 'available', LATER],
    ['bins', 'Take out the bins', 'lea', 'Trash2', 'available', LATER],
    ['laundry', 'Fold the laundry', 'sam', 'Shirt', 'claimed', LATER],
    ['floor', 'Vacuum the hallway', 'lea', 'Wind', 'available', LATER],
    ['plants', 'Water the plants', 'sam', 'Sprout', 'available', LATER],
  ];

  return entries.map(([id, title, participantId, icon, status, dueAt], index) => {
    const resolvedStatus = variant === 'allDone' ? 'done' : status;
    const resolvedDueAt = variant === 'overdue' && index < 2 ? PAST : dueAt;
    return {
      definition: definition(id, title, participantId, icon),
      occurrence: occurrence(id, participantId, resolvedStatus, resolvedDueAt),
      presentation: { points: 10 + index * 5, estimatedMinutes: 5 },
      action:
        resolvedStatus === 'done'
          ? undefined
          : { label: 'Done', kind: 'complete' as const, onSelect: () => {} },
    };
  });
}

function ChoresStory({
  size,
  variant,
  state,
  tintColor,
}: {
  size: CardSize;
  variant: 'default' | 'overdue' | 'allDone';
  state: ChoreWidgetCardState;
  tintColor?: string;
}) {
  const { theme } = useTheme();
  const cardRows = state === 'ready' ? rows(variant) : [];
  const overdue = variant === 'overdue' ? 2 : 0;
  const remaining = variant === 'allDone' ? 0 : cardRows.length;

  return (
    <div style={{ width: size === 'small' ? 180 : 340, height: size === 'large' ? 360 : 180 }}>
      <ChoresCardView
        size={size}
        theme={theme}
        state={state}
        title="Chores"
        rows={cardRows}
        participantsById={PARTICIPANTS}
        now={NOW}
        remaining={remaining}
        overdue={overdue}
        tintColor={tintColor}
        onOpenSettings={() => {}}
      />
    </div>
  );
}

const meta = {
  title: 'Cards/Custom/Chores',
  component: ChoresStory,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
    variant: { control: 'inline-radio', options: ['default', 'overdue', 'allDone'] },
    state: {
      control: 'inline-radio',
      options: ['ready', 'empty', 'loading', 'disabled', 'unavailable'],
    },
    tintColor: { control: 'color' },
  },
  args: { size: 'medium', variant: 'default', state: 'ready' },
  parameters: {
    docs: {
      description: {
        component:
          "Today's household chores on the dashboard. Each row keeps the chore's own colour, icon and assignee avatar from the Household cards, and the card itself takes the colour of the state it is in: red while anything is overdue, green once the day is clear.",
      },
    },
  },
} satisfies Meta<typeof ChoresStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = { args: { size: 'small' } };

export const Medium: Story = { args: { size: 'medium' } };

export const Large: Story = { args: { size: 'large' } };

export const Overdue: Story = { args: { size: 'large', variant: 'overdue' } };

export const AllDone: Story = { args: { size: 'large', variant: 'allDone' } };

export const Empty: Story = { args: { state: 'empty' } };

export const ChoresTurnedOff: Story = { args: { state: 'disabled' } };

export const Unavailable: Story = { args: { state: 'unavailable' } };
