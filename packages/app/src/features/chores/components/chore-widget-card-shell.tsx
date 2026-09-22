import { CardEmptyState } from '@navet/app/components/patterns';
import { BaseCard } from '@navet/app/components/primitives';
import { CardSettingsActionButton } from '@navet/app/components/shared/card-settings-action-button';
import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getCustomCardTintSurface } from '@navet/app/components/shared/theme/custom-card-tint-surface';
import { themeColorValues } from '@navet/app/components/shared/theme/theme-colors';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { cn } from '@navet/app/components/ui/utils';
import type { ThemeType } from '@navet/app/hooks';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ChoreWidgetCardState = 'ready' | 'loading' | 'disabled' | 'unavailable' | 'empty';

/**
 * Shared shell for the Chores and Homework dashboard cards: the widget surface, the household tint,
 * the settings affordance and the non-ready states. Rows are supplied by each card.
 */
export function ChoreWidgetCardShell({
  size,
  theme,
  icon,
  title,
  meta,
  state,
  emptyTitle,
  emptyDescription,
  disabledTitle,
  disabledDescription,
  unavailableTitle,
  unavailableDescription,
  loadingLabel,
  settingsLabel,
  onOpenSettings,
  tintColor,
  hasOverdue = false,
  children,
}: {
  size: CardSize;
  theme: ThemeType;
  icon: LucideIcon;
  title: string;
  meta?: ReactNode;
  state: ChoreWidgetCardState;
  emptyTitle: string;
  emptyDescription: string;
  disabledTitle: string;
  disabledDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  loadingLabel: string;
  settingsLabel: string;
  onOpenSettings: () => void;
  /** Resolved household colour, or the user's own tint when they set one. */
  tintColor?: string;
  hasOverdue?: boolean;
  children?: ReactNode;
}) {
  const surface = getThemeSurfaceTokens(theme);
  const tintSurface = getCustomCardTintSurface(theme, tintColor);
  const overdueEdge = hasOverdue
    ? {
        borderColor: themeColorValues.red,
        boxShadow: `inset 0 1px 0 ${themeColorValues.red}24, 0 0 0 1px ${themeColorValues.red}14`,
      }
    : undefined;

  return (
    <BaseCard
      size={size}
      style={{ ...tintSurface.panelStyle, ...overdueEdge }}
      readableBackgroundColor={tintSurface.backgroundColor}
      overlay={
        tintSurface.glowStyle ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            data-dashboard-glow="true"
            style={tintSurface.glowStyle}
          />
        ) : null
      }
      contentClassName="h-full"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-1 flex items-start gap-2">
          <h3 className={cn('min-w-0 flex-1 truncate text-sm font-semibold', surface.textPrimary)}>
            {title}
          </h3>
          {meta ? <div className="shrink-0">{meta}</div> : null}
          <CardSettingsActionButton
            theme={theme}
            size="small"
            variant="soft"
            disableHoverEffects
            aria-label={settingsLabel}
            className="shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSettings();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>

        {state === 'disabled' ? (
          <CardEmptyState
            icon={icon}
            size={size}
            title={disabledTitle}
            description={disabledDescription}
          />
        ) : state === 'unavailable' ? (
          <CardEmptyState
            icon={icon}
            size={size}
            title={unavailableTitle}
            description={unavailableDescription}
          />
        ) : state === 'loading' ? (
          <p className={cn('px-1 py-2 text-xs', surface.textSecondary)}>{loadingLabel}</p>
        ) : state === 'empty' ? (
          <CardEmptyState
            icon={icon}
            size={size}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        )}
      </div>
    </BaseCard>
  );
}
