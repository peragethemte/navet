import { renderWithProviders } from '@navet/app/test/render';
import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type { ChoreDefinition, ChoreParticipant, ChoreWorkspaceData } from '@navet/core/chores';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoreHomeworkView } from './chore-homework-view';

const sam: ChoreParticipant = {
  id: 'sam',
  displayName: 'Sam',
  capabilities: ['complete'],
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
};

const lea: ChoreParticipant = {
  ...sam,
  id: 'lea',
  displayName: 'Lea',
};

function homework(id: string, dateKey: string, participantId: string, title = id) {
  return createHomeworkDefinition({
    id,
    title,
    dateKey,
    timeZone: 'Europe/Oslo',
    participantId,
    timestamp: '2026-09-21T18:00:00.000Z',
  });
}

function workspace(definitions: ChoreDefinition[] = []): ChoreWorkspaceData {
  return {
    schemaVersion: 2,
    participantsById: { sam, lea },
    definitionsById: Object.fromEntries(definitions.map((item) => [item.id, item])),
    occurrencesById: {},
    activity: [],
    outbox: [],
  };
}

function renderView(
  data: ChoreWorkspaceData,
  overrides: Partial<Parameters<typeof ChoreHomeworkView>[0]> = {}
) {
  const props = {
    data,
    participants: [sam, lea],
    canManage: true,
    onAdd: vi.fn(async () => true),
    onRename: vi.fn(async () => true),
    onRemove: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithProviders(<ChoreHomeworkView {...props} />) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 22, 9, 0, 0));
});

afterEach(() => vi.useRealTimers());

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function typeAndSubmit(field: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(field, { target: { value } });
  });
  await act(async () => {
    fireEvent.keyDown(field, { key: 'Enter' });
  });
}

describe('homework board', () => {
  it('shows ten days starting today', () => {
    renderView(workspace());

    const days = document.querySelectorAll('[data-homework-day]');
    expect(days).toHaveLength(10);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeInTheDocument();
  });

  it('rolls the window forward at midnight without remounting', () => {
    vi.setSystemTime(new Date(2026, 8, 22, 23, 59, 45));
    renderView(workspace([homework('maths', '2026-10-02', 'sam', 'Maths page 42')]));
    expect(screen.queryByText('Maths page 42')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText('Maths page 42')).toBeInTheDocument();
  });

  it('only lists the selected person and switches with the rail', async () => {
    renderView(
      workspace([
        homework('maths', '2026-09-22', 'sam', 'Maths page 42'),
        homework('reading', '2026-09-22', 'lea', 'Read chapter 3'),
      ])
    );
    expect(screen.getByText('Maths page 42')).toBeInTheDocument();
    expect(screen.queryByText('Read chapter 3')).not.toBeInTheDocument();

    await click(screen.getByRole('button', { name: 'Lea' }));
    expect(screen.getByText('Read chapter 3')).toBeInTheDocument();
    expect(screen.queryByText('Maths page 42')).not.toBeInTheDocument();
  });

  it('adds one entry per Enter and keeps the field ready for the next line', async () => {
    const onAdd = vi.fn(async () => true);
    renderView(workspace(), { onAdd });

    await click(screen.getAllByRole('button', { name: /^Add homework for Sam on/ })[0]);
    const field = screen.getByRole('textbox');
    await typeAndSubmit(field, 'Maths page 42');

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({
      participantId: 'sam',
      dateKey: '2026-09-22',
      title: 'Maths page 42',
    });
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
  });

  it('keeps the typed text when the write fails', async () => {
    renderView(workspace(), { onAdd: vi.fn(async () => false) });

    await click(screen.getAllByRole('button', { name: /^Add homework for Sam on/ })[0]);
    const field = screen.getByRole('textbox');
    await typeAndSubmit(field, 'Maths page 42');

    expect(field).toHaveValue('Maths page 42');
  });

  it('restores the add row on Escape', async () => {
    renderView(workspace());

    await click(screen.getAllByRole('button', { name: /^Add homework for Sam on/ })[0]);
    const field = screen.getByRole('textbox');
    expect(field).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(field, { key: 'Escape' });
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renames an entry in place', async () => {
    const onRename = vi.fn(async () => true);
    renderView(workspace([homework('maths', '2026-09-22', 'sam', 'Maths page 42')]), { onRename });

    await click(screen.getByRole('button', { name: 'Edit Maths page 42' }));
    await typeAndSubmit(screen.getByRole('textbox'), 'Maths page 43');

    expect(onRename).toHaveBeenCalledWith('maths', 'Maths page 43');
  });

  it('removes an entry without a confirmation step', async () => {
    const onRemove = vi.fn();
    renderView(workspace([homework('maths', '2026-09-22', 'sam', 'Maths page 42')]), { onRemove });

    await click(screen.getByRole('button', { name: 'Remove Maths page 42' }));
    expect(onRemove).toHaveBeenCalledWith('maths');
  });

  it('completes an entry through its checkbox once an occurrence exists', async () => {
    const onComplete = vi.fn();
    const data = workspace([homework('maths', '2026-09-22', 'sam', 'Maths page 42')]);
    data.occurrencesById['maths:1'] = {
      id: 'maths:1',
      definitionId: 'maths',
      scheduledAt: '2026-09-21T22:00:00.000Z',
      dueAt: '2026-09-22T21:59:00.000Z',
      assigneeIds: ['sam'],
      assignmentSlot: 'sam',
      status: 'available',
      updatedAt: '2026-09-21T22:00:00.000Z',
    };
    renderView(data, { onComplete });

    await click(screen.getByRole('checkbox', { name: 'Maths page 42' }));
    expect(onComplete).toHaveBeenCalledWith('maths:1', 'sam');
  });

  it('shows a done entry as checked, disabled and labelled', () => {
    const data = workspace([homework('maths', '2026-09-22', 'sam', 'Maths page 42')]);
    data.occurrencesById['maths:1'] = {
      id: 'maths:1',
      definitionId: 'maths',
      scheduledAt: '2026-09-21T22:00:00.000Z',
      dueAt: '2026-09-22T21:59:00.000Z',
      assigneeIds: ['sam'],
      assignmentSlot: 'sam',
      status: 'done',
      completedBy: 'sam',
      completedAt: '2026-09-22T15:00:00.000Z',
      updatedAt: '2026-09-22T15:00:00.000Z',
    };
    renderView(data);

    const checkbox = screen.getByRole('checkbox', { name: 'Maths page 42' });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('lifts unfinished homework from before the window into an overdue group', () => {
    renderView(workspace([homework('maths', '2026-09-10', 'sam', 'Maths page 42')]));

    const overdue = screen.getByRole('heading', { name: 'Overdue' }).closest('section');
    expect(overdue).not.toBeNull();
    expect(within(overdue as HTMLElement).getByText('Maths page 42')).toBeInTheDocument();
  });

  it('disables authoring when no manager is available', () => {
    renderView(workspace(), { canManage: false });

    expect(screen.getAllByRole('button', { name: /^Add homework for Sam on/ })[0]).toBeDisabled();
  });

  it('ignores chores that are not homework', () => {
    const data = workspace();
    data.definitionsById.dishes = {
      id: 'dishes',
      title: 'Empty the dishwasher',
      enabled: true,
      assignment: { mode: 'person', participantIds: ['sam'] },
      schedule: { frequency: 'once', date: '2026-09-22', time: '18:00', timeZone: 'Europe/Oslo' },
      dueWindowMinutes: 60,
      approval: { required: false, approverIds: [] },
      createdAt: '2026-09-21T18:00:00.000Z',
      updatedAt: '2026-09-21T18:00:00.000Z',
    };
    renderView(data);

    expect(screen.queryByText('Empty the dishwasher')).not.toBeInTheDocument();
  });
});
