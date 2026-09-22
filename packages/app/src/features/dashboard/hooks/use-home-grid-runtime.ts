import {
  type CardSpan,
  getHomeGridFineTrackPx,
  getPresetCardSpan,
  HOME_GRID_SUBDIVISION,
} from '@navet/app/components/shared/card-size';
import {
  type CardSize,
  getDashboardCardGridMetrics,
  getResponsiveCardSize,
} from '@navet/app/components/shared/card-size-selector';
import { useBreakpointCols } from '@navet/app/hooks/use-breakpoint-cols';
import { settingsSelectors } from '@navet/app/stores/selectors';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import type { DeviceWithType } from '@navet/app/types/device.types';
import { detectDeviceTier } from '@navet/app/utils/detect-device-tier';
import { type CSSProperties, useMemo } from 'react';
import { getCardGridGapPx } from '../components/home-dashboard-overview.shared';
import { useActiveHomeCardSpans } from '../dashboards/dashboard-collection-store';
import { packDashboardGridItems } from '../device-grid/device-grid-layout';
import type { CustomCard } from '../stores/custom-cards-store';
import { useAutoScaledGridMeasurements } from './use-auto-scaled-grid-measurements';
import { resolveDashboardPerformanceProfile } from './use-dashboard-performance-mode';
import { useProgressiveBatching } from './use-progressive-batching';

interface UseHomeGridRuntimeOptions {
  allCards: Map<string, DeviceWithType | CustomCard>;
  cardIds: string[];
  cardSizes: Record<string, CardSize>;
  densePerformanceMode?: boolean;
  gridCols?: number;
  isEditMode: boolean;
  sortable?: boolean;
  /** Live footprint while a resize handle is dragged. */
  spanOverride?: { cardId: string; span: CardSpan } | null;
}

export function useHomeGridRuntime({
  allCards,
  cardIds,
  cardSizes,
  densePerformanceMode = false,
  gridCols,
  isEditMode,
  spanOverride,
}: UseHomeGridRuntimeOptions) {
  const storedCardSpans = useActiveHomeCardSpans();
  const disableAnimations = useSettingsStore(settingsSelectors.disableAnimations);
  const effectsQuality = useSettingsStore(settingsSelectors.effectsQuality);
  const lowPowerMode = useSettingsStore(settingsSelectors.lowPowerMode);
  const breakpointCols = useBreakpointCols();
  const visibleDevices = useMemo(
    () =>
      cardIds.flatMap((cardId) => {
        const entry = allCards.get(cardId);
        return entry && !('createdAt' in entry) ? [entry] : [];
      }),
    [allCards, cardIds]
  );
  const performanceProfile = useMemo(
    () =>
      resolveDashboardPerformanceProfile({
        activeSection: 'home',
        deviceTier: detectDeviceTier(),
        effectsQuality,
        isEditMode,
        lowPowerMode,
        reducedEffectsEnabled: disableAnimations || lowPowerMode,
        visibleCardCount: cardIds.length,
        visibleDevices,
      }),
    [cardIds.length, disableAnimations, effectsQuality, isEditMode, lowPowerMode, visibleDevices]
  );
  const shouldBatchCards =
    !isEditMode && (densePerformanceMode || performanceProfile.batchHeavyCards);
  const batchedVisibleCount = useProgressiveBatching(cardIds.length, isEditMode, {
    enabled: shouldBatchCards,
    initialBatch: performanceProfile.progressiveBatchInitialCount,
    batchSize: performanceProfile.progressiveBatchSize,
  });
  const visibleCardIds = useMemo(
    () => (shouldBatchCards ? cardIds.slice(0, batchedVisibleCount) : cardIds),
    [batchedVisibleCount, cardIds, shouldBatchCards]
  );
  const logicalGridCols = Math.max(1, Math.min(gridCols ?? breakpointCols, breakpointCols));
  const gridGapPx = getCardGridGapPx(breakpointCols);
  const resolvedCardSizes = useMemo(
    () =>
      cardIds.map((cardId) => {
        const entry = allCards.get(cardId);
        return cardSizes[cardId] ?? entry?.size ?? 'small';
      }),
    [allCards, cardIds, cardSizes]
  );
  const cardSpans = useMemo(() => {
    const spans = new Map<string, CardSpan>();
    for (const cardId of cardIds) {
      const entry = allCards.get(cardId);
      if (!entry) continue;
      const custom = spanOverride?.cardId === cardId ? spanOverride.span : storedCardSpans[cardId];
      spans.set(
        cardId,
        custom ??
          getPresetCardSpan(getResponsiveCardSize(cardSizes[cardId] ?? entry.size, breakpointCols))
      );
    }
    return spans;
  }, [allCards, breakpointCols, cardIds, cardSizes, spanOverride, storedCardSpans]);
  const hasOnlyTinyCards = useMemo(
    () =>
      resolvedCardSizes.length > 0 &&
      resolvedCardSizes.every((size) => size === 'tiny') &&
      cardIds.every((cardId) => !storedCardSpans[cardId] && spanOverride?.cardId !== cardId),
    [cardIds, resolvedCardSizes, spanOverride, storedCardSpans]
  );
  const metricsLogicalCols = hasOnlyTinyCards ? 1 : logicalGridCols;
  const renderedGridCols = hasOnlyTinyCards
    ? HOME_GRID_SUBDIVISION
    : logicalGridCols * 2 * HOME_GRID_SUBDIVISION;
  const { microCardMinWidth, rowHeightPx, targetGridWidth } = useMemo(() => {
    const cellWidth = getHomeGridFineTrackPx(
      getDashboardCardGridMetrics(Math.max(1, Math.ceil(metricsLogicalCols))).microCardMinWidthPx,
      gridGapPx
    );
    return {
      microCardMinWidth: cellWidth,
      rowHeightPx: getHomeGridFineTrackPx(
        getDashboardCardGridMetrics(breakpointCols).rowHeightPx,
        gridGapPx
      ),
      targetGridWidth: renderedGridCols * cellWidth + Math.max(0, renderedGridCols - 1) * gridGapPx,
    };
  }, [breakpointCols, gridGapPx, metricsLogicalCols, renderedGridCols]);
  const { outerRef, innerRef, outerWidth, contentHeight } =
    useAutoScaledGridMeasurements(targetGridWidth);
  const autoScale =
    renderedGridCols <= 1 || outerWidth <= 0 ? 1 : Math.min(1, outerWidth / targetGridWidth);
  const isAutoScaled = autoScale < 0.999;
  const outerContainerStyle = useMemo(
    () => (isAutoScaled && contentHeight > 0 ? { height: contentHeight * autoScale } : undefined),
    [autoScale, contentHeight, isAutoScaled]
  );
  const innerContainerStyle = useMemo(
    () =>
      ({
        ...(isAutoScaled
          ? {
              transform: `scale(${autoScale})`,
              width: `${targetGridWidth}px`,
            }
          : {}),
      }) as CSSProperties,
    [autoScale, isAutoScaled, targetGridWidth]
  );
  const gridStyle = useMemo(
    () =>
      ({
        '--home-card-cols': renderedGridCols,
        '--home-card-min': `${microCardMinWidth}px`,
        gap: `${gridGapPx}px`,
        gridAutoRows: `${rowHeightPx}px`,
        gridTemplateColumns: 'repeat(var(--home-card-cols), minmax(var(--home-card-min), 1fr))',
      }) as CSSProperties,
    [gridGapPx, microCardMinWidth, renderedGridCols, rowHeightPx]
  );
  const gridPlacements = useMemo(
    () =>
      packDashboardGridItems(
        cardIds.flatMap((cardId) => {
          const entry = allCards.get(cardId);
          if (!entry) return [];

          const custom =
            spanOverride?.cardId === cardId ? spanOverride.span : storedCardSpans[cardId];
          return [
            {
              id: cardId,
              size: getResponsiveCardSize(cardSizes[cardId] ?? entry.size, breakpointCols),
              span: custom,
            },
          ];
        }),
        renderedGridCols,
        { placementPreference: 'leftmost', cellScale: HOME_GRID_SUBDIVISION }
      ),
    [allCards, breakpointCols, cardIds, cardSizes, renderedGridCols, spanOverride, storedCardSpans]
  );
  const getCardGridArea = (cardId: string): CSSProperties => {
    const span = cardSpans.get(cardId);
    const placement = gridPlacements.get(cardId);
    return {
      gridColumnStart: placement?.column,
      gridColumnEnd: `span ${Math.min(renderedGridCols, span?.w ?? 1)}`,
      gridRowStart: placement?.row,
      gridRowEnd: `span ${span?.h ?? 1}`,
    };
  };
  return {
    breakpointCols,
    cardSpans,
    getCardGridArea,
    gridGapPx,
    gridRowHeightPx: rowHeightPx,
    gridPlacements,
    gridStyle,
    innerContainerStyle,
    innerRef,
    isAutoScaled,
    microCardMinWidth,
    optimizeOffscreenPaint:
      !isEditMode && (densePerformanceMode || performanceProfile.optimizeOffscreenPaint),
    outerContainerStyle,
    outerRef,
    renderedGridCols,
    scale: autoScale,
    targetGridWidth,
    visibleCardIds,
  };
}
