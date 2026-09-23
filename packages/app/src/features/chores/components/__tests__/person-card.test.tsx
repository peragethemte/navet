import { renderWithProviders } from '@navet/app/test/render';
import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type { ChoreDefinition, ChoreParticipant, ChoreWorkspaceData } from '@navet/core/chores';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChoreWorkspaceStore } from '../../chore-workspace-store';
import { PersonCard } from '../person-card';
import { splitPersonRowBudget } from '../person-card/view';

vi.mock('../../use-chore-workspace-sync', () => ({ useChoreWorkspaceSync: () => undefined }));
vi.mock('../../use-chore-materialization', () => ({
  useChoreMaterialization: () => ({ runtimeCapabilities: null, authoritySchedules: true }),
}));

const timestamp = '2026-09-22T06:00:00.000Z';
const now = new Date('2026-09-22T10:00:00.000Z');

const sam: ChoreParticipant = {
  id: 'sam',
  displayName: 'Sam',
  capabilities: ['complete'],
  createdAt: timestamp,
  updatedAt: timestamp,
};
const lea: ChoreParticipant = { ...sam, id: 'lea', displayName: 'Lea' };

function chore(
  id: string,
  title: string,
  assignment: ChoreDefinition['assignment']
): ChoreDefinition {
  return {
    id,
    title,
    enabled: true,
    assignment,
    schedule: { frequency: 'once', date: '2026-09-22', time: '09:00', timeZone: 'UTC' },
    dueWindowMinutes: 600,
    approval: { required: false, approverIds: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function occurrence(definitionId: string, assigneeIds: string[], assignmentSlot: string) {
  return {
    id: `occ-${definitionId}`,
    definitionId,
    scheduledAt: '2026-09-22T09:00:00.000Z',
    dueAt: '2026-09-22T19:00:00.000Z',
    assigneeIds,
    assignmentSlot,
    status: 'available' as const,
    updatedAt: timestamp,
  };
}

function workspace(): ChoreWorkspaceData {
  const reading = createHomeworkDefinition({
    id: 'reading',
    title: 'Reading log',
    dateKey: '2026-09-22',
    timeZone: 'UTC',
    participantId: 'sam',
    timestamp,
  });
  return {
    schemaVersion: 2,
    participantsById: { sam, lea },
    definitionsById: {
      dishes: chore('dishes', 'Empty the dishwasher', { mode: 'person', participantIds: ['sam'] }),
      bins: chore('bins', 'Take out the bins', { mode: 'person', participantIds: ['lea'] }),
      table: chore('table', 'Clear the table', {
        mode: 'anyone',
        participantIds: ['sam', 'lea'],
      }),
      reading,
    },
    occurrencesById: {
      'occ-dishes': occurrence('dishes', ['sam'], 'sam'),
      'occ-bins': occurrence('bins', ['lea'], 'lea'),
      'occ-table': occurrence('table', ['sam', 'lea'], 'shared'),
      'occ-reading': occurrence('reading', ['sam'], 'sam'),
    },
    activity: [],
    outbox: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  useChoreWorkspaceStore.setState(useChoreWorkspaceStore.getInitialState(), true);
  useChoreWorkspaceStore.getState().setPreviewDocument({ data: workspace() });
});

afterEach(() => {
  vi.useRealTimers();
  useChoreWorkspaceStore.setState(useChoreWorkspaceStore.getInitialState(), true);
});

describe('person dashboard card', () => {
  it("shows the person's own chores, the shared ones, and their homework in labelled sections", () => {
    renderWithProviders(<PersonCard size="large" data={{ participantId: 'sam' }} />);

    expect(screen.getByText('Empty the dishwasher')).toBeInTheDocument();
    expect(screen.getByText('Clear the table')).toBeInTheDocument();
    expect(screen.getByText('Reading log')).toBeInTheDocument();
    expect(screen.queryByText('Take out the bins')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chores' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Homework' })).toBeInTheDocument();
  });

  it('drops chores and homework left unfinished on earlier days, without flagging anything late', () => {
    const data = workspace();
    data.definitionsById.shoes = chore('shoes', 'Tidy the shoes', {
      mode: 'person',
      participantIds: ['sam'],
    });
    data.occurrencesById['occ-shoes'] = {
      ...occurrence('shoes', ['sam'], 'sam'),
      scheduledAt: '2026-09-21T09:00:00.000Z',
      dueAt: '2026-09-21T19:00:00.000Z',
    };
    data.definitionsById.maths = createHomeworkDefinition({
      id: 'maths',
      title: 'Maths sheet',
      dateKey: '2026-09-21',
      timeZone: 'UTC',
      participantId: 'sam',
      timestamp,
    });
    data.occurrencesById['occ-maths'] = {
      ...occurrence('maths', ['sam'], 'sam'),
      scheduledAt: '2026-09-21T00:00:00.000Z',
      dueAt: '2026-09-21T23:59:00.000Z',
    };
    data.occurrencesById['occ-dishes'].dueAt = '2026-09-22T09:30:00.000Z';
    useChoreWorkspaceStore.getState().setPreviewDocument({ data });
    renderWithProviders(<PersonCard size="large" data={{ participantId: 'sam' }} />);

    expect(screen.queryByText('Tidy the shoes')).not.toBeInTheDocument();
    expect(screen.queryByText('Maths sheet')).not.toBeInTheDocument();
    expect(screen.getByText('Empty the dishwasher')).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it("titles itself with the person's name until a title is set", () => {
    const { unmount } = renderWithProviders(
      <PersonCard size="large" data={{ participantId: 'sam' }} />
    );
    expect(screen.getByRole('heading', { name: 'Sam' })).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <PersonCard size="large" data={{ participantId: 'sam', title: 'Sam 7B' }} />
    );
    expect(screen.getByRole('heading', { name: 'Sam 7B' })).toBeInTheDocument();
  });

  it('splits the row budget so neither section starves the other', () => {
    expect(splitPersonRowBudget(10, 10, 6)).toEqual({ chores: 3, homework: 3 });
    expect(splitPersonRowBudget(10, 1, 6)).toEqual({ chores: 5, homework: 1 });
    expect(splitPersonRowBudget(1, 10, 6)).toEqual({ chores: 1, homework: 5 });
    expect(splitPersonRowBudget(0, 10, 6)).toEqual({ chores: 0, homework: 6 });
  });
});
