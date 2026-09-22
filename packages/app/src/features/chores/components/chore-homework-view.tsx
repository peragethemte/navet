import { NavigationWorkspace } from '@navet/app/components/patterns';
import { Badge, Button, Checkbox, IconButton, Input } from '@navet/app/components/primitives';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import {
  getThemeFocusRingClassName,
  navetIconSizeTokens,
  navetTypographyTokens,
} from '@navet/app/components/system/tokens';
import { cn } from '@navet/app/components/ui/utils';
import { useI18n, useMediaQuery, useTheme } from '@navet/app/hooks';
import type { ChoreParticipant, ChoreWorkspaceData } from '@navet/core/chores';
import { getChoreTiming } from '@navet/core/chores';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  getHomeworkBoard,
  type HomeworkBoardEntry,
  localDateKey,
} from '../chore-homework-selectors';
import { useChoreClock } from '../use-chore-clock';
import { ParticipantAvatar } from './chore-today-view';

export interface HomeworkEntryDraft {
  participantId: string;
  dateKey: string;
  title: string;
}

function TitleField({
  defaultValue,
  label,
  onCancel,
  onSubmit,
  keepOpen,
}: {
  defaultValue?: string;
  label: string;
  onCancel: () => void;
  onSubmit: (title: string) => Promise<boolean>;
  keepOpen?: boolean;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const cancelLabel = t('common.cancel');
  const [value, setValue] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    const saved = await onSubmit(title);
    setBusy(false);
    if (!saved) return;
    if (keepOpen) {
      setValue('');
      return;
    }
    onCancel();
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Input
        // The row is replaced in place by an explicit activation, so focus belongs here.
        autoFocus
        size="small"
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (!value.trim()) onCancel();
        }}
        containerClassName="min-w-0 flex-1"
      />
      <IconButton
        size="compact"
        variant="ghost"
        label={label}
        icon={<Check className={navetIconSizeTokens.sm} />}
        disabled={busy || !value.trim()}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => void submit()}
        className={getThemeFocusRingClassName(theme)}
      />
      <IconButton
        size="compact"
        variant="ghost"
        label={cancelLabel}
        icon={<X className={navetIconSizeTokens.sm} />}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCancel}
        className={getThemeFocusRingClassName(theme)}
      />
    </div>
  );
}

function HomeworkEntryRow({
  entry,
  now,
  canManage,
  onRename,
  onRemove,
  onComplete,
}: {
  entry: HomeworkBoardEntry;
  now: Date;
  canManage: boolean;
  onRename: (title: string) => Promise<boolean>;
  onRemove: () => void;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const surface = getThemeSurfaceTokens(theme);
  const [editing, setEditing] = useState(false);
  const { definition, occurrence } = entry;
  const done = occurrence?.status === 'done';
  const overdue =
    occurrence !== undefined && !done && getChoreTiming(occurrence, now) === 'overdue';

  return (
    <li className="flex min-h-9 items-center gap-2 py-1">
      <Checkbox
        checked={done}
        disabled={done || !occurrence}
        aria-label={definition.title}
        onCheckedChange={(checked) => {
          if (checked === true) onComplete();
        }}
      />
      {editing ? (
        <TitleField
          defaultValue={definition.title}
          label={t('household.homework.edit', { title: definition.title })}
          onCancel={() => setEditing(false)}
          onSubmit={onRename}
        />
      ) : (
        <>
          <button
            type="button"
            disabled={!canManage}
            aria-label={t('household.homework.edit', { title: definition.title })}
            onClick={() => setEditing(true)}
            className={cn(
              'min-w-0 flex-1 truncate rounded-lg px-1 py-1 text-left text-sm',
              done ? cn('line-through', surface.textMuted) : surface.textPrimary,
              canManage && surface.hoverBg,
              getThemeFocusRingClassName(theme)
            )}
          >
            {definition.title}
          </button>
          {done ? (
            <span className={cn('shrink-0 text-xs', surface.textMuted)}>
              {t('household.today.done')}
            </span>
          ) : overdue ? (
            <span className={cn('shrink-0 text-xs', surface.textSecondary)}>
              {t('household.today.overdue')}
            </span>
          ) : null}
          {canManage ? (
            <IconButton
              size="compact"
              variant="ghost"
              label={t('household.homework.remove', { title: definition.title })}
              icon={<Trash2 className={navetIconSizeTokens.sm} />}
              onClick={onRemove}
              className={cn('shrink-0', getThemeFocusRingClassName(theme))}
            />
          ) : null}
        </>
      )}
    </li>
  );
}

function HomeworkDayGroup({
  dateKey,
  label,
  secondaryLabel,
  accentColor,
  children,
  addRow,
  count,
}: {
  dateKey: string;
  label: string;
  secondaryLabel?: string;
  accentColor?: string;
  children: ReactNode;
  addRow: ReactNode;
  count: number;
}) {
  const { theme } = useTheme();
  const surface = getThemeSurfaceTokens(theme);
  const headingId = `homework-day-${dateKey}`;

  return (
    <section
      aria-labelledby={headingId}
      data-homework-day={dateKey}
      className={cn('rounded-[22px] border p-3 sm:p-4', surface.subtleBg, surface.borderStrong)}
      style={
        accentColor
          ? { borderColor: `${accentColor}42`, backgroundColor: `${accentColor}14` }
          : undefined
      }
    >
      <div className="mb-2 flex min-h-8 items-center gap-2">
        <h3 id={headingId} className={cn(navetTypographyTokens.titleSm, surface.textPrimary)}>
          {label}
        </h3>
        {secondaryLabel ? (
          <span className={cn('text-xs', surface.textMuted)}>{secondaryLabel}</span>
        ) : null}
        {count > 0 ? (
          <Badge size="small" tone="neutral" className="shrink-0">
            {count}
          </Badge>
        ) : null}
      </div>
      <ul className={cn('divide-y', surface.divider)}>{children}</ul>
      {addRow}
    </section>
  );
}

export function ChoreHomeworkView({
  data,
  participants,
  canManage,
  onAdd,
  onRename,
  onRemove,
  onComplete,
}: {
  data: ChoreWorkspaceData;
  participants: ChoreParticipant[];
  canManage: boolean;
  onAdd: (draft: HomeworkEntryDraft) => Promise<boolean>;
  onRename: (definitionId: string, title: string) => Promise<boolean>;
  onRemove: (definitionId: string) => void;
  onComplete: (occurrenceId: string, participantId: string) => void;
}) {
  const { t, locale } = useI18n();
  const { theme, accentColor } = useTheme();
  const surface = getThemeSurfaceTokens(theme);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const now = useChoreClock();
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    () => participants[0]?.id ?? ''
  );
  const [openAddDateKey, setOpenAddDateKey] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<{ text: string; seq: number } | null>(null);

  useEffect(() => {
    if (participants.some((participant) => participant.id === selectedParticipantId)) return;
    setSelectedParticipantId(participants[0]?.id ?? '');
  }, [participants, selectedParticipantId]);

  const selectedParticipant = participants.find(
    (participant) => participant.id === selectedParticipantId
  );
  const board = useMemo(
    () => getHomeworkBoard(data, { participantId: selectedParticipantId || undefined, now }),
    [data, selectedParticipantId, now]
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    [locale]
  );
  const todayKey = localDateKey(now);

  const formatDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return dateFormatter.format(new Date(year, month - 1, day));
  };

  const renderEntry = (entry: HomeworkBoardEntry) => (
    <HomeworkEntryRow
      key={entry.definition.id}
      entry={entry}
      now={now}
      canManage={canManage}
      onRename={(title) => onRename(entry.definition.id, title)}
      onRemove={() => onRemove(entry.definition.id)}
      onComplete={() => {
        if (entry.occurrence) onComplete(entry.occurrence.id, selectedParticipantId);
      }}
    />
  );

  const renderAddRow = (dateKey: string) => {
    const label = t('household.homework.addFor', {
      name: selectedParticipant?.displayName ?? '',
      date: formatDate(dateKey),
    });
    if (openAddDateKey === dateKey) {
      return (
        <div className="mt-1 flex items-center gap-2 pt-1">
          <TitleField
            keepOpen
            label={label}
            onCancel={() => setOpenAddDateKey(null)}
            onSubmit={async (title) => {
              const added = await onAdd({
                participantId: selectedParticipantId,
                dateKey,
                title,
              });
              if (added) {
                setSavedMessage((current) => ({
                  text: t('household.homework.saved'),
                  seq: (current?.seq ?? 0) + 1,
                }));
              }
              return added;
            }}
          />
        </div>
      );
    }
    return (
      <Button
        size="compact"
        variant="ghost"
        className={cn('mt-1 w-full justify-start', surface.textSecondary)}
        leading={<Plus className={navetIconSizeTokens.sm} />}
        aria-label={label}
        disabled={!canManage}
        onClick={() => setOpenAddDateKey(dateKey)}
      >
        {t('household.homework.add')}
      </Button>
    );
  };

  const personNav = (
    <nav
      aria-label={t('household.homework.person')}
      className={cn('flex gap-2 overflow-x-auto scrollbar-hide border-b px-3 py-3', surface.border)}
    >
      {participants.map((participant) => (
        <Button
          key={participant.id}
          size="compact"
          variant={participant.id === selectedParticipantId ? 'primary' : 'secondary'}
          className="shrink-0"
          leading={<ParticipantAvatar participant={participant} className="h-6 w-6" />}
          aria-current={participant.id === selectedParticipantId ? 'true' : undefined}
          onClick={() => setSelectedParticipantId(participant.id)}
        >
          {participant.displayName}
        </Button>
      ))}
    </nav>
  );

  return (
    <NavigationWorkspace.Frame
      aria-label={t('household.tabs.homework')}
      className="mx-auto h-[min(72dvh,46rem)] min-h-[34rem] max-w-6xl"
      data-homework-workspace
    >
      <NavigationWorkspace.Body className={isMobile ? '' : 'grid-cols-[16rem_minmax(0,1fr)]'}>
        {isMobile ? null : (
          <NavigationWorkspace.Sidebar>
            <nav aria-label={t('household.homework.person')} className="grid gap-1 px-3 py-4">
              {participants.map((participant) => (
                <NavigationWorkspace.Item
                  key={participant.id}
                  active={participant.id === selectedParticipantId}
                  accentColor={participant.color ?? accentColor}
                >
                  <NavigationWorkspace.ItemButton
                    aria-current={participant.id === selectedParticipantId ? 'page' : undefined}
                    onClick={() => setSelectedParticipantId(participant.id)}
                  >
                    <NavigationWorkspace.ItemIcon className="border-0 bg-transparent p-0">
                      <ParticipantAvatar participant={participant} className="h-8 w-8" />
                    </NavigationWorkspace.ItemIcon>
                    <NavigationWorkspace.ItemText title={participant.displayName} />
                  </NavigationWorkspace.ItemButton>
                </NavigationWorkspace.Item>
              ))}
            </nav>
          </NavigationWorkspace.Sidebar>
        )}

        <NavigationWorkspace.Content aria-label={selectedParticipant?.displayName ?? ''}>
          {isMobile ? personNav : null}
          <NavigationWorkspace.ScrollArea>
            <span aria-live="polite" className="sr-only">
              {savedMessage ? <span key={savedMessage.seq}>{savedMessage.text}</span> : null}
            </span>
            <div className="grid gap-3 p-3 sm:p-4 lg:landscape:grid-cols-2 lg:landscape:gap-4 xl:grid-cols-2 xl:gap-4">
              {board.overdue.length > 0 ? (
                <HomeworkDayGroup
                  dateKey="overdue"
                  label={t('household.today.overdue')}
                  count={board.overdue.length}
                  addRow={null}
                >
                  {board.overdue.map(renderEntry)}
                </HomeworkDayGroup>
              ) : null}
              {board.days.map((day, index) => (
                <HomeworkDayGroup
                  key={day.dateKey}
                  dateKey={day.dateKey}
                  label={
                    index === 0
                      ? t('household.homework.today')
                      : index === 1
                        ? t('household.homework.tomorrow')
                        : formatDate(day.dateKey)
                  }
                  secondaryLabel={index < 2 ? formatDate(day.dateKey) : undefined}
                  accentColor={day.dateKey === todayKey ? accentColor : undefined}
                  count={day.entries.length}
                  addRow={renderAddRow(day.dateKey)}
                >
                  {day.entries.map(renderEntry)}
                </HomeworkDayGroup>
              ))}
            </div>
          </NavigationWorkspace.ScrollArea>
        </NavigationWorkspace.Content>
      </NavigationWorkspace.Body>
    </NavigationWorkspace.Frame>
  );
}
