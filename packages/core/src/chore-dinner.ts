import type { ChoreDefinition } from './chores';

export const DINNER_DEFINITION_KIND = 'dinner';

/** Days a dinner is kept after its date before the client sweeps it. */
export const DINNER_RETENTION_DAYS = 14;

export const DINNER_ICON_NAME = 'UtensilsCrossed';

/** One dinner per day is structural: the id is derived from the date. */
export function dinnerDefinitionId(dateKey: string) {
  return `dinner:${dateKey}`;
}

export interface CreateDinnerDefinitionInput {
  title: string;
  dateKey: string;
  timeZone: string;
  imageUrl?: string;
  timestamp: string;
  createdAt?: string;
}

/**
 * The single answer to "what is a dinner definition". A dinner is a dated household plan with no
 * assignee and no occurrence, so it never shows up as work to complete.
 */
export function createDinnerDefinition({
  title,
  dateKey,
  timeZone,
  imageUrl,
  timestamp,
  createdAt,
}: CreateDinnerDefinitionInput): ChoreDefinition {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error('Dinner needs a title');
  }
  const trimmedImageUrl = imageUrl?.trim();

  return {
    id: dinnerDefinitionId(dateKey),
    kind: DINNER_DEFINITION_KIND,
    title: trimmedTitle,
    icon: DINNER_ICON_NAME,
    ...(trimmedImageUrl ? { imageUrl: trimmedImageUrl } : {}),
    enabled: true,
    assignment: { mode: 'everyone', participantIds: [] },
    schedule: { frequency: 'once', date: dateKey, time: '00:00', timeZone },
    dueWindowMinutes: 1439,
    approval: { required: false, approverIds: [] },
    createdAt: createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}
