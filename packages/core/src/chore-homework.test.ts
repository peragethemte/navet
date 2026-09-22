import { describe, expect, it } from 'vitest';
import {
  createHomeworkDefinition,
  HOMEWORK_DUE_WINDOW_MINUTES,
  HOMEWORK_SCHEDULE_TIME,
} from './chore-homework';
import {
  type ChoreParticipant,
  createEmptyChoreWorkspace,
  getChoreTiming,
  isChoreWorkspaceData,
  isHomeworkDefinition,
  materializeChoreOccurrences,
} from './chores';

const sam: ChoreParticipant = {
  id: 'sam',
  displayName: 'Sam',
  capabilities: ['complete'],
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-01T08:00:00.000Z',
};

function makeHomework(overrides: Partial<Parameters<typeof createHomeworkDefinition>[0]> = {}) {
  return createHomeworkDefinition({
    id: 'homework:2026-09-22:one',
    title: 'Maths page 42',
    dateKey: '2026-09-22',
    timeZone: 'Europe/Oslo',
    participantId: 'sam',
    timestamp: '2026-09-21T18:00:00.000Z',
    ...overrides,
  });
}

describe('createHomeworkDefinition', () => {
  it('builds a one-off chore assigned to a single person', () => {
    const definition = makeHomework();

    expect(isHomeworkDefinition(definition)).toBe(true);
    expect(definition.assignment).toEqual({ mode: 'person', participantIds: ['sam'] });
    expect(definition.schedule).toEqual({
      frequency: 'once',
      date: '2026-09-22',
      time: HOMEWORK_SCHEDULE_TIME,
      timeZone: 'Europe/Oslo',
    });
    expect(definition.dueWindowMinutes).toBe(HOMEWORK_DUE_WINDOW_MINUTES);
    expect(definition.approval).toEqual({ required: false, approverIds: [] });
    expect(definition.enabled).toBe(true);
  });

  it('carries no room, claim, missed or reminder policy', () => {
    const definition = makeHomework();

    expect(definition.roomRef).toBeUndefined();
    expect(definition.claimPolicy).toBeUndefined();
    expect(definition.missedPolicy).toBeUndefined();
    expect(definition.reminderPolicy).toBeUndefined();
  });

  it('trims the title and rejects an empty one', () => {
    expect(makeHomework({ title: '  Read chapter 3  ' }).title).toBe('Read chapter 3');
    expect(() => makeHomework({ title: '   ' })).toThrow();
  });

  it('keeps the original creation time when one is supplied', () => {
    const definition = makeHomework({
      createdAt: '2026-09-01T10:00:00.000Z',
      timestamp: '2026-09-21T18:00:00.000Z',
    });

    expect(definition.createdAt).toBe('2026-09-01T10:00:00.000Z');
    expect(definition.updatedAt).toBe('2026-09-21T18:00:00.000Z');
  });

  it('produces a workspace that still validates', () => {
    const definition = makeHomework();
    const data = {
      ...createEmptyChoreWorkspace(),
      participantsById: { sam },
      definitionsById: { [definition.id]: definition },
    };

    expect(isChoreWorkspaceData(data)).toBe(true);
  });

  it('is due for the whole of its own local day', () => {
    const definition = makeHomework();
    const occurrences = materializeChoreOccurrences({
      definition,
      participantsById: { sam },
      rangeStart: '2026-09-01T00:00:00.000Z',
      rangeEnd: '2026-10-01T00:00:00.000Z',
      existingOccurrences: {},
    });

    expect(occurrences).toHaveLength(1);
    const occurrence = occurrences[0];
    // Europe/Oslo is UTC+2 on this date.
    expect(occurrence.scheduledAt).toBe('2026-09-21T22:00:00.000Z');
    expect(occurrence.dueAt).toBe('2026-09-22T21:59:00.000Z');

    expect(getChoreTiming(occurrence, new Date('2026-09-21T21:00:00.000Z'))).toBe('upcoming');
    expect(getChoreTiming(occurrence, new Date('2026-09-21T22:00:00.000Z'))).toBe('due');
    expect(getChoreTiming(occurrence, new Date('2026-09-22T10:00:00.000Z'))).toBe('due');
    expect(getChoreTiming(occurrence, new Date('2026-09-22T21:58:00.000Z'))).toBe('due');
    expect(getChoreTiming(occurrence, new Date('2026-09-22T22:00:00.000Z'))).toBe('overdue');
  });

  it('still belongs to its own day when the clocks go forward', () => {
    const definition = makeHomework({
      id: 'homework:2027-03-28:one',
      dateKey: '2027-03-28',
    });
    const occurrences = materializeChoreOccurrences({
      definition,
      participantsById: { sam },
      rangeStart: '2027-03-01T00:00:00.000Z',
      rangeEnd: '2027-04-01T00:00:00.000Z',
      existingOccurrences: {},
    });

    expect(occurrences).toHaveLength(1);
    // Oslo loses an hour on 2027-03-28, so the fixed window reaches into the next local hour.
    expect(occurrences[0].scheduledAt).toBe('2027-03-27T23:00:00.000Z');
    expect(getChoreTiming(occurrences[0], new Date('2027-03-28T18:00:00.000Z'))).toBe('due');
  });
});
