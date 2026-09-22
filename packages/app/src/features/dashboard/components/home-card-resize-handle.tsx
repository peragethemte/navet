import {
  areCardSpansEqual,
  type CardSpan,
  MAX_CARD_SPAN_CELLS,
} from '@navet/app/components/shared/card-size';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';

interface HomeCardResizeHandleProps {
  span: CardSpan;
  minSpan: CardSpan;
  maxColumns: number;
  gapPx: number;
  rowHeightPx: number;
  /** The grid's CSS scale, so pointer deltas map back to cells. */
  scale: number;
  label: string;
  onPreview: (span: CardSpan | null) => void;
  onCommit: (span: CardSpan) => void;
}

interface DragState {
  pointerId: number;
  originX: number;
  originY: number;
  start: CardSpan;
  last: CardSpan;
  stepX: number;
  stepY: number;
}

export const HOME_CARD_GRID_ATTRIBUTE = 'data-home-card-grid';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

export function HomeCardResizeHandle({
  span,
  minSpan,
  maxColumns,
  gapPx,
  rowHeightPx,
  scale,
  label,
  onPreview,
  onCommit,
}: HomeCardResizeHandleProps) {
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const clampSpan = (next: CardSpan): CardSpan => ({
    w: clamp(next.w, minSpan.w, Math.min(maxColumns, MAX_CARD_SPAN_CELLS)),
    h: clamp(next.h, minSpan.h, MAX_CARD_SPAN_CELLS),
  });

  const endDrag = (commit: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    onPreview(null);
    if (commit && drag && !areCardSpansEqual(drag.start, drag.last)) {
      onCommit(drag.last);
    }
  };
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;

  useEffect(() => {
    if (!isDragging) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        endDragRef.current(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isDragging]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const safeScale = scale > 0 ? scale : 1;
    // Columns stretch with 1fr, so the step comes from the rendered grid, not the minimum track.
    const gridWidth =
      (event.currentTarget.closest(`[${HOME_CARD_GRID_ATTRIBUTE}]`)?.getBoundingClientRect()
        .width ?? 0) / safeScale;
    dragRef.current = {
      stepX: (gridWidth + gapPx) / Math.max(1, maxColumns) || rowHeightPx + gapPx,
      stepY: rowHeightPx + gapPx,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      start: span,
      last: span,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const safeScale = scale > 0 ? scale : 1;
    const next = clampSpan({
      w: drag.start.w + Math.round((event.clientX - drag.originX) / safeScale / drag.stepX),
      h: drag.start.h + Math.round((event.clientY - drag.originY) / safeScale / drag.stepY),
    });
    if (areCardSpansEqual(next, drag.last)) return;
    drag.last = next;
    onPreview(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = {
      ArrowLeft: { w: -1, h: 0 },
      ArrowRight: { w: 1, h: 0 },
      ArrowUp: { w: 0, h: -1 },
      ArrowDown: { w: 0, h: 1 },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    const next = clampSpan({ w: span.w + delta.w, h: span.h + delta.h });
    if (!areCardSpansEqual(next, span)) onCommit(next);
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Not `data-dashboard-edit-action`: the edit-actions wrapper swallows pointerdown on those.
      data-card-interactive="true"
      className={`absolute right-0.5 bottom-0.5 z-600 flex h-6 w-6 cursor-nwse-resize touch-none items-end justify-end rounded-br-[18px] p-1 text-white/80 transition-opacity hover:text-white ${
        isDragging ? 'opacity-100' : 'opacity-70 hover:opacity-100'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) endDrag(true);
      }}
      onPointerCancel={() => endDrag(false)}
      onLostPointerCapture={() => {
        if (dragRef.current) endDrag(true);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={handleKeyDown}
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 drop-shadow">
        <path
          d="M11 3 3 11M11 7 7 11"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
