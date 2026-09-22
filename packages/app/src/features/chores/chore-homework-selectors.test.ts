import { createHomeworkDefinition } from '@navet/core/chore-homework';
import type { ChoreOccurrence, ChoreParticipant, ChoreWorkspaceData } from '@navet/core/chores';
import { describe, expect, it } from 'vitest';
import {
  getExpiredHomeworkDefinitions,
  getHomeworkBoard,
  localDateKey,
} from './chore-homework-selectors';

const now = new Date(2026, 8, 22, 9, 0, 0);
const todayKey = localDateKey(now);

function participant(id: string): ChoreParticipant {
  return {
    id,
    displayName: id,
    capabilities: ['complete'],
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  };
}

function homework(id: string, dateKey: string, participantId: string, timeZone = 'Europe/Oslo') {
  return createHomeworkDefinition({
    id,
    title: id,
    dateKey,
    timeZone,
    participantId,
    timestamp: '2026-09-21T18:00:00.000Z',
  });
}

function occurrence(definitionId: string, status: ChoreOccurrence['status']): ChoreOccurrence {
  return {
    id: `${definitionId}:occurrence`,
    definitionId,
    scheduledAt: '2026-09-22T00:00:00.000Z',
    dueAt: '2026-09-22T23:59:00.000Z',
    assigneeIds: ['sam'],
    assignmentSlot: 'sam',
    status,
    updatedAt: '2026-09-22T00:00:00.000Z',
  };
}

function workspace(
  definitions: ReturnType<typeof homework>[],
  occurrences: ChoreOccurrence[] = []
): ChoreWorkspaceData {
  return {
    schemaVersion: 2,
    participantsById: { sam: participant('sam'), lea: participant('lea') },
    definitionsById: Object.fromEntries(definitions.map((item) => [item.id, item])),
    occurrencesById: Object.fromEntries(occurrences.map((item) => [item.id, item])),
    activity: [],
    outbox: [],
  };
}

describe('getHomeworkBoard', () => {
  it('returns ten day buckets starting today, including empty ones', () => {
    const board = getHomeworkBoard(workspace([]), { participantId: 'sam', now });

    expect(board.days).toHaveLength(10);
    expect(board.days[0].dateKey).toBe(todayKey);
    expect(board.days[9].dateKey).toBe('2026-10-01');
    expect(board.days.every((day) => day.entries.length === 0)).toBe(true);
  });

  it('buckets on the definition date even when its time zone is not the browser zone', () => {
    const data = workspace([homework('maths', todayKey, 'sam', 'Pacific/Auckland')]);
    const board = getHomeworkBoard(data, { participantId: 'sam', now });

    expect(board.days[0].entries.map((entry) => entry.definition.id)).toEqual(['maths']);
  });

  it('keeps done entries on the board', () => {
    const definition = homework('maths', todayKey, 'sam');
    const data = workspace([definition], [occurrence('maths', 'done')]);
    const board = getHomeworkBoard(data, { participantId: 'sam', now });

    expect(board.days[0].entries).toHaveLength(1);
    expect(board.days[0].entries[0].occurrence?.status).toBe('done');
  });

  it('attaches no occurrence before materialization has run', () => {
    const data = workspace([homework('maths', todayKey, 'sam')]);
    const board = getHomeworkBoard(data, { participantId: 'sam', now });

    expect(board.days[0].entries[0].occurrence).toBeUndefined();
  });

  it('only shows the selected person', () => {
    const data = workspace([
      homework('maths', todayKey, 'sam'),
      homework('reading', todayKey, 'lea'),
    ]);

    expect(
      getHomeworkBoard(data, { participantId: 'sam', now }).days[0].entries.map(
        (entry) => entry.definition.id
      )
    ).toEqual(['maths']);
  });

  it('lifts unfinished homework from before the window into an overdue group', () => {
    const data = workspace(
      [homework('maths', '2026-09-18', 'sam'), homework('reading', '2026-09-19', 'sam')],
      [occurrence('reading', 'done')]
    );
    const board = getHomeworkBoard(data, { participantId: 'sam', now });

    expect(board.overdue.map((entry) => entry.definition.id)).toEqual(['maths']);
    expect(board.days.flatMap((day) => day.entries)).toHaveLength(0);
  });

  it('ignores chores that are not homework', () => {
    const data = workspace([]);
    data.definitionsById.dishes = {
      id: 'dishes',
      title: 'Dishes',
      enabled: true,
      assignment: { mode: 'person', participantIds: ['sam'] },
      schedule: { frequency: 'once', date: todayKey, time: '18:00', timeZone: 'Europe/Oslo' },
      dueWindowMinutes: 60,
      approval: { required: false, approverIds: [] },
      createdAt: '2026-09-21T18:00:00.000Z',
      updatedAt: '2026-09-21T18:00:00.000Z',
    };

    expect(getHomeworkBoard(data, { participantId: 'sam', now }).days[0].entries).toHaveLength(0);
  });
});

describe('getExpiredHomeworkDefinitions', () => {
  it('returns only homework past the retention window, oldest first', () => {
    const data = workspace([
      homework('old-1', '2026-05-01', 'sam'),
      homework('old-2', '2026-04-01', 'sam'),
      homework('recent', '2026-09-01', 'sam'),
    ]);
    data.definitionsById.dishes = {
      id: 'dishes',
      title: 'Dishes',
      enabled: true,
      assignment: { mode: 'person', participantIds: ['sam'] },
      schedule: { frequency: 'once', date: '2026-01-01', time: '18:00', timeZone: 'Europe/Oslo' },
      dueWindowMinutes: 60,
      approval: { required: false, approverIds: [] },
      createdAt: '2026-01-01T18:00:00.000Z',
      updatedAt: '2026-01-01T18:00:00.000Z',
    };

    expect(getExpiredHomeworkDefinitions(data, now).map((item) => item.id)).toEqual([
      'old-2',
      'old-1',
    ]);
  });
});
