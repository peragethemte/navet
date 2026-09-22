import { renderWithProviders } from '@navet/app/test/render';
import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type { ChoreDefinition, ChoreParticipant, ChoreWorkspaceData } from '@navet/core/chores';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChoreWorkspaceStore } from '../../chore-workspace-store';
import { ChoresCard } from '../chores-card';

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

function chore(id: string, title: string, participantId: string): ChoreDefinition {
  return {
    id,
    title,
    enabled: true,
    assignment: { mode: 'person', participantIds: [participantId] },
    schedule: { frequency: 'once', date: '2026-09-22', time: '09:00', timeZone: 'UTC' },
    dueWindowMinutes: 600,
    approval: { required: false, approverIds: [] },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function occurrence(definitionId: string, participantId: string) {
  return {
    id: `occ-${definitionId}`,
    definitionId,
    scheduledAt: '2026-09-22T09:00:00.000Z',
    dueAt: '2026-09-22T19:00:00.000Z',
    assigneeIds: [participantId],
    assignmentSlot: participantId,
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
    participantId: 'lea',
    timestamp,
  });
  return {
    schemaVersion: 2,
    participantsById: { sam, lea },
    definitionsById: {
      dishes: chore('dishes', 'Empty the dishwasher', 'sam'),
      bins: chore('bins', 'Take out the bins', 'lea'),
      reading,
    },
    occurrencesById: {
      'occ-dishes': occurrence('dishes', 'sam'),
      'occ-bins': occurrence('bins', 'lea'),
      'occ-reading': occurrence('reading', 'lea'),
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

describe('chores dashboard card', () => {
  it('shows the household chores and leaves homework to its own card', () => {
    renderWithProviders(<ChoresCard size="large" />);

    expect(screen.getByText('Empty the dishwasher')).toBeInTheDocument();
    expect(screen.getByText('Take out the bins')).toBeInTheDocument();
    expect(screen.queryByText('Reading log')).not.toBeInTheDocument();
  });

  it('narrows to one person when the card is configured for them', () => {
    renderWithProviders(<ChoresCard size="large" data={{ participantId: 'sam' }} />);

    expect(screen.getByText('Empty the dishwasher')).toBeInTheDocument();
    expect(screen.queryByText('Take out the bins')).not.toBeInTheDocument();
  });

  it('falls back to everyone when the configured person is gone', () => {
    renderWithProviders(<ChoresCard size="large" data={{ participantId: 'removed' }} />);

    expect(screen.getByText('Empty the dishwasher')).toBeInTheDocument();
    expect(screen.getByText('Take out the bins')).toBeInTheDocument();
  });

  it('completes a chore straight from the card', () => {
    const execute = vi.fn(async () => true);
    useChoreWorkspaceStore.setState({ execute });
    renderWithProviders(<ChoresCard size="large" data={{ participantId: 'sam' }} />);

    fireEvent.click(screen.getAllByRole('button', { name: /done/i })[0]);

    expect(execute).toHaveBeenCalledWith({
      type: 'occurrence_action',
      occurrenceId: 'occ-dishes',
      action: { type: 'complete', participantId: 'sam' },
    });
  });

  it('explains itself instead of rendering an empty card when chores are unavailable', () => {
    useChoreWorkspaceStore.setState({ status: 'unavailable', data: null });
    renderWithProviders(<ChoresCard size="medium" />);

    expect(screen.getByText('Chores are unavailable')).toBeInTheDocument();
  });
});
