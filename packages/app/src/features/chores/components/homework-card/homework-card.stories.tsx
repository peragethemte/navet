import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { useTheme } from '@navet/app/hooks';
import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type { ChoreOccurrence, ChoreParticipant } from '@navet/core/chores';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChoreWidgetCardState } from '../chore-widget-card-shell';
import { type HomeworkCardRow, HomeworkCardView } from './view';

const NOW = new Date(2026, 8, 22, 17, 30);
const TIMESTAMP = '2026-09-22T06:00:00.000Z';

const PARTICIPANTS: Record<string, ChoreParticipant> = {
  sam: {
    id: 'sam',
    displayName: 'Sam',
    color: '#4f46e5',
    capabilities: ['complete'],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  lea: {
    id: 'lea',
    displayName: 'Lea',
    color: '#ca8a04',
    capabilities: ['complete'],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
};

function occurrence(
  definitionId: string,
  participantId: string,
  status: ChoreOccurrence['status'],
  dateKey: string
): ChoreOccurrence {
  return {
    id: `occ-${definitionId}`,
    definitionId,
    scheduledAt: `${dateKey}T00:00:00.000Z`,
    dueAt: `${dateKey}T23:59:00.000Z`,
    assigneeIds: [participantId],
    assignmentSlot: participantId,
    status,
    completedBy: status === 'done' ? participantId : undefined,
    updatedAt: TIMESTAMP,
  };
}

type Variant = 'default' | 'allDone' | 'notReady';

function rows(variant: Variant): HomeworkCardRow[] {
  const entries: Array<[string, string, string, string]> = [
    ['spelling', 'Spelling words, page 14', 'sam', '2026-09-22'],
    ['maths', 'Maths sheet 3B', 'lea', '2026-09-22'],
    ['reading', 'Read two chapters', 'sam', '2026-09-22'],
    ['french', 'French glossary', 'lea', '2026-09-22'],
  ];

  return entries.flatMap<HomeworkCardRow>(([id, title, participantId, dateKey]) => {
    const definition = createHomeworkDefinition({
      id,
      title,
      dateKey,
      timeZone: 'Europe/Oslo',
      participantId,
      timestamp: TIMESTAMP,
    });
    if (variant === 'notReady' && id === 'spelling') {
      return [{ definition }];
    }
    const status = variant === 'allDone' ? ('done' as const) : ('available' as const);
    return [
      {
        definition,
        occurrence: occurrence(id, participantId, status, dateKey),
        action:
          status === 'done'
            ? undefined
            : { label: 'Done', kind: 'complete' as const, onSelect: () => {} },
      },
    ];
  });
}

function HomeworkStory({
  size,
  variant,
  state,
  tintColor,
}: {
  size: CardSize;
  variant: Variant;
  state: ChoreWidgetCardState;
  tintColor?: string;
}) {
  const { theme } = useTheme();
  const cardRows = state === 'ready' ? rows(variant) : [];
  const remaining = cardRows.filter((row) => row.occurrence?.status !== 'done').length;

  return (
    <div style={{ width: size === 'small' ? 180 : 340, height: size === 'large' ? 360 : 180 }}>
      <HomeworkCardView
        size={size}
        theme={theme}
        state={state}
        title="Homework"
        rows={cardRows}
        participantsById={PARTICIPANTS}
        now={NOW}
        remaining={remaining}
        tintColor={tintColor}
        onOpenSettings={() => {}}
      />
    </div>
  );
}

const meta = {
  title: 'Cards/Custom/Homework',
  component: HomeworkStory,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
    variant: { control: 'inline-radio', options: ['default', 'allDone', 'notReady'] },
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
          "Today's homework, ticked off from the dashboard. Anything left from earlier days drops off here and stays on the Homework page. Homework keeps one colour per person, so a card filtered to one child reads as theirs at a glance.",
      },
    },
  },
} satisfies Meta<typeof HomeworkStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = { args: { size: 'small' } };

export const Medium: Story = { args: { size: 'medium' } };

export const Large: Story = { args: { size: 'large' } };

export const AllDone: Story = { args: { size: 'large', variant: 'allDone' } };

export const NotMaterialized: Story = { args: { size: 'large', variant: 'notReady' } };

export const Empty: Story = { args: { state: 'empty' } };

export const Unavailable: Story = { args: { state: 'unavailable' } };
