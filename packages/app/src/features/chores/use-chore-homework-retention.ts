import { useEffect, useRef } from 'react';
import { getExpiredHomeworkDefinitions } from './chore-homework-selectors';
import { useChoreWorkspaceStore } from './chore-workspace-store';

/** Deletes are one command each, so a pass stays small and catches up over sessions. */
const HOMEWORK_SWEEP_BUDGET = 10;

/**
 * Homework definitions are one-off, so they accumulate where recurring chores do not. Occurrences
 * are pruned by the authority but definitions are not, so the client sweeps its own expired
 * homework. The sweep stays silent: a household that never unlocks management simply keeps them.
 */
export function useChoreHomeworkRetention(
  enabled: boolean,
  managerActorId: string | undefined
): void {
  const status = useChoreWorkspaceStore((state) => state.status);
  const managementPinConfigured = useChoreWorkspaceStore((state) => state.managementPinConfigured);
  const managementUnlocked = useChoreWorkspaceStore((state) => state.managementUnlocked);
  const lastSweepDayRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !managerActorId || status !== 'ready') return;
    // definition_delete needs the management session once a PIN exists; sweeping without it
    // would relock management and show an error to someone who did nothing.
    if (managementPinConfigured && !managementUnlocked) return;
    if (!useChoreWorkspaceStore.getState().data) return;

    const today = new Date().toDateString();
    if (lastSweepDayRef.current === today) return;
    lastSweepDayRef.current = today;

    let cancelled = false;
    const sweep = async () => {
      const data = useChoreWorkspaceStore.getState().data;
      if (!data) return;
      const expired = getExpiredHomeworkDefinitions(data).slice(0, HOMEWORK_SWEEP_BUDGET);
      for (const definition of expired) {
        if (cancelled) return;
        const current = useChoreWorkspaceStore.getState();
        if (!current.data?.definitionsById[definition.id]) continue;
        const deleted = await current.execute({
          type: 'definition_delete',
          actorParticipantId: managerActorId,
          definitionId: definition.id,
        });
        // One failure usually means every following delete fails too; stop rather than
        // firing a reload-and-retry per command.
        if (!deleted) return;
      }
    };

    void sweep();
    return () => {
      cancelled = true;
    };
  }, [enabled, managerActorId, status, managementPinConfigured, managementUnlocked]);
}
