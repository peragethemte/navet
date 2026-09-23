import { useI18n } from '@navet/app/hooks';
import { addCalendarDays } from '@navet/core/chore-calendar-policy';
import { useCallback, useMemo } from 'react';

/** "Today", "Tomorrow", then the short weekday, for cards that list a few days ahead. */
export function useChoreDayLabel(todayKey: string) {
  const { t, locale } = useI18n();
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long' }), [locale]);
  return useCallback(
    (dateKey: string) => {
      if (dateKey === todayKey) return t('household.homework.today');
      if (dateKey === addCalendarDays(todayKey, 1)) return t('household.homework.tomorrow');
      const [year, month, day] = dateKey.split('-').map(Number);
      return weekday.format(new Date(year, month - 1, day));
    },
    [t, todayKey, weekday]
  );
}
