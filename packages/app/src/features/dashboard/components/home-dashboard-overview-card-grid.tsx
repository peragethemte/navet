import { useDroppable } from '@dnd-kit/core';
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable';
import {
  type CardSpan,
  getMinCardSpan,
  getPresetForCardSpan,
  resolveCardSpanContentSize,
} from '@navet/app/components/shared/card-size';
import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import type { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { useI18n } from '@navet/app/hooks';
import type { DeviceWithType } from '@navet/app/types/device.types';
import { Plus } from 'lucide-react';
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useActiveHomeCardSpans,
  useDashboardCollectionStore,
} from '../dashboards/dashboard-collection-store';
import type { DropMeta } from '../hooks/use-home-dashboard-editor';
import { useHomeGridRuntime } from '../hooks/use-home-grid-runtime';
import type { CustomCard } from '../stores/custom-cards-store';
import type { FreeGridPosition } from '../utils/free-grid-layout';
import { DashboardCardItem, getAllowedSizes } from './dashboard-card-item';
import { HOME_CARD_GRID_ATTRIBUTE, HomeCardResizeHandle } from './home-card-resize-handle';
import {
  areCardIdsStable,
  type CardGridProps,
  isCustomCard,
} from './home-dashboard-overview.shared';
import { HomeCardSlot } from './home-dashboard-overview-card-slot';
import { HomeFreeGridDragMonitor } from './home-free-grid-drag-monitor';

// Free placement: neighbours stay put while a card is dragged; the drop cell decides.
const freePlacementStrategy: SortingStrategy = () => null;

export function FlowCanvas({
  cardIds,
  gridCols,
  activeDragCard,
  allCards,
  cardSizes,
  updateCardSize,
  isEditMode,
  onUpdateCard,
  onRemoveFromLayout,
  showHero,
  surface,
  onOpenAddCardDialog,
}: {
  cardIds: string[];
  gridCols: number;
  activeDragCard?: string | null;
  allCards: Map<string, DeviceWithType | CustomCard>;
  cardSizes: Record<string, CardSize>;
  updateCardSize: (id: string, size: CardSize) => void;
  isEditMode: boolean;
  onUpdateCard?: (cardId: string, data: Record<string, unknown>) => void;
  onRemoveFromLayout: (cardId: string) => void;
  showHero: boolean;
  surface: ReturnType<typeof getThemeSurfaceTokens>;
  onOpenAddCardDialog?: (targetSectionId?: string) => void;
}) {
  const { t } = useI18n();
  const sortableItems = useMemo(() => cardIds.map((cardId) => `home-card-${cardId}`), [cardIds]);

  return (
    <SortableContext items={sortableItems} strategy={freePlacementStrategy}>
      <HomeContainerDropZone cardIds={cardIds}>
        {cardIds.length > 0 ? (
          <CardGrid
            cardIds={cardIds}
            gridCols={gridCols}
            activeDragCard={activeDragCard}
            allCards={allCards}
            cardSizes={cardSizes}
            updateCardSize={updateCardSize}
            isEditMode={isEditMode}
            onUpdateCard={onUpdateCard}
            onRemoveFromLayout={onRemoveFromLayout}
            showHero={showHero}
            onOpenAddCardDialog={onOpenAddCardDialog}
            freePlacement
          />
        ) : (
          <EmptyCanvas
            label={t('dashboard.overview.emptyCanvas.title')}
            description={t('dashboard.overview.emptyCanvas.description')}
            surface={surface}
            onClick={onOpenAddCardDialog}
          />
        )}
      </HomeContainerDropZone>
    </SortableContext>
  );
}

export function EmptyCanvas({
  label,
  description: _description,
  surface,
  compact = false,
  onClick,
}: {
  label: string;
  description: string;
  surface: ReturnType<typeof getThemeSurfaceTokens>;
  compact?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[20px] border-2 border-dashed text-center ${
        compact ? 'min-h-45 px-5 py-6' : 'min-h-55 px-5 py-8'
      } ${surface.panelMuted}`}
      style={{
        borderColor: 'rgba(255,255,255,0.12)',
        background:
          'radial-gradient(circle at top left, rgba(159,176,255,0.12), transparent 32%), radial-gradient(circle at bottom right, rgba(159,176,255,0.06), transparent 28%)',
      }}
    >
      <div className="space-y-2">
        <div className={`text-sm font-semibold ${surface.textPrimary}`}>{label}</div>
      </div>
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}

export const CardGrid = memo(function CardGrid({
  cardIds,
  sectionId,
  gridCols,
  activeDragCard,
  allCards,
  cardSizes,
  updateCardSize,
  isEditMode,
  onUpdateCard,
  onRemoveFromLayout,
  showHero,
  onOpenAddCardDialog,
  sortable = true,
  freePlacement = false,
}: CardGridProps) {
  const { t } = useI18n();
  const hasTrailingAddCardSlot = isEditMode && Boolean(onOpenAddCardDialog);
  const [spanOverride, setSpanOverride] = useState<{ cardId: string; span: CardSpan } | null>(null);
  const updateActiveCardSpan = useDashboardCollectionStore((state) => state.updateActiveCardSpan);
  const storedCardSpans = useActiveHomeCardSpans();
  const updateActiveHomeLayout = useDashboardCollectionStore(
    (state) => state.updateActiveHomeLayout
  );
  const [positionOverride, setPositionOverride] = useState<{
    cardId: string;
    position: FreeGridPosition;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const canResize = isEditMode && sortable;
  const canPlaceFreely = canResize && freePlacement;
  const {
    buildFreePositions,
    cardSpans,
    freeBottomRow,
    gridPlacements,
    isFreeLayout,
    getCardGridArea,
    gridGapPx,
    gridRowHeightPx,
    gridStyle,
    innerContainerStyle,
    innerRef,
    isAutoScaled,
    optimizeOffscreenPaint,
    outerContainerStyle,
    outerRef,
    renderedGridCols,
    scale,
    visibleCardIds,
  } = useHomeGridRuntime({
    allCards,
    cardIds,
    cardSizes,
    gridCols,
    isEditMode,
    sortable,
    spanOverride,
    freePlacement,
    positionOverride,
  });
  const handleFreeDrop = useCallback(
    (cardId: string, position: FreeGridPosition) => {
      const cardPositions = buildFreePositions({ cardId, position });
      updateActiveHomeLayout((previous) => ({ ...previous, cardPositions }));
    },
    [buildFreePositions, updateActiveHomeLayout]
  );
  const draggedSpan = positionOverride ? cardSpans.get(positionOverride.cardId) : undefined;
  const draggedPlacement = positionOverride
    ? gridPlacements.get(positionOverride.cardId)
    : undefined;
  const addCardSlotCols = Math.min(renderedGridCols, 4);
  const hasInlineAddCardSlot = hasTrailingAddCardSlot;
  const handleAddCard = useCallback(() => {
    onOpenAddCardDialog?.();
  }, [onOpenAddCardDialog]);
  const addCardSlotStyle = useMemo(
    () =>
      ({
        gridColumn: `${isFreeLayout ? 1 : 'auto'} / span ${addCardSlotCols}`,
        gridRow: `${isFreeLayout ? freeBottomRow + 1 : 'auto'} / span 2`,
        borderColor: 'rgba(255,255,255,0.16)',
        background:
          'radial-gradient(circle at top left, rgba(159,176,255,0.1), transparent 34%), radial-gradient(circle at bottom right, rgba(159,176,255,0.06), transparent 28%)',
      }) as CSSProperties,
    [addCardSlotCols, freeBottomRow, isFreeLayout]
  );

  return (
    <div ref={outerRef} className="relative w-full" style={outerContainerStyle}>
      <div
        ref={innerRef}
        className={`w-full${isAutoScaled ? ' absolute left-0 top-0 origin-top-left' : ''}`}
        style={innerContainerStyle}
      >
        <div
          ref={gridRef}
          className="grid w-full grid-flow-row-dense"
          style={gridStyle}
          {...{ [HOME_CARD_GRID_ATTRIBUTE]: '' }}
        >
          {canPlaceFreely ? (
            <HomeFreeGridDragMonitor
              gridRef={gridRef}
              placements={gridPlacements}
              cardSpans={cardSpans}
              columns={renderedGridCols}
              gapPx={gridGapPx}
              rowHeightPx={gridRowHeightPx}
              scale={scale}
              onPreview={setPositionOverride}
              onDrop={handleFreeDrop}
            />
          ) : null}
          {draggedSpan && draggedPlacement ? (
            <div
              aria-hidden="true"
              className="pointer-events-none rounded-[20px] border-2 border-dashed border-white/35 bg-white/5"
              style={{
                gridColumnStart: draggedPlacement.column,
                gridColumnEnd: `span ${Math.min(renderedGridCols, draggedSpan.w)}`,
                gridRowStart: draggedPlacement.row,
                gridRowEnd: `span ${draggedSpan.h}`,
              }}
            />
          ) : null}
          {visibleCardIds.map((cardId) => {
            const entry = allCards.get(cardId);
            if (!entry) {
              return null;
            }

            const size = cardSizes[cardId] ?? entry.size;
            const cardLabel = !isCustomCard(entry)
              ? entry.name
              : typeof entry.data?.title === 'string'
                ? entry.data.title
                : entry.type;
            const span = cardSpans.get(cardId);
            const allowedSizes = canResize
              ? getAllowedSizes(
                  isCustomCard(entry) ? undefined : entry,
                  isCustomCard(entry) ? entry : undefined,
                  showHero
                )
              : [];

            return (
              <HomeCardSlot
                key={cardId}
                sortable={sortable}
                cardId={cardId}
                cardLabel={cardLabel}
                sectionId={sectionId}
                isPreviewHidden={activeDragCard === cardId}
                className=""
                style={getCardGridArea(cardId)}
                freePlacement={canPlaceFreely}
                resizeHandle={
                  canResize && span && allowedSizes.length > 0 ? (
                    <HomeCardResizeHandle
                      span={span}
                      minSpan={getMinCardSpan(allowedSizes)}
                      maxColumns={renderedGridCols}
                      gapPx={gridGapPx}
                      rowHeightPx={gridRowHeightPx}
                      scale={scale}
                      label={t('dashboard.edit.resizeCardHandle', { name: cardLabel })}
                      onPreview={(next) => setSpanOverride(next ? { cardId, span: next } : null)}
                      onCommit={(next) => {
                        const preset = getPresetForCardSpan(next, allowedSizes);
                        if (canPlaceFreely) {
                          const cardPositions = buildFreePositions({ cardId, span: next });
                          updateActiveHomeLayout((previous) => ({ ...previous, cardPositions }));
                        }
                        updateActiveCardSpan(
                          cardId,
                          preset ? null : next,
                          preset ?? resolveCardSpanContentSize(next, allowedSizes)
                        );
                      }}
                    />
                  ) : null
                }
                optimizeOffscreenPaint={optimizeOffscreenPaint}
                content={
                  !isCustomCard(entry) ? (
                    <DashboardCardItem
                      id={cardId}
                      device={entry}
                      size={size}
                      isEditMode={isEditMode}
                      handleSizeChange={updateCardSize}
                      onRemoveFromLayout={onRemoveFromLayout}
                      allowExtraLargeSizes={showHero}
                      customSpan={isEditMode ? storedCardSpans[cardId] : undefined}
                    />
                  ) : (
                    <DashboardCardItem
                      id={cardId}
                      card={entry}
                      size={size}
                      isEditMode={isEditMode}
                      handleSizeChange={updateCardSize}
                      onUpdateCard={onUpdateCard}
                      onRemoveFromLayout={onRemoveFromLayout}
                      allowExtraLargeSizes={showHero}
                      customSpan={isEditMode ? storedCardSpans[cardId] : undefined}
                    />
                  )
                }
              />
            );
          })}
          {hasInlineAddCardSlot ? (
            <button
              type="button"
              onClick={handleAddCard}
              className="flex min-h-21.75 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] border-2 border-dashed px-4 text-center"
              style={addCardSlotStyle}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Plus className="h-4 w-4 text-white/80" />
              </span>
              <span className="text-sm font-semibold text-white/90">
                {t('dashboard.addCard.title')}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}, areCardGridPropsEqual);

export function HomeContainerDropZone({
  children,
  sectionId,
  cardIds,
}: {
  children: ReactNode;
  sectionId?: string;
  cardIds: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: sectionId ? `home-container-${sectionId}` : 'home-container-flow',
    data: { type: 'container', sectionId } satisfies DropMeta,
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver && cardIds.length === 0 ? 'rounded-3xl ring-1 ring-white/20' : undefined}
    >
      {children}
    </div>
  );
}

function areCardGridPropsEqual(previous: CardGridProps, next: CardGridProps) {
  return (
    previous.sectionId === next.sectionId &&
    previous.gridCols === next.gridCols &&
    previous.activeDragCard === next.activeDragCard &&
    previous.updateCardSize === next.updateCardSize &&
    previous.isEditMode === next.isEditMode &&
    previous.onUpdateCard === next.onUpdateCard &&
    previous.onRemoveFromLayout === next.onRemoveFromLayout &&
    previous.showHero === next.showHero &&
    previous.onOpenAddCardDialog === next.onOpenAddCardDialog &&
    previous.sortable === next.sortable &&
    areCardIdsStable(
      previous.cardIds,
      next.cardIds,
      previous.allCards,
      next.allCards,
      previous.cardSizes,
      next.cardSizes
    )
  );
}
