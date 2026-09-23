import { addCalendarDays } from '@navet/core/chore-calendar-policy';
import { DINNER_RETENTION_DAYS } from '@navet/core/chore-dinner';
import {
  type ChoreDefinition,
  type ChoreWorkspaceData,
  isDinnerDefinition,
} from '@navet/core/chores';
import { HOMEWORK_BOARD_DAYS, localDateKey } from './chore-homework-selectors';

export interface DinnerBoardDay {
  dateKey: string;
  dinner?: ChoreDefinition;
}

function dinnerDateKey(definition: ChoreDefinition) {
  return definition.schedule.frequency === 'once' ? definition.schedule.date : undefined;
}

/**
 * One slot per day from today. The id already makes a dinner unique per day, but an imported
 * workspace can remap ids, so the most recently updated one wins.
 */
export function getDinnerBoard(
  data: ChoreWorkspaceData,
  { now = new Date(), days = HOMEWORK_BOARD_DAYS }: { now?: Date; days?: number } = {}
): DinnerBoardDay[] {
  const firstDateKey = localDateKey(now);
  const byDate = new Map<string, ChoreDefinition>();
  for (const definition of Object.values(data.definitionsById)) {
    if (!isDinnerDefinition(definition) || definition.archivedAt) continue;
    const dateKey = dinnerDateKey(definition);
    if (!dateKey) continue;
    const current = byDate.get(dateKey);
    if (!current || definition.updatedAt > current.updatedAt) byDate.set(dateKey, definition);
  }
  return Array.from({ length: days }, (_, offset) => {
    const dateKey = addCalendarDays(firstDateKey, offset);
    return { dateKey, dinner: byDate.get(dateKey) };
  });
}

/** Dinners past their retention window, oldest first. */
export function getExpiredDinnerDefinitions(
  data: ChoreWorkspaceData,
  now = new Date(),
  retentionDays = DINNER_RETENTION_DAYS
) {
  const cutoff = addCalendarDays(localDateKey(now), -retentionDays);
  return Object.values(data.definitionsById)
    .filter((definition) => {
      if (!isDinnerDefinition(definition)) return false;
      const dateKey = dinnerDateKey(definition);
      return dateKey !== undefined && dateKey < cutoff;
    })
    .sort((left, right) => (dinnerDateKey(left) ?? '').localeCompare(dinnerDateKey(right) ?? ''));
}
