import { createDinnerDefinition } from '@navet/core/chore-dinner';
import { createEmptyChoreWorkspace } from '@navet/core/chores';
import { describe, expect, it } from 'vitest';
import { getDinnerBoard, getExpiredDinnerDefinitions } from './chore-dinner-selectors';

function dinner(dateKey: string, title: string, timestamp = '2026-09-20T10:00:00.000Z') {
  return createDinnerDefinition({ title, dateKey, timeZone: 'UTC', timestamp });
}

describe('chore dinner selectors', () => {
  const now = new Date(2026, 8, 23, 12);
  const taco = dinner('2026-09-23', 'Taco');
  const soup = dinner('2026-09-25', 'Suppe');
  const old = dinner('2026-09-01', 'Fisk');
  const data = {
    ...createEmptyChoreWorkspace(),
    definitionsById: { [taco.id]: taco, [soup.id]: soup, [old.id]: old },
  };

  it('gives one slot per day from today, empty where nothing is planned', () => {
    expect(
      getDinnerBoard(data, { now, days: 3 }).map((day) => [day.dateKey, day.dinner?.title])
    ).toEqual([
      ['2026-09-23', 'Taco'],
      ['2026-09-24', undefined],
      ['2026-09-25', 'Suppe'],
    ]);
  });

  it('keeps the latest dinner when an import leaves two on one day', () => {
    const newer = { ...dinner('2026-09-23', 'Pizza', '2026-09-22T10:00:00.000Z'), id: 'imported' };
    const board = getDinnerBoard(
      { ...data, definitionsById: { ...data.definitionsById, imported: newer } },
      { now, days: 1 }
    );
    expect(board[0].dinner?.title).toBe('Pizza');
  });

  it('expires dinners after the retention window', () => {
    expect(getExpiredDinnerDefinitions(data, now).map((definition) => definition.title)).toEqual([
      'Fisk',
    ]);
  });
});
