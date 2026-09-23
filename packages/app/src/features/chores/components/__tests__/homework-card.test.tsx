import { renderWithProviders } from '@navet/app/test/render';
import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type { ChoreOccurrence, ChoreParticipant, ChoreWorkspaceData } from '@navet/core/chores';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChoreWorkspaceStore } from '../../chore-workspace-store';
import { HomeworkCard } from '../homework-card';

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

function homework(id: string, title: string, dateKey: string, participantId: string) {
  return createHomeworkDefinition({
    id,
    title,
    dateKey,
    timeZone: 'UTC',
    participantId,
    timestamp,
  });
}

function occurrence(definitionId: string, participantId: string, dateKey: string): ChoreOccurrence {
  return {
    id: `occ-${definitionId}`,
    definitionId,
    scheduledAt: `${dateKey}T00:00:00.000Z`,
    dueAt: `${dateKey}T23:59:00.000Z`,
    assigneeIds: [participantId],
    assignmentSlot: participantId,
    status: 'available',
    updatedAt: timestamp,
  };
}

function workspace(): ChoreWorkspaceData {
  return {
    schemaVersion: 2,
    participantsById: { sam, lea },
    definitionsById: {
      spelling: homework('spelling', 'Spelling words', '2026-09-22', 'sam'),
      maths: homework('maths', 'Maths sheet', '2026-09-20', 'lea'),
      reading: homework('reading', 'Reading log', '2026-09-22', 'lea'),
      history: homework('history', 'History essay', '2026-09-25', 'sam'),
    },
    occurrencesById: {
      'occ-spelling': occurrence('spelling', 'sam', '2026-09-22'),
      'occ-maths': occurrence('maths', 'lea', '2026-09-20'),
      'occ-reading': occurrence('reading', 'lea', '2026-09-22'),
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

describe('homework dashboard card', () => {
  it("shows only today's homework, dropping unfinished work from earlier days", () => {
    renderWithProviders(<HomeworkCard size="large" />);

    expect(screen.getByText('Spelling words')).toBeInTheDocument();
    expect(screen.getByText('Reading log')).toBeInTheDocument();
    expect(screen.queryByText('Maths sheet')).not.toBeInTheDocument();
    expect(screen.queryByText('History essay')).not.toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it('narrows to one person without falling back to an empty board', () => {
    renderWithProviders(<HomeworkCard size="large" data={{ participantId: 'lea' }} />);

    expect(screen.getByText('Reading log')).toBeInTheDocument();
    expect(screen.queryByText('Spelling words')).not.toBeInTheDocument();
  });

  it('ticks off homework straight from the card', () => {
    const execute = vi.fn(async () => true);
    useChoreWorkspaceStore.setState({ execute });
    renderWithProviders(<HomeworkCard size="large" data={{ participantId: 'sam' }} />);

    fireEvent.click(screen.getAllByRole('button', { name: /done/i })[0]);

    expect(execute).toHaveBeenCalledWith({
      type: 'occurrence_action',
      occurrenceId: 'occ-spelling',
      action: { type: 'complete', participantId: 'sam' },
    });
  });

  it('says an entry is not ready rather than showing a dead control', () => {
    const data = workspace();
    delete data.occurrencesById['occ-spelling'];
    useChoreWorkspaceStore.getState().setPreviewDocument({ data });
    renderWithProviders(<HomeworkCard size="large" data={{ participantId: 'sam' }} />);

    expect(screen.getByText('Not ready')).toBeInTheDocument();
  });

  it('shows the next N days grouped under a day heading when configured', () => {
    renderWithProviders(<HomeworkCard size="large" data={{ participantId: 'sam', days: 4 }} />);

    expect(screen.getByText('Spelling words')).toBeInTheDocument();
    expect(screen.getByText('History essay')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
