import { describe, expect, it } from 'vitest';
import { createDinnerDefinition, dinnerDefinitionId } from './chore-dinner';
import {
  applyChoreWorkspaceAction,
  type ChoreParticipant,
  createEmptyChoreWorkspace,
  isChoreWorkspaceData,
  isDinnerDefinition,
  isHouseholdChoreDefinition,
  materializeChoreOccurrences,
} from './chores';

const alice: ChoreParticipant = {
  id: 'alice',
  displayName: 'Alice',
  capabilities: ['complete', 'manage'],
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-01T08:00:00.000Z',
};

const dinner = createDinnerDefinition({
  title: '  Taco  ',
  dateKey: '2026-09-25',
  timeZone: 'Europe/Oslo',
  imageUrl: ' https://example.com/taco.jpg ',
  timestamp: '2026-09-23T10:00:00.000Z',
});

describe('createDinnerDefinition', () => {
  it('builds one household dinner per day with no assignee', () => {
    expect(dinner.id).toBe(dinnerDefinitionId('2026-09-25'));
    expect(dinner.title).toBe('Taco');
    expect(dinner.imageUrl).toBe('https://example.com/taco.jpg');
    expect(dinner.assignment.participantIds).toEqual([]);
    expect(isDinnerDefinition(dinner)).toBe(true);
    expect(isHouseholdChoreDefinition(dinner)).toBe(false);
    expect(() =>
      createDinnerDefinition({ title: ' ', dateKey: '2026-09-25', timeZone: 'UTC', timestamp: '' })
    ).toThrow();
  });

  it('never materializes an occurrence', () => {
    expect(
      materializeChoreOccurrences({
        definition: dinner,
        participantsById: { alice },
        rangeStart: '2026-09-01T00:00:00.000Z',
        rangeEnd: '2026-10-01T00:00:00.000Z',
        existingOccurrences: {},
      })
    ).toEqual([]);
  });

  it('is accepted by the authority without participants', () => {
    const created = applyChoreWorkspaceAction({
      commandId: 'create-dinner',
      action: { type: 'definition_create', actorParticipantId: 'alice', definition: dinner },
      timestamp: '2026-09-23T10:00:00.000Z',
      workspace: { ...createEmptyChoreWorkspace(), participantsById: { alice } },
    });

    expect(created.data.definitionsById[dinner.id]).toEqual(dinner);
    expect(isChoreWorkspaceData(created.data)).toBe(true);
  });
});
