import { Button, IconButton, Input } from '@navet/app/components/primitives';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import {
  getThemeFocusRingClassName,
  navetIconSizeTokens,
  navetTypographyTokens,
} from '@navet/app/components/system/tokens';
import { cn } from '@navet/app/components/ui/utils';
import { useI18n, useTheme } from '@navet/app/hooks';
import { sanitizeImageUrl } from '@navet/app/utils/url-security';
import type { ChoreDefinition, ChoreWorkspaceData } from '@navet/core/chores';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getDinnerBoard } from '../chore-dinner-selectors';
import { localDateKey } from '../chore-homework-selectors';
import { useChoreClock } from '../use-chore-clock';
import { DinnerImage } from './dinner-card/view';

export interface DinnerDraft {
  dateKey: string;
  title: string;
  imageUrl?: string;
}

function DinnerForm({
  dinner,
  label,
  onCancel,
  onSubmit,
}: {
  dinner?: ChoreDefinition;
  label: string;
  onCancel: () => void;
  onSubmit: (title: string, imageUrl: string | undefined) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(dinner?.title ?? '');
  const [imageUrl, setImageUrl] = useState(dinner?.imageUrl ?? '');
  const [busy, setBusy] = useState(false);
  const trimmedUrl = imageUrl.trim();
  const urlInvalid = trimmedUrl.length > 0 && !sanitizeImageUrl(trimmedUrl);

  const submit = async () => {
    if (!title.trim() || urlInvalid || busy) return;
    setBusy(true);
    const saved = await onSubmit(title.trim(), trimmedUrl || undefined);
    setBusy(false);
    if (saved) onCancel();
  };

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <Input
        // The form replaces the day's content by an explicit activation, so focus belongs here.
        autoFocus
        size="small"
        aria-label={label}
        placeholder={t('household.dinner.titlePlaceholder')}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={120}
      />
      <Input
        size="small"
        type="url"
        inputMode="url"
        aria-label={t('household.dinner.imageUrl')}
        placeholder={t('household.dinner.imageUrlPlaceholder')}
        value={imageUrl}
        invalid={urlInvalid}
        onChange={(event) => setImageUrl(event.target.value)}
        maxLength={2000}
      />
      {urlInvalid ? (
        <p className="text-xs text-red-500">{t('household.dinner.imageUrlInvalid')}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button size="compact" variant="ghost" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          size="compact"
          variant="primary"
          type="submit"
          disabled={busy || !title.trim() || urlInvalid}
        >
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

export function ChoreDinnerView({
  data,
  canManage,
  onSave,
  onRemove,
}: {
  data: ChoreWorkspaceData;
  canManage: boolean;
  onSave: (draft: DinnerDraft) => Promise<boolean>;
  onRemove: (definitionId: string) => void;
}) {
  const { t, locale } = useI18n();
  const { theme, accentColor } = useTheme();
  const surface = getThemeSurfaceTokens(theme);
  const focusRing = getThemeFocusRingClassName(theme);
  const now = useChoreClock();
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);
  const board = useMemo(() => getDinnerBoard(data, { now }), [data, now]);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
    [locale]
  );
  const todayKey = localDateKey(now);

  const formatDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return dateFormatter.format(new Date(year, month - 1, day));
  };

  return (
    <div
      className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 xl:grid-cols-3"
      data-dinner-workspace
    >
      {board.map(({ dateKey, dinner }, index) => {
        const label =
          index === 0
            ? t('household.homework.today')
            : index === 1
              ? t('household.homework.tomorrow')
              : formatDate(dateKey);
        const headingId = `dinner-day-${dateKey}`;
        return (
          <section
            key={dateKey}
            aria-labelledby={headingId}
            data-dinner-day={dateKey}
            className={cn(
              'rounded-[22px] border p-3 sm:p-4',
              surface.subtleBg,
              surface.borderStrong
            )}
            style={
              dateKey === todayKey
                ? { borderColor: `${accentColor}42`, backgroundColor: `${accentColor}14` }
                : undefined
            }
          >
            <div className="mb-2 flex min-h-8 items-center gap-2">
              <h3 id={headingId} className={cn(navetTypographyTokens.titleSm, surface.textPrimary)}>
                {label}
              </h3>
              {index < 2 ? (
                <span className={cn('text-xs', surface.textMuted)}>{formatDate(dateKey)}</span>
              ) : null}
            </div>
            {editingDateKey === dateKey ? (
              <DinnerForm
                dinner={dinner}
                label={t('household.dinner.setFor', { date: formatDate(dateKey) })}
                onCancel={() => setEditingDateKey(null)}
                onSubmit={(title, imageUrl) => onSave({ dateKey, title, imageUrl })}
              />
            ) : dinner ? (
              <div className="flex min-w-0 items-center gap-3">
                <DinnerImage
                  url={dinner.imageUrl}
                  className={cn('h-14 w-14 shrink-0 rounded-xl', surface.textPrimary)}
                  fallbackClassName={surface.subtleBg}
                  iconClassName={navetIconSizeTokens.md}
                />
                <p
                  className={cn('min-w-0 flex-1 truncate text-sm font-medium', surface.textPrimary)}
                >
                  {dinner.title}
                </p>
                {canManage ? (
                  <>
                    <IconButton
                      size="compact"
                      variant="ghost"
                      label={t('household.homework.edit', { title: dinner.title })}
                      icon={<Pencil className={navetIconSizeTokens.sm} />}
                      onClick={() => setEditingDateKey(dateKey)}
                      className={cn('shrink-0', focusRing)}
                    />
                    <IconButton
                      size="compact"
                      variant="ghost"
                      label={t('household.homework.remove', { title: dinner.title })}
                      icon={<Trash2 className={navetIconSizeTokens.sm} />}
                      onClick={() => onRemove(dinner.id)}
                      className={cn('shrink-0', focusRing)}
                    />
                  </>
                ) : null}
              </div>
            ) : (
              <Button
                size="compact"
                variant="ghost"
                className={cn('w-full justify-start', surface.textSecondary)}
                leading={<Plus className={navetIconSizeTokens.sm} />}
                aria-label={t('household.dinner.setFor', { date: formatDate(dateKey) })}
                disabled={!canManage}
                onClick={() => setEditingDateKey(dateKey)}
              >
                {t('household.dinner.add')}
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
