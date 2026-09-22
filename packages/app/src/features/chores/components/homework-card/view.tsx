import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { cn } from '@navet/app/components/ui/utils';
import { type ThemeType, useI18n } from '@navet/app/hooks';
import type { ChoreDefinition, ChoreOccurrence, ChoreParticipant } from '@navet/core/chores';
import { GraduationCap } from 'lucide-react';
import type { ChoreCardAction } from '../chore-card';
import { ChoreWidgetCardShell, type ChoreWidgetCardState } from '../chore-widget-card-shell';
import { ChoreWidgetRow } from '../chore-widget-row';

export interface HomeworkCardRow {
  definition: ChoreDefinition;
  occurrence?: ChoreOccurrence;
  action?: ChoreCardAction;
  overdue: boolean;
}

/** How many rows stay readable at a glance for each supported size. */
export function homeworkRowsForSize(size: CardSize): number {
  if (size === 'small') return 3;
  return size === 'medium' ? 5 : 9;
}

export function HomeworkCardView({
  size,
  theme,
  state,
  title,
  rows,
  participantsById,
  now,
  remaining,
  overdue,
  tintColor,
  onOpenSettings,
}: {
  size: CardSize;
  theme: ThemeType;
  state: ChoreWidgetCardState;
  title: string;
  rows: HomeworkCardRow[];
  participantsById: Record<string, ChoreParticipant>;
  now: Date;
  remaining: number;
  overdue: number;
  tintColor?: string;
  onOpenSettings: () => void;
}) {
  const { t } = useI18n();
  const surface = getThemeSurfaceTokens(theme);
  const dense = size === 'small';
  const visible = rows.slice(0, homeworkRowsForSize(size));
  const hidden = rows.length - visible.length;

  return (
    <ChoreWidgetCardShell
      size={size}
      theme={theme}
      icon={GraduationCap}
      title={title}
      meta={
        state === 'ready' ? (
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              overdue > 0 ? 'text-red-400' : surface.textSecondary
            )}
          >
            {overdue > 0
              ? t('homework.card.overdueCount', { count: overdue })
              : t('homework.card.remaining', { count: remaining })}
          </span>
        ) : undefined
      }
      state={state}
      emptyTitle={t('homework.card.emptyTitle')}
      emptyDescription={t('homework.card.emptyDescription')}
      disabledTitle={t('chores.card.disabledTitle')}
      disabledDescription={t('chores.card.disabledDescription')}
      unavailableTitle={t('chores.card.unavailableTitle')}
      unavailableDescription={t('chores.card.unavailableDescription')}
      loadingLabel={t('chores.card.loading')}
      settingsLabel={t('homework.card.openSettings')}
      onOpenSettings={onOpenSettings}
      tintColor={tintColor}
      hasOverdue={overdue > 0}
    >
      <ul className="min-w-0">
        {visible.map((row) => (
          <ChoreWidgetRow
            key={row.definition.id}
            definition={row.definition}
            occurrence={row.occurrence}
            participantsById={participantsById}
            action={row.action}
            now={now}
            dense={dense}
            showPoints={false}
            trailing={
              row.occurrence ? undefined : (
                <span className={cn('shrink-0 text-[11px]', surface.textMuted)}>
                  {t('homework.card.notReady')}
                </span>
              )
            }
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
