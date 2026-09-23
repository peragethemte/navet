import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { cn } from '@navet/app/components/ui/utils';
import { type ThemeType, useI18n } from '@navet/app/hooks';
import type { ChorePresentationMetadata } from '@navet/core/chore-experience';
import type { ChoreDefinition, ChoreOccurrence, ChoreParticipant } from '@navet/core/chores';
import { ListChecks } from 'lucide-react';
import type { ChoreCardAction } from '../chore-card';
import { ChoreWidgetCardShell, type ChoreWidgetCardState } from '../chore-widget-card-shell';
import { ChoreWidgetRow } from '../chore-widget-row';

export interface ChoresCardRow {
  definition: ChoreDefinition;
  occurrence: ChoreOccurrence;
  presentation?: ChorePresentationMetadata;
  action?: ChoreCardAction;
}

/** How many rows stay readable at a glance for each supported size. */
export function choreRowsForSize(size: CardSize): number {
  if (size === 'small') return 2;
  return size === 'medium' ? 4 : 7;
}

export function ChoresCardView({
  size,
  theme,
  state,
  title,
  rows,
  participantsById,
  now,
  remaining,
  tintColor,
  childMode = false,
  showPoints = true,
  onOpenSettings,
}: {
  size: CardSize;
  theme: ThemeType;
  state: ChoreWidgetCardState;
  title: string;
  rows: ChoresCardRow[];
  participantsById: Record<string, ChoreParticipant>;
  now: Date;
  remaining: number;
  tintColor?: string;
  childMode?: boolean;
  showPoints?: boolean;
  onOpenSettings: () => void;
}) {
  const { t } = useI18n();
  const surface = getThemeSurfaceTokens(theme);
  const dense = size === 'small';
  const visible = rows.slice(0, choreRowsForSize(size));
  const hidden = rows.length - visible.length;

  return (
    <ChoreWidgetCardShell
      size={size}
      theme={theme}
      icon={ListChecks}
      title={title}
      meta={
        state === 'ready' ? (
          <span className={cn('text-xs font-semibold tabular-nums', surface.textSecondary)}>
            {t('chores.card.remaining', { count: remaining })}
          </span>
        ) : undefined
      }
      state={state}
      emptyTitle={t('chores.card.emptyTitle')}
      emptyDescription={t('chores.card.emptyDescription')}
      disabledTitle={t('chores.card.disabledTitle')}
      disabledDescription={t('chores.card.disabledDescription')}
      unavailableTitle={t('chores.card.unavailableTitle')}
      unavailableDescription={t('chores.card.unavailableDescription')}
      loadingLabel={t('chores.card.loading')}
      settingsLabel={t('chores.card.openSettings')}
      onOpenSettings={onOpenSettings}
      tintColor={tintColor}
    >
      <ul className="min-w-0">
        {visible.map((row) => (
          <ChoreWidgetRow
            key={row.occurrence.id}
            definition={row.definition}
            occurrence={row.occurrence}
            participantsById={participantsById}
            presentation={row.presentation}
            action={row.action}
            now={now}
            dense={dense}
            showPoints={showPoints}
            childMode={childMode}
          />
        ))}
      </ul>
      {hidden > 0 ? (
        <p className={cn('px-1 pt-1 text-[11px]', surface.textMuted)}>
          {t('chores.card.more', { count: hidden })}
        </p>
      ) : null}
    </ChoreWidgetCardShell>
  );
}
