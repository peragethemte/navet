import type { ChoreDefinition } from './chores';

export const HOMEWORK_DEFINITION_KIND = 'homework';

/** Homework is scheduled at local midnight and stays due for the whole day. */
export const HOMEWORK_SCHEDULE_TIME = '00:00';
export const HOMEWORK_DUE_WINDOW_MINUTES = 1439;

/** Days a homework definition is kept after its date before the client sweeps it. */
export const HOMEWORK_RETENTION_DAYS = 90;

export const HOMEWORK_ICON_NAME = 'GraduationCap';

export interface CreateHomeworkDefinitionInput {
  id: string;
  title: string;
  dateKey: string;
  timeZone: string;
  participantId: string;
  timestamp: string;
  createdAt?: string;
}

/**
 * The single answer to "what is a homework definition". Homework is a one-off, person-assigned
 * chore with no approval, claim, missed or reminder policy, and no room.
 */
export function createHomeworkDefinition({
  id,
  title,
  dateKey,
  timeZone,
  participantId,
  timestamp,
  createdAt,
}: CreateHomeworkDefinitionInput): ChoreDefinition {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error('Homework needs a title');
  }

  return {
    id,
    kind: HOMEWORK_DEFINITION_KIND,
    title: trimmedTitle,
    icon: HOMEWORK_ICON_NAME,
    enabled: true,
    assignment: { mode: 'person', participantIds: [participantId] },
    schedule: {
      frequency: 'once',
      date: dateKey,
      time: HOMEWORK_SCHEDULE_TIME,
      timeZone,
    },
    dueWindowMinutes: HOMEWORK_DUE_WINDOW_MINUTES,
    approval: { required: false, approverIds: [] },
    createdAt: createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}
