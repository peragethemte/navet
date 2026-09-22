import { renderHookWithProviders } from '@navet/app/test/render';
import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type {
  ChoreDefinition,
  ChoreParticipant,
  ChoreWorkspaceAction,
  ChoreWorkspaceData,
} from '@navet/core/chores';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChoreWorkspaceStore } from './chore-workspace-store';
import { useChoreHomeworkRetention } from './use-chore-homework-retention';

const manager: ChoreParticipant = {
  id: 'ada',
  displayName: 'Ada',
  capabilities: ['complete', 'manage'],
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-01-01T08:00:00.000Z',
};

function homework(id: string, dateKey: string): ChoreDefinition {
  return createHomeworkDefinition({
    id,
    title: id,
    dateKey,
    timeZone: 'Europe/Oslo',
    participantId: 'ada',
    timestamp: '2026-01-01T08:00:00.000Z',
  });
}

const dishes: ChoreDefinition = {
  id: 'dishes',
  title: 'Dishes',
  enabled: true,
  assignment: { mode: 'person', participantIds: ['ada'] },
  schedule: { frequency: 'once', date: '2026-01-01', time: '18:00', timeZone: 'Europe/Oslo' },
  dueWindowMinutes: 60,
  approval: { required: false, approverIds: [] },
  createdAt: '2026-01-01T18:00:00.000Z',
  updatedAt: '2026-01-01T18:00:00.000Z',
};

function workspace(definitions: ChoreDefinition[]): ChoreWorkspaceData {
  return {
    schemaVersion: 2,
    participantsById: { ada: manager },
    definitionsById: Object.fromEntries(definitions.map((item) => [item.id, item])),
    occurrencesById: {},
    activity: [],
    outbox: [],
  };
}

function expiredHomework(count: number) {
  return Array.from({ length: count }, (_, index) =>
    homework(`old-${index}`, `2026-0${(index % 3) + 1}-0${(index % 9) + 1}`)
  );
}

let execute: (action: ChoreWorkspaceAction) => Promise<boolean>;

/** The sweep is a chain of awaited commands; drain the microtask queue under fake timers. */
async function settle() {
  for (let index = 0; index < 40; index += 1) {
    await vi.advanceTimersByTimeAsync(0);
  }
}

function primeStore(data: ChoreWorkspaceData, overrides: Record<string, unknown> = {}) {
  useChoreWorkspaceStore.setState({
    data,
    revision: 1,
    status: 'ready',
    error: null,
    managementError: null,
    managementPinConfigured: false,
    managementUnlocked: false,
    execute,
    ...overrides,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 22, 9, 0, 0));
  execute = vi.fn(async () => true);
});

afterEach(() => {
  vi.useRealTimers();
  useChoreWorkspaceStore.getState().reset();
});

describe('useChoreHomeworkRetention', () => {
  it('deletes only homework past the retention window', async () => {
    primeStore(
      workspace([homework('old', '2026-01-05'), homework('recent', '2026-09-01'), dishes])
    );
    renderHookWithProviders(() => useChoreHomeworkRetention(true, 'ada'));

    await settle();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({
      type: 'definition_delete',
      actorParticipantId: 'ada',
      definitionId: 'old',
    });
  });

  it('stays within its command budget in a single pass', async () => {
    primeStore(workspace(expiredHomework(14)));
    renderHookWithProviders(() => useChoreHomeworkRetention(true, 'ada'));

    await settle();
    expect(execute).toHaveBeenCalledTimes(10);
  });

  it('does nothing while management is locked behind a PIN', async () => {
    primeStore(workspace([homework('old', '2026-01-05')]), {
      managementPinConfigured: true,
      managementUnlocked: false,
    });
    renderHookWithProviders(() => useChoreHomeworkRetention(true, 'ada'));

    await settle();
    expect(execute).not.toHaveBeenCalled();
  });

  it('does nothing without an active manager or while the workspace is still loading', async () => {
    primeStore(workspace([homework('old', '2026-01-05')]));
    renderHookWithProviders(() => useChoreHomeworkRetention(true, undefined));
    await settle();
    expect(execute).not.toHaveBeenCalled();

    primeStore(workspace([homework('old', '2026-01-05')]), { status: 'loading' });
    renderHookWithProviders(() => useChoreHomeworkRetention(true, 'ada'));
    await settle();
    expect(execute).not.toHaveBeenCalled();
  });

  it('stops the pass after the first failed delete', async () => {
    execute = vi.fn(async () => false);
    primeStore(workspace(expiredHomework(5)));
    renderHookWithProviders(() => useChoreHomeworkRetention(true, 'ada'));

    await settle();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('skips homework that vanished between reads', async () => {
    const data = workspace([homework('old', '2026-01-05'), homework('older', '2026-01-04')]);
    execute = vi.fn(async () => {
      const current = useChoreWorkspaceStore.getState().data as ChoreWorkspaceData;
      const { old: _removed, ...rest } = current.definitionsById;
      useChoreWorkspaceStore.setState({ data: { ...current, definitionsById: rest } });
      return true;
    });
    primeStore(data);
    renderHookWithProviders(() => useChoreHomeworkRetention(true, 'ada'));

    await settle();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ definitionId: 'older' }));
  });
});
