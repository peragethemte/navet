import { addCalendarDays } from '@navet/core/chore-calendar-policy';
import { HOMEWORK_RETENTION_DAYS } from '@navet/core/chore-homework';
import {
  type ChoreDefinition,
  type ChoreOccurrence,
  type ChoreWorkspaceData,
  isHomeworkDefinition,
} from '@navet/core/chores';

export const HOMEWORK_BOARD_DAYS = 10;

export interface HomeworkBoardEntry {
  definition: ChoreDefinition;
  occurrence?: ChoreOccurrence;
}

export interface HomeworkBoardDay {
  dateKey: string;
  entries: HomeworkBoardEntry[];
}

export interface HomeworkBoard {
  overdue: HomeworkBoardEntry[];
  days: HomeworkBoardDay[];
}

export function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function createHomeworkId(dateKey: string) {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `homework:${dateKey}:${suffix}`;
}

export function excludeHomework(definitions: ChoreDefinition[]) {
  return definitions.filter((definition) => !isHomeworkDefinition(definition));
}

function homeworkDateKey(definition: ChoreDefinition) {
  return definition.schedule.frequency === 'once' ? definition.schedule.date : undefined;
}

function indexOccurrencesByDefinition(data: ChoreWorkspaceData) {
  const byDefinition = new Map<string, ChoreOccurrence>();
  for (const occurrence of Object.values(data.occurrencesById)) {
    const current = byDefinition.get(occurrence.definitionId);
    if (!current || occurrence.scheduledAt < current.scheduledAt) {
      byDefinition.set(occurrence.definitionId, occurrence);
    }
  }
  return byDefinition;
}

function sortEntries(entries: HomeworkBoardEntry[]) {
  return entries.sort((left, right) =>
    left.definition.createdAt === right.definition.createdAt
      ? left.definition.id.localeCompare(right.definition.id)
      : left.definition.createdAt.localeCompare(right.definition.createdAt)
  );
}

/**
 * The homework board reads definitions rather than occurrences, because a homework item created
 * for a future day has no occurrence until the next materialization pass. Days are bucketed on
 * the definition's own date key so the board never disagrees with what was written.
 */
export function getHomeworkBoard(
  data: ChoreWorkspaceData,
  {
    participantId,
    now = new Date(),
    days = HOMEWORK_BOARD_DAYS,
  }: { participantId?: string; now?: Date; days?: number } = {}
): HomeworkBoard {
  const firstDateKey = localDateKey(now);
  const dayBuckets = new Map<string, HomeworkBoardEntry[]>();
  for (let offset = 0; offset < days; offset += 1) {
    dayBuckets.set(addCalendarDays(firstDateKey, offset), []);
  }
  const overdue: HomeworkBoardEntry[] = [];
  const occurrencesByDefinition = indexOccurrencesByDefinition(data);

  for (const definition of Object.values(data.definitionsById)) {
    if (!isHomeworkDefinition(definition) || definition.archivedAt) continue;
    if (participantId && !definition.assignment.participantIds.includes(participantId)) continue;
    const dateKey = homeworkDateKey(definition);
    if (!dateKey) continue;

    const entry: HomeworkBoardEntry = {
      definition,
      occurrence: occurrencesByDefinition.get(definition.id),
    };
    const bucket = dayBuckets.get(dateKey);
    if (bucket) {
      bucket.push(entry);
    } else if (dateKey < firstDateKey && entry.occurrence?.status !== 'done') {
      overdue.push(entry);
    }
  }

  return {
    overdue: sortEntries(overdue),
    days: [...dayBuckets.entries()].map(([dateKey, entries]) => ({
      dateKey,
      entries: sortEntries(entries),
    })),
  };
}

/** Homework definitions past their retention window, oldest first. */
export function getExpiredHomeworkDefinitions(
  data: ChoreWorkspaceData,
  now = new Date(),
  retentionDays = HOMEWORK_RETENTION_DAYS
) {
  const cutoff = addCalendarDays(localDateKey(now), -retentionDays);
  return Object.values(data.definitionsById)
    .filter((definition) => {
      if (!isHomeworkDefinition(definition)) return false;
      const dateKey = homeworkDateKey(definition);
      return dateKey !== undefined && dateKey < cutoff;
    })
    .sort((left, right) =>
      (homeworkDateKey(left) ?? '').localeCompare(homeworkDateKey(right) ?? '')
    );
}
