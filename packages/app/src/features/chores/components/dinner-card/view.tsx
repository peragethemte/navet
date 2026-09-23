import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { cn } from '@navet/app/components/ui/utils';
import { type ThemeType, useI18n } from '@navet/app/hooks';
import { sanitizeImageUrl } from '@navet/app/utils/url-security';
import type { ChoreDefinition } from '@navet/core/chores';
import { UtensilsCrossed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { localDateKey } from '../../chore-homework-selectors';
import { useChoreDayLabel } from '../../use-chore-day-label';
import { ChoreWidgetCardShell, type ChoreWidgetCardState } from '../chore-widget-card-shell';

export interface DinnerCardRow {
  dateKey: string;
  dinner: ChoreDefinition;
}

/** Rows below the hero that stay readable at a glance for each size. */
export function dinnerRowsForSize(size: CardSize): number {
  if (size === 'small') return 0;
  return size === 'medium' ? 2 : 5;
}

/** A dinner image, or the dinner icon on `fallbackClassName` when there is none or it fails. */
export function DinnerImage({
  url,
  className,
  fallbackClassName,
  iconClassName,
}: {
  url?: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
}) {
  const safeUrl = sanitizeImageUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [safeUrl]);

  if (!safeUrl || failed) {
    return (
      <div className={cn('flex items-center justify-center', className, fallbackClassName)}>
        <UtensilsCrossed aria-hidden="true" className={cn('opacity-60', iconClassName)} />
      </div>
    );
  }
  return (
    <img
      src={safeUrl}
      alt=""
      loading="lazy"
      // Recipe sites commonly block hotlinks by referrer.
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

export function DinnerCardView({
  size,
  theme,
  state,
  title,
  rows,
  now,
  tintColor,
  onOpenSettings,
}: {
  size: CardSize;
  theme: ThemeType;
  state: ChoreWidgetCardState;
  title: string;
  rows: DinnerCardRow[];
  now: Date;
  tintColor?: string;
  onOpenSettings: () => void;
}) {
  const { t } = useI18n();
  const surface = getThemeSurfaceTokens(theme);
  const todayKey = localDateKey(now);
  const dayLabel = useChoreDayLabel(todayKey);
  const [first, ...rest] = rows;
  const hero = first?.dateKey === todayKey ? first : undefined;
  const listed = (hero ? rest : rows).slice(
    0,
    hero ? dinnerRowsForSize(size) : dinnerRowsForSize(size) + 1
  );
  const hidden = rows.length - listed.length - (hero ? 1 : 0);

  return (
    <ChoreWidgetCardShell
      size={size}
      theme={theme}
      icon={UtensilsCrossed}
      title={title}
      state={state}
      emptyTitle={t('dinner.card.emptyTitle')}
      emptyDescription={t('dinner.card.emptyDescription')}
      disabledTitle={t('chores.card.disabledTitle')}
      disabledDescription={t('chores.card.disabledDescription')}
      unavailableTitle={t('chores.card.unavailableTitle')}
      unavailableDescription={t('chores.card.unavailableDescription')}
      loadingLabel={t('chores.card.loading')}
      settingsLabel={t('dinner.card.openSettings')}
      onOpenSettings={onOpenSettings}
      tintColor={tintColor}
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        {hero ? (
          <figure
            className={cn(
              'relative min-h-[5.5rem] flex-1 overflow-hidden rounded-2xl',
              surface.textPrimary
            )}
          >
            <DinnerImage
              url={hero.dinner.imageUrl}
              className="absolute inset-0 h-full w-full"
              fallbackClassName={surface.subtleBg}
              iconClassName="h-10 w-10"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-6 pb-2 text-white">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/80">
                {dayLabel(hero.dateKey)}
              </span>
              <span className="line-clamp-2 text-base font-semibold leading-tight">
                {hero.dinner.title}
              </span>
            </figcaption>
          </figure>
        ) : null}
        {listed.length > 0 ? (
          <ul className="grid shrink-0 gap-1.5">
            {listed.map((row) => (
              <li key={row.dinner.id} className="flex min-w-0 items-center gap-2.5">
                <DinnerImage
                  url={row.dinner.imageUrl}
                  className={cn('h-9 w-9 shrink-0 rounded-lg', surface.textPrimary)}
                  fallbackClassName={surface.subtleBg}
                  iconClassName="h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <span className={cn('block text-[11px] font-semibold', surface.textMuted)}>
                    {dayLabel(row.dateKey)}
                  </span>
                  <span className={cn('block truncate text-sm', surface.textPrimary)}>
                    {row.dinner.title}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {hidden > 0 ? (
          <p className={cn('shrink-0 px-1 text-[11px]', surface.textMuted)}>
            {t('chores.card.more', { count: hidden })}
          </p>
        ) : null}
      </div>
    </ChoreWidgetCardShell>
  );
}
