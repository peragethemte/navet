import type { CardSpan } from '@navet/app/components/shared/card-size';

/** A card's top-left corner on the free home grid, in 0-based fine cells. */
export interface FreeGridPosition {
  x: number;
  y: number;
}

export interface FreeGridItem {
  id: string;
  span: CardSpan;
  position?: FreeGridPosition;
}

interface PlacedRect extends FreeGridPosition {
  w: number;
  h: number;
}

function overlaps(left: PlacedRect, right: PlacedRect) {
  return (
    left.x < right.x + right.w &&
    right.x < left.x + left.w &&
    left.y < right.y + right.h &&
    right.y < left.y + left.h
  );
}

function findFirstFreeSlot(
  placed: PlacedRect[],
  span: CardSpan,
  columns: number,
  fromRow: number
): FreeGridPosition {
  const w = Math.min(columns, Math.max(1, span.w));
  const h = Math.max(1, span.h);
  for (let y = fromRow; ; y += 1) {
    for (let x = 0; x <= columns - w; x += 1) {
      if (!placed.some((other) => overlaps({ x, y, w, h }, other))) return { x, y };
    }
  }
}

/**
 * Places every item at its stored position. The priority item (the one just moved or resized)
 * wins; anything it or an earlier item overlaps slides straight down until it is clear. Items
 * without a position go below everything, so deliberate gaps are never filled behind the user's back.
 */
export function resolveFreeGridPlacements(
  items: FreeGridItem[],
  columns: number,
  priorityId?: string
): Map<string, FreeGridPosition> {
  const safeColumns = Math.max(1, Math.round(columns));
  const placed: PlacedRect[] = [];
  const result = new Map<string, FreeGridPosition>();
  const place = (item: FreeGridItem, start: FreeGridPosition) => {
    const w = Math.min(safeColumns, Math.max(1, item.span.w));
    const rect = {
      x: Math.min(Math.max(0, start.x), safeColumns - w),
      y: Math.max(0, start.y),
      w,
      h: Math.max(1, item.span.h),
    };
    while (placed.some((other) => overlaps(rect, other))) {
      rect.y += 1;
    }
    placed.push(rect);
    result.set(item.id, { x: rect.x, y: rect.y });
  };

  const indexed = items.map((item, index) => ({ item, index }));
  const priority = indexed.find(({ item }) => item.id === priorityId && item.position);
  const positioned = indexed
    .filter((entry) => entry !== priority && entry.item.position)
    .sort(
      (left, right) =>
        (left.item.position?.y ?? 0) - (right.item.position?.y ?? 0) ||
        (left.item.position?.x ?? 0) - (right.item.position?.x ?? 0) ||
        left.index - right.index
    );

  if (priority?.item.position) place(priority.item, priority.item.position);
  for (const { item } of positioned) {
    if (item.position) place(item, item.position);
  }

  const bottom = Math.max(0, ...placed.map((rect) => rect.y + rect.h));
  for (const { item } of indexed.filter(({ item }) => !item.position)) {
    place(item, findFirstFreeSlot(placed, item.span, safeColumns, bottom));
  }

  return result;
}

/** Card ids in the order they read on the wall: top to bottom, then left to right. */
export function sortByFreeGridPosition(
  cardIds: string[],
  positions: Record<string, FreeGridPosition>
) {
  return cardIds
    .map((id, index) => ({ id, index, position: positions[id] }))
    .sort(
      (left, right) =>
        (left.position ? 0 : 1) - (right.position ? 0 : 1) ||
        (left.position?.y ?? 0) - (right.position?.y ?? 0) ||
        (left.position?.x ?? 0) - (right.position?.x ?? 0) ||
        left.index - right.index
    )
    .map(({ id }) => id);
}
