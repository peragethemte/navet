import { settingsSelectors } from '@navet/app/stores/selectors';
import { useSettingsStore } from '@navet/app/stores/settings-store';
import type { ChoreParticipant } from '@navet/core/chores';
import { useMemo } from 'react';
import { useChoreWorkspaceStore } from './chore-workspace-store';
import { CHORE_CARD_EVERYONE } from './components/chore-card-person-dialog';
import type { ChoreWidgetCardState } from './components/chore-widget-card-shell';
import { useChoreClock } from './use-chore-clock';
import { useChoreMaterialization } from './use-chore-materialization';
import { useChoreWorkspaceSync } from './use-chore-workspace-sync';

/**
 * The workspace wiring every household dashboard card needs: the synced workspace, the shared
 * clock, the selectable people and the stored person resolved against them.
 */
export function useChoreCardParticipant(storedParticipantId: string | undefined) {
  const choresEnabled = useSettingsStore(settingsSelectors.choresEnabled);
  const workspace = useChoreWorkspaceStore((state) => state.data);
  const status = useChoreWorkspaceStore((state) => state.status);
  const execute = useChoreWorkspaceStore((state) => state.execute);
  const now = useChoreClock();

  useChoreWorkspaceSync(choresEnabled);
  useChoreMaterialization({ enabled: choresEnabled });

  const participants = useMemo<ChoreParticipant[]>(
    () =>
      workspace
        ? Object.values(workspace.participantsById).filter((participant) => !participant.pausedAt)
        : [],
    [workspace]
  );

  // A person can be removed or paused after the card was configured; fall back at render so the
  // stored choice comes back if they return.
  const participantId =
    storedParticipantId &&
    participants.some((participant) => participant.id === storedParticipantId)
      ? storedParticipantId
      : CHORE_CARD_EVERYONE;

  return { choresEnabled, workspace, status, execute, now, participants, participantId };
}

export function resolveChoreWidgetState({
  choresEnabled,
  status,
  hasWorkspace,
  hasRows,
}: {
  choresEnabled: boolean;
  status: string;
  hasWorkspace: boolean;
  hasRows: boolean;
}): ChoreWidgetCardState {
  if (!choresEnabled) return 'disabled';
  if (status === 'unavailable' || status === 'unauthorized' || status === 'error') {
    return 'unavailable';
  }
  if (!hasWorkspace) return 'loading';
  return hasRows ? 'ready' : 'empty';
}
