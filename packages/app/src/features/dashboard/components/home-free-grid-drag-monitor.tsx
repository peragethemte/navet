import { useDndMonitor } from '@dnd-kit/core';
import type { CardSpan } from '@navet/app/components/shared/card-size';
import { type RefObject, useRef } from 'react';
import type { DashboardGridPlacement } from '../device-grid/device-grid-layout';
import type { DragMeta } from '../hooks/use-home-dashboard-editor';
import type { FreeGridPosition } from '../utils/free-grid-layout';

interface HomeFreeGridDragMonitorProps {
  gridRef: RefObject<HTMLDivElement | null>;
  placements: Map<string, DashboardGridPlacement>;
  cardSpans: Map<string, CardSpan>;
  columns: number;
  gapPx: number;
  rowHeightPx: number;
  scale: number;
  onPreview: (preview: { cardId: string; position: FreeGridPosition } | null) => void;
  onDrop: (cardId: string, position: FreeGridPosition) => void;
}

interface DragOrigin {
  cardId: string;
  start: FreeGridPosition;
  span: CardSpan;
  stepX: number;
  stepY: number;
  last: FreeGridPosition;
}

/** Turns a dnd-kit card drag into a snapped target cell on the free flow grid. */
export function HomeFreeGridDragMonitor({
  gridRef,
  placements,
  cardSpans,
  columns,
  gapPx,
  rowHeightPx,
  scale,
  onPreview,
  onDrop,
}: HomeFreeGridDragMonitorProps) {
  const originRef = useRef<DragOrigin | null>(null);
  const safeScale = scale > 0 ? scale : 1;

  const resolveTarget = (delta: { x: number; y: number }) => {
    const origin = originRef.current;
    if (!origin) return null;
    const w = Math.min(columns, origin.span.w);
    return {
      x: Math.min(
        Math.max(0, origin.start.x + Math.round(delta.x / safeScale / origin.stepX)),
        columns - w
      ),
      y: Math.max(0, origin.start.y + Math.round(delta.y / safeScale / origin.stepY)),
    };
  };

  useDndMonitor({
    onDragStart: ({ active }) => {
      const meta = active.data.current as DragMeta | undefined;
      if (meta?.source !== 'home' || !meta.free) {
        originRef.current = null;
        return;
      }
      const placement = placements.get(meta.cardId);
      const span = cardSpans.get(meta.cardId);
      if (!placement || !span) {
        originRef.current = null;
        return;
      }
      const gridWidth = (gridRef.current?.getBoundingClientRect().width ?? 0) / safeScale;
      const start = { x: placement.column - 1, y: placement.row - 1 };
      originRef.current = {
        cardId: meta.cardId,
        start,
        span,
        stepX: (gridWidth + gapPx) / Math.max(1, columns) || rowHeightPx + gapPx,
        stepY: rowHeightPx + gapPx,
        last: start,
      };
      onPreview({ cardId: meta.cardId, position: start });
    },
    onDragMove: ({ delta }) => {
      const origin = originRef.current;
      const target = resolveTarget(delta);
      if (!origin || !target || (target.x === origin.last.x && target.y === origin.last.y)) return;
      origin.last = target;
      onPreview({ cardId: origin.cardId, position: target });
    },
    onDragEnd: ({ delta }) => {
      const origin = originRef.current;
      const target = resolveTarget(delta);
      originRef.current = null;
      onPreview(null);
      if (origin && target && (target.x !== origin.start.x || target.y !== origin.start.y)) {
        onDrop(origin.cardId, target);
      }
    },
    onDragCancel: () => {
      originRef.current = null;
      onPreview(null);
    },
  });

  return null;
}
