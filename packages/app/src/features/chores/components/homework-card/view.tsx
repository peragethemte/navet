import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { cn } from '@navet/app/components/ui/utils';
import { type ThemeType, useI18n } from '@navet/app/hooks';
import type { ChoreDefinition, ChoreOccurrence, ChoreParticipant } from '@navet/core/chores';
import { GraduationCap } from 'lucide-react';
import { Fragment } from 'react';
import { localDateKey } from '../../chore-homework-selectors';
import { useChoreDayLabel } from '../../use-chore-day-label';
import type { ChoreCardAction } from '../chore-card';
import { ChoreWidgetCardShell, type ChoreWidgetCardState } from '../chore-widget-card-shell';
import { ChoreWidgetRow } from '../chore-widget-row';

export interface HomeworkCardRow {
  /** Needed only when the card groups rows by day. */
  dateKey?: string;
  definition: ChoreDefinition;
  occurrence?: ChoreOccurrence;
  action?: ChoreCardAction;
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
  days = 1,
  participantsById,
  now,
  remaining,
  tintColor,
  onOpenSettings,
}: {
  size: CardSize;
  theme: ThemeType;
  state: ChoreWidgetCardState;
  title: string;
  rows: HomeworkCardRow[];
  /** More than one groups the rows under a day heading. */
  days?: number;
  participantsById: Record<string, ChoreParticipant>;
  now: Date;
  remaining: number;
  tintColor?: string;
  onOpenSettings: () => void;
}) {
  const { t } = useI18n();
  const surface = getThemeSurfaceTokens(theme);
  const dense = size === 'small';
  const visible = rows.slice(0, homeworkRowsForSize(size));
  const hidden = rows.length - visible.length;
  const dayLabel = useChoreDayLabel(localDateKey(now));

  return (
    <ChoreWidgetCardShell
      size={size}
      theme={theme}
      icon={GraduationCap}
      title={title}
      meta={
        state === 'ready' ? (
          <span className={cn('text-xs font-semibold tabular-nums', surface.textSecondary)}>
            {t('homework.card.remaining', { count: remaining })}
          </span>
        ) : undefined
      }
      state={state}
      emptyTitle={days > 1 ? t('homework.card.emptyTitleDays') : t('homework.card.emptyTitle')}
      emptyDescription={t('homework.card.emptyDescription')}
      disabledTitle={t('chores.card.disabledTitle')}
      disabledDescription={t('chores.card.disabledDescription')}
      unavailableTitle={t('chores.card.unavailableTitle')}
      unavailableDescription={t('chores.card.unavailableDescription')}
      loadingLabel={t('chores.card.loading')}
      settingsLabel={t('homework.card.openSettings')}
      onOpenSettings={onOpenSettings}
      tintColor={tintColor}
    >
      <ul className="min-w-0">
        {visible.map((row, index) => (
          <Fragment key={row.definition.id}>
            {days > 1 && row.dateKey && row.dateKey !== visible[index - 1]?.dateKey ? (
              <li
                className={cn(
                  'px-1 pt-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide first:pt-0',
                  surface.textMuted
                )}
              >
                {dayLabel(row.dateKey)}
              </li>
            ) : null}
            <ChoreWidgetRow
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
          </Fragment>
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
