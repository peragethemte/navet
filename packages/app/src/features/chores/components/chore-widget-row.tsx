import { EntityCardHeaderIcon } from '@navet/app/components/primitives/entity-card-header-icon';
import { getCardReadableTextTokens } from '@navet/app/components/shared/theme/card-readable-text-tokens';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { cn } from '@navet/app/components/ui/utils';
import { useI18n, useTheme } from '@navet/app/hooks';
import type { ChorePresentationMetadata } from '@navet/core/chore-experience';
import type { ChoreDefinition, ChoreOccurrence, ChoreParticipant } from '@navet/core/chores';
import type { ReactNode } from 'react';
import { getChorePaletteKey, resolveChoreColorPalette } from '../chore-color-palette';
import {
  ChoreActionControl,
  ChoreAssigneeAvatar,
  type ChoreCardAction,
  getChoreStatusDetails,
} from './chore-card';
import { resolveChoreIconComponent } from './chore-icon';
import { ChorePointsToken } from './chore-points-token';

const STATUS_TONE: Record<string, 'red' | 'yellow' | 'green' | 'purple' | 'primary'> = {
  danger: 'red',
  warning: 'yellow',
  success: 'green',
  accent: 'purple',
  neutral: 'primary',
};

/**
 * One item inside a dashboard chores or homework card. It carries the Household card's colour,
 * icon and avatar language at row density; the full composition stays in `ChoreFocusCard`.
 * Late work is never flagged here: the dashboard shows today, not a backlog.
 */
export function ChoreWidgetRow({
  definition,
  occurrence,
  participantsById,
  presentation,
  action,
  now,
  dense = false,
  showPoints = true,
  childMode = false,
  trailing,
}: {
  definition: ChoreDefinition;
  occurrence?: ChoreOccurrence;
  participantsById: Record<string, ChoreParticipant>;
  presentation?: ChorePresentationMetadata;
  action?: ChoreCardAction;
  now: Date;
  /** Small cards drop the second line and the points token. */
  dense?: boolean;
  showPoints?: boolean;
  childMode?: boolean;
  /** Replaces the action control, for rows that cannot be acted on yet. */
  trailing?: ReactNode;
}) {
  const i18n = useI18n();
  const { theme } = useTheme();
  const surface = getThemeSurfaceTokens(theme);
  const status = occurrence
    ? getChoreStatusDetails(occurrence, now, i18n, { flagLate: false })
    : undefined;
  const done = occurrence?.status === 'done';
  const palette = resolveChoreColorPalette(getChorePaletteKey(definition), presentation?.color);
  const baseColor = done ? undefined : palette.primary;
  const ChoreIcon = resolveChoreIconComponent(presentation?.icon ?? definition.icon);
  const title = childMode && presentation?.childTitle ? presentation.childTitle : definition.title;
  const assignee =
    participantsById[occurrence?.assigneeIds[0] ?? definition.assignment.participantIds[0] ?? ''];
  const statusColor =
    status && status.tone !== 'neutral'
      ? getCardReadableTextTokens({
          theme,
          tone: STATUS_TONE[status.tone] ?? 'primary',
          baseColor: palette.primary,
        }).titleColor
      : undefined;

  return (
    <li
      className={cn('flex min-h-9 min-w-0 items-center gap-2 py-1', done && 'opacity-60')}
      data-chore-widget-row="true"
    >
      <EntityCardHeaderIcon
        IconComponent={ChoreIcon}
        isActive={!done}
        size="extra-small"
        tone={status?.tone === 'danger' ? 'red' : status?.tone === 'warning' ? 'amber' : 'primary'}
        baseColor={baseColor}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-xs font-semibold leading-4',
            done ? cn('line-through', surface.textMuted) : surface.textPrimary
          )}
        >
          {title}
        </p>
        {dense || !status ? null : (
          <p className={cn('truncate text-[11px] leading-[14px]', surface.textSecondary)}>
            <span style={{ color: statusColor }}>{status.label}</span>
            {assignee ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>{assignee.displayName}</span>
              </>
            ) : null}
          </p>
        )}
      </div>
      {!dense && showPoints && !done && presentation?.points ? (
        <ChorePointsToken points={presentation.points} color={palette.primary} />
      ) : null}
      <ChoreAssigneeAvatar participant={assignee} />
      {trailing ??
        (action ? (
          <ChoreActionControl action={action} participantsById={participantsById} compact />
        ) : null)}
    </li>
  );
}
