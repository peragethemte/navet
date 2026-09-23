import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { cn } from '@navet/app/components/ui/utils';
import { type ThemeType, useI18n } from '@navet/app/hooks';
import type { ChoreParticipant } from '@navet/core/chores';
import { UserRound } from 'lucide-react';
import { ChoreWidgetCardShell, type ChoreWidgetCardState } from '../chore-widget-card-shell';
import { ChoreWidgetRow } from '../chore-widget-row';
import type { ChoresCardRow } from '../chores-card/view';
import type { HomeworkCardRow } from '../homework-card/view';

/** How many rows in total stay readable at a glance for each supported size. */
export function personRowsForSize(size: CardSize): number {
  if (size === 'small') return 3;
  return size === 'medium' ? 6 : 11;
}

/**
 * Splits the row budget so neither half starves: each side is guaranteed about half, and whatever
 * the shorter half leaves unused goes to the other one.
 */
export function splitPersonRowBudget(choreCount: number, homeworkCount: number, budget: number) {
  const chores = Math.min(choreCount, Math.max(Math.ceil(budget / 2), budget - homeworkCount));
  return { chores, homework: Math.min(homeworkCount, Math.max(0, budget - chores)) };
}

function PersonCardSection({
  label,
  theme,
  first,
  children,
}: {
  label: string;
  theme: ThemeType;
  first: boolean;
  children: React.ReactNode;
}) {
  const surface = getThemeSurfaceTokens(theme);
  return (
    <section
      className={cn('min-w-0', first ? null : cn('mt-1.5 border-t pt-1.5', surface.dividerBorder))}
    >
      <h4
        className={cn(
          'px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide',
          surface.textMuted
        )}
      >
        {label}
      </h4>
      <ul className="min-w-0">{children}</ul>
    </section>
  );
}

export function PersonCardView({
  size,
  theme,
  state,
  title,
  choreRows,
  homeworkRows,
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
  choreRows: ChoresCardRow[];
  homeworkRows: HomeworkCardRow[];
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
  const budget = splitPersonRowBudget(
    choreRows.length,
    homeworkRows.length,
    personRowsForSize(size)
  );
  const visibleChores = choreRows.slice(0, budget.chores);
  const visibleHomework = homeworkRows.slice(0, budget.homework);
  const hidden =
    choreRows.length + homeworkRows.length - visibleChores.length - visibleHomework.length;

  return (
    <ChoreWidgetCardShell
      size={size}
      theme={theme}
      icon={UserRound}
      title={title}
      meta={
        state === 'ready' ? (
          <span className={cn('text-xs font-semibold tabular-nums', surface.textSecondary)}>
            {t('chores.card.remaining', { count: remaining })}
          </span>
        ) : undefined
      }
      state={state}
      emptyTitle={t('household.personCard.emptyTitle')}
      emptyDescription={t('household.personCard.emptyDescription')}
      disabledTitle={t('chores.card.disabledTitle')}
      disabledDescription={t('chores.card.disabledDescription')}
      unavailableTitle={t('chores.card.unavailableTitle')}
      unavailableDescription={t('chores.card.unavailableDescription')}
      loadingLabel={t('chores.card.loading')}
      settingsLabel={t('household.personCard.openSettings')}
      onOpenSettings={onOpenSettings}
      tintColor={tintColor}
    >
      {visibleChores.length > 0 ? (
        <PersonCardSection label={t('chores.card.title')} theme={theme} first>
          {visibleChores.map((row) => (
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
        </PersonCardSection>
      ) : null}
      {visibleHomework.length > 0 ? (
        <PersonCardSection
          label={t('homework.card.title')}
          theme={theme}
          first={visibleChores.length === 0}
        >
          {visibleHomework.map((row) => (
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
        </PersonCardSection>
      ) : null}
      {hidden > 0 ? (
        <p className={cn('px-1 pt-1 text-[11px]', surface.textMuted)}>
          {t('chores.card.more', { count: hidden })}
        </p>
      ) : null}
    </ChoreWidgetCardShell>
  );
}
