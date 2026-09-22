import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { useTheme } from '@navet/app/hooks';
import type { TransitJourney } from '@navet/core/transit-journey';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TransitDeparture } from '../../entur-trip';
import type { TransitJourneyBoard } from '../../use-transit-departures';
import { TransitDeparturesCardView } from './view';

const NOW = new Date(2026, 8, 23, 7, 26);

const SCHOOL: TransitJourney = {
  id: 'school',
  name: 'Skolen',
  from: { id: 'NSR:StopPlace:2952', name: 'Sarpsborg bussterminal' },
  to: { id: 'NSR:StopPlace:2719', name: 'Greåker vgs.' },
  arriveByMinute: 8 * 60 + 15,
  leadMinutes: 120,
  weekdays: [1, 2, 3, 4, 5],
};

const TRAINING: TransitJourney = {
  id: 'training',
  name: 'Trening',
  from: { id: 'NSR:StopPlace:2545', name: 'Greåker' },
  to: { id: 'NSR:StopPlace:2952', name: 'Sarpsborg bussterminal' },
  arriveByMinute: 17 * 60,
  leadMinutes: 90,
  weekdays: [3],
};

function departure(overrides: Partial<TransitDeparture> = {}): TransitDeparture {
  return {
    id: 'departure',
    departure: new Date(2026, 8, 23, 7, 38),
    arrival: new Date(2026, 8, 23, 7, 58),
    durationSeconds: 1200,
    walkDistanceMetres: 0,
    transfers: 0,
    legs: [{ mode: 'bus', lineCode: '1', quayCode: '3', frontText: 'Fredrikstad 109' }],
    realtime: false,
    delaySeconds: null,
    cancelled: false,
    predictionInaccurate: false,
    ...overrides,
  };
}

const SCHOOL_DEPARTURES = [
  departure({ id: 'a' }),
  departure({
    id: 'b',
    departure: new Date(2026, 8, 23, 7, 53),
    arrival: new Date(2026, 8, 23, 8, 14),
    walkDistanceMetres: 354,
    transfers: 1,
  }),
  departure({
    id: 'c',
    departure: new Date(2026, 8, 23, 8, 2),
    arrival: new Date(2026, 8, 23, 8, 23),
    walkDistanceMetres: 949,
  }),
];

function board(entries: Partial<TransitJourneyBoard>[]): TransitJourneyBoard[] {
  return entries.map((entry) => ({
    journey: SCHOOL,
    arrival: new Date(2026, 8, 23, 8, 15),
    active: true,
    departures: SCHOOL_DEPARTURES,
    isLoading: false,
    errorKey: null,
    ...entry,
  }));
}

function TransitStory({
  size = 'medium',
  tintColor,
  state = 'default',
}: {
  size?: CardSize;
  tintColor?: string;
  state?: 'default' | 'delayed' | 'cancelled' | 'rollForward' | 'loading' | 'error' | 'empty';
}) {
  const { theme } = useTheme();

  const boards =
    state === 'delayed'
      ? board([
          {
            departures: [
              departure({
                id: 'late',
                departure: new Date(2026, 8, 23, 7, 47),
                arrival: new Date(2026, 8, 23, 8, 8),
                realtime: true,
                delaySeconds: 595,
              }),
              ...SCHOOL_DEPARTURES.slice(1),
            ],
          },
        ])
      : state === 'cancelled'
        ? board([
            {
              departures: [
                departure({ id: 'gone', cancelled: true, realtime: true, delaySeconds: 0 }),
                ...SCHOOL_DEPARTURES.slice(1),
              ],
            },
          ])
        : state === 'rollForward'
          ? board([
              {
                journey: TRAINING,
                arrival: new Date(2026, 8, 24, 17, 0),
                active: false,
                departures: SCHOOL_DEPARTURES.slice(0, 2),
              },
            ])
          : state === 'loading'
            ? board([{ departures: [], isLoading: true }])
            : state === 'error'
              ? board([{ departures: [], errorKey: 'transit.error.unavailable' }])
              : state === 'empty'
                ? []
                : board([{}, { journey: TRAINING, arrival: new Date(2026, 8, 23, 17, 0) }]);

  return (
    <div style={{ width: size === 'small' ? 180 : 340, height: size === 'large' ? 360 : 180 }}>
      <TransitDeparturesCardView
        board={boards}
        now={NOW}
        hasJourneys={state !== 'empty'}
        size={size}
        theme={theme}
        locale="nb-NO"
        use24HourTime
        tintColor={tintColor}
        isEditMode={false}
        onOpenSettings={() => {}}
      />
    </div>
  );
}

const meta = {
  title: 'Cards/Custom/Transit Departures',
  component: TransitStory,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
    tintColor: { control: 'color' },
  },
  args: { size: 'medium' },
  parameters: {
    docs: {
      description: {
        component:
          'Departure board for the journeys configured under Settings, Local services. Each journey is planned backwards from its arrival deadline, so the card answers whether the household gets there on time.',
      },
    },
  },
} satisfies Meta<typeof TransitStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = { args: { size: 'small' } };

export const Medium: Story = { args: { size: 'medium' } };

export const Large: Story = { args: { size: 'large' } };

export const Delayed: Story = { args: { size: 'medium', state: 'delayed' } };

export const Cancelled: Story = { args: { size: 'medium', state: 'cancelled' } };

export const RolledForward: Story = { args: { size: 'medium', state: 'rollForward' } };

export const Loading: Story = { args: { size: 'medium', state: 'loading' } };

export const Unavailable: Story = { args: { size: 'medium', state: 'error' } };

export const NoJourneys: Story = { args: { size: 'medium', state: 'empty' } };
