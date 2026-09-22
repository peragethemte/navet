import type { CardSpan } from '@navet/app/components/shared/card-size';
import {
  type CardSize,
  getDashboardCardGridSpan,
} from '@navet/app/components/shared/card-size-selector';

export interface DashboardGridLayoutItem {
  id: string;
  size: CardSize;
  /** Free footprint in grid cells; wins over the preset and opts the item out of micro bundling. */
  span?: CardSpan;
}

export interface DashboardGridPlacement {
  column: number;
  row: number;
}

export interface DashboardGridPackingOptions {
  placementPreference?: 'least-fragmented' | 'leftmost';
  /** Grid cells per preset micro-track, per axis. */
  cellScale?: number;
}

interface DashboardGridPackingMember {
  id: string;
  columnOffset: number;
  rowOffset: number;
}

interface DashboardGridPackingUnit {
  sourceIndex: number;
  width: number;
  height: number;
  members: DashboardGridPackingMember[];
}

function getItemSpan(item: DashboardGridLayoutItem, cellScale: number) {
  if (item.span) return { cols: item.span.w, rows: item.span.h };
  const span = getDashboardCardGridSpan(item.size);
  return { cols: span.cols * cellScale, rows: span.rows * cellScale };
}

function isMicroPreset(item: DashboardGridLayoutItem | undefined) {
  return !!item && !item.span && (item.size === 'tiny' || item.size === 'extra-small');
}

function buildMicroCardPackingUnits(
  items: Array<DashboardGridLayoutItem & { sourceIndex: number }>,
  cellScale: number
): DashboardGridPackingUnit[] {
  const tinyItems = items.filter((item) => item.size === 'tiny');
  const extraSmallItems = items.filter((item) => item.size === 'extra-small');
  const bundledIds = new Set<string>();
  const units: DashboardGridPackingUnit[] = [];
  const bundleCount = Math.min(Math.floor(tinyItems.length / 2), extraSmallItems.length);

  for (let index = 0; index < bundleCount; index += 1) {
    const firstTiny = tinyItems[index * 2];
    const secondTiny = tinyItems[index * 2 + 1];
    const extraSmall = extraSmallItems[index];

    if (!firstTiny || !secondTiny || !extraSmall) continue;

    bundledIds.add(firstTiny.id);
    bundledIds.add(secondTiny.id);
    bundledIds.add(extraSmall.id);
    units.push({
      sourceIndex: Math.min(firstTiny.sourceIndex, secondTiny.sourceIndex, extraSmall.sourceIndex),
      width: 2 * cellScale,
      height: 2 * cellScale,
      members: [
        { id: firstTiny.id, columnOffset: 0, rowOffset: 0 },
        { id: secondTiny.id, columnOffset: cellScale, rowOffset: 0 },
        { id: extraSmall.id, columnOffset: 0, rowOffset: cellScale },
      ],
    });
  }

  for (const item of items) {
    if (bundledIds.has(item.id)) continue;

    const span = getItemSpan(item, cellScale);
    units.push({
      sourceIndex: item.sourceIndex,
      width: span.cols,
      height: span.rows,
      members: [{ id: item.id, columnOffset: 0, rowOffset: 0 }],
    });
  }

  return units.sort((left, right) => left.sourceIndex - right.sourceIndex);
}

function buildPackingUnits(
  items: DashboardGridLayoutItem[],
  columnCount: number,
  cellScale: number
): DashboardGridPackingUnit[] {
  const units: DashboardGridPackingUnit[] = [];
  let runStart = 0;

  while (runStart < items.length) {
    const firstItem = items[runStart];
    if (!firstItem) break;

    if (columnCount >= 2 * cellScale && isMicroPreset(firstItem)) {
      let runEnd = runStart + 1;
      while (runEnd < items.length && isMicroPreset(items[runEnd])) {
        runEnd += 1;
      }

      units.push(
        ...buildMicroCardPackingUnits(
          items.slice(runStart, runEnd).map((item, offset) => ({
            ...item,
            sourceIndex: runStart + offset,
          })),
          cellScale
        )
      );
      runStart = runEnd;
      continue;
    }

    const span = getItemSpan(firstItem, cellScale);
    units.push({
      sourceIndex: runStart,
      width: span.cols,
      height: span.rows,
      members: [{ id: firstItem.id, columnOffset: 0, rowOffset: 0 }],
    });
    runStart += 1;
  }

  return units;
}

function canPlace(
  occupied: boolean[][],
  column: number,
  row: number,
  width: number,
  height: number
) {
  for (let y = row; y < row + height; y += 1) {
    for (let x = column; x < column + width; x += 1) {
      if (occupied[y]?.[x]) return false;
    }
  }

  return true;
}

function countEmptySegments(row: boolean[], columnCount: number) {
  let segments = 0;
  let insideEmptySegment = false;

  for (let column = 0; column < columnCount; column += 1) {
    const isEmpty = !row[column];
    if (isEmpty && !insideEmptySegment) segments += 1;
    insideEmptySegment = isEmpty;
  }

  return segments;
}

function getFragmentationScore(
  occupied: boolean[][],
  column: number,
  row: number,
  width: number,
  height: number,
  columnCount: number
) {
  let score = 0;

  for (let y = row; y < row + height; y += 1) {
    const nextRow = Array.from({ length: columnCount }, (_, x) => occupied[y]?.[x] ?? false);
    for (let x = column; x < column + width; x += 1) nextRow[x] = true;
    score += Math.max(0, countEmptySegments(nextRow, columnCount) - 1);
  }

  return score;
}

/**
 * Produces stable explicit positions for the automatic room grid.
 *
 * Items retain their source priority at the card-block level. Within a consecutive run of micro
 * cards, two tiny cards and one extra-small card form a complete 2x2 block. When a block can fit in
 * several places on the same earliest row, the least-fragmenting position wins. This keeps mixed
 * card grids harmonious without splitting following rows into narrow unusable holes.
 */
export function packDashboardGridItems(
  items: DashboardGridLayoutItem[],
  columnCount: number,
  options: DashboardGridPackingOptions = {}
): Map<string, DashboardGridPlacement> {
  const safeColumnCount = Math.max(1, Math.round(columnCount));
  const occupied: boolean[][] = [];
  const placements = new Map<string, DashboardGridPlacement>();
  const packingUnits = buildPackingUnits(
    items,
    safeColumnCount,
    Math.max(1, Math.round(options.cellScale ?? 1))
  );

  for (const unit of packingUnits) {
    const width = Math.min(safeColumnCount, unit.width);
    const height = Math.max(1, unit.height);
    let row = 0;

    while (true) {
      const candidates: Array<{ column: number; score: number }> = [];

      for (let column = 0; column <= safeColumnCount - width; column += 1) {
        if (!canPlace(occupied, column, row, width, height)) continue;
        candidates.push({
          column,
          score: getFragmentationScore(occupied, column, row, width, height, safeColumnCount),
        });
      }

      if (candidates.length > 0) {
        candidates.sort((left, right) =>
          options.placementPreference === 'leftmost'
            ? left.column - right.column || left.score - right.score
            : left.score - right.score || left.column - right.column
        );
        const column = candidates[0]?.column ?? 0;

        for (let y = row; y < row + height; y += 1) {
          occupied[y] ??= Array.from({ length: safeColumnCount }, () => false);
          for (let x = column; x < column + width; x += 1) occupied[y][x] = true;
        }

        for (const member of unit.members) {
          placements.set(member.id, {
            column: column + member.columnOffset + 1,
            row: row + member.rowOffset + 1,
          });
        }
        break;
      }

      row += 1;
    }
  }

  return placements;
}
