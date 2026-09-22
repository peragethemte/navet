import { useSortable } from '@dnd-kit/sortable';
import { getDndTransformStyle } from '@navet/app/components/shared/dnd-transform-style';
import type { CSSProperties, ReactNode } from 'react';
import type { DragMeta, DropMeta } from '../hooks/use-home-dashboard-editor';

function SortableHomeCard({
  cardId,
  cardLabel,
  sectionId,
  isPreviewHidden,
  className,
  style,
  resizeHandle,
  optimizeOffscreenPaint,
  children,
}: {
  cardId: string;
  cardLabel?: string;
  sectionId?: string;
  isPreviewHidden: boolean;
  className: string;
  style?: CSSProperties;
  resizeHandle?: ReactNode;
  /** When true, skip layout/paint for off-screen cards (not used at `effectsQuality: high`). */
  optimizeOffscreenPaint: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `home-card-${cardId}`,
    data: { source: 'home', cardId, sectionId, type: 'card' } as DragMeta & DropMeta,
  });

  return (
    <div
      ref={setNodeRef}
      {...{ ...attributes, 'aria-label': cardLabel ?? cardId }}
      {...listeners}
      style={isDragging ? style : { ...style, ...getDndTransformStyle(transform, transition) }}
      className={`${className} relative h-full cursor-grab active:cursor-grabbing ${
        isPreviewHidden ? 'opacity-0' : isDragging ? 'opacity-40' : ''
      }`}
      data-card-id={cardId}
      data-card-drag-surface="true"
    >
      <div
        className={
          optimizeOffscreenPaint
            ? 'h-full min-h-40 [content-visibility:auto] [contain-intrinsic-block-size:10rem]'
            : 'h-full min-h-0'
        }
      >
        {children}
      </div>
      {isDragging ? null : resizeHandle}
    </div>
  );
}

export function HomeCardSlot({
  sortable,
  cardId,
  cardLabel,
  sectionId,
  isPreviewHidden,
  className,
  style,
  resizeHandle,
  content,
  optimizeOffscreenPaint = false,
}: {
  sortable: boolean;
  cardId: string;
  cardLabel?: string;
  sectionId?: string;
  isPreviewHidden: boolean;
  className: string;
  style?: CSSProperties;
  resizeHandle?: ReactNode;
  content: ReactNode;
  optimizeOffscreenPaint?: boolean;
}) {
  if (!sortable) {
    return (
      <div
        className={`${className} h-full${
          optimizeOffscreenPaint
            ? ' min-h-40 [content-visibility:auto] [contain-intrinsic-block-size:10rem]'
            : ''
        }`}
        style={style}
      >
        {content}
      </div>
    );
  }

  return (
    <SortableHomeCard
      cardId={cardId}
      cardLabel={cardLabel}
      sectionId={sectionId}
      isPreviewHidden={isPreviewHidden}
      className={className}
      style={style}
      resizeHandle={resizeHandle}
      optimizeOffscreenPaint={optimizeOffscreenPaint}
    >
      {content}
    </SortableHomeCard>
  );
}
