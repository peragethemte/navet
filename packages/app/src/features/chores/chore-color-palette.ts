export interface ChoreColorPalette {
  primary: string;
  secondary: string;
}

/**
 * A broad, non-semantic spectrum for active chores. Completion green and overdue red
 * are intentionally kept outside this automatic palette so those states remain clear.
 */
export const choreColorPalettes = [
  { primary: '#f97316', secondary: '#d97706' },
  { primary: '#d97706', secondary: '#ca8a04' },
  { primary: '#ca8a04', secondary: '#0f766e' },
  { primary: '#0f766e', secondary: '#0891b2' },
  { primary: '#0891b2', secondary: '#0284c7' },
  { primary: '#0284c7', secondary: '#2563eb' },
  { primary: '#2563eb', secondary: '#4f46e5' },
  { primary: '#4f46e5', secondary: '#7c3aed' },
  { primary: '#7c3aed', secondary: '#9333ea' },
  { primary: '#9333ea', secondary: '#c026d3' },
  { primary: '#c026d3', secondary: '#db2777' },
  { primary: '#db2777', secondary: '#f97316' },
] as const satisfies readonly ChoreColorPalette[];

export function normalizeChoreColor(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^#[0-9a-f]{6}$/.test(normalized) ? normalized : undefined;
}

function hashChoreId(choreId: string) {
  let hash = 0x811c9dc5;
  for (const character of choreId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Homework is a fresh definition per item, so hashing its id would scatter one person's homework
 * across the whole palette. Key it on the assignee instead so each person keeps one colour.
 */
export function getChorePaletteKey(definition: {
  id: string;
  kind?: string;
  assignment: { participantIds: string[] };
}) {
  return definition.kind === 'homework'
    ? `homework:${definition.assignment.participantIds[0] ?? 'shared'}`
    : definition.id;
}

export function resolveChoreColorPalette(
  choreId: string,
  overrideColor?: string
): ChoreColorPalette {
  const paletteIndex = hashChoreId(choreId) % choreColorPalettes.length;
  const automaticPalette = choreColorPalettes[paletteIndex] ?? choreColorPalettes[0];
  const primary = normalizeChoreColor(overrideColor);

  return primary ? { primary, secondary: automaticPalette.secondary } : automaticPalette;
}
