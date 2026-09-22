import { isHomeAssistantPanelMode } from '@navet/app/runtime/app-mode';
import {
  type ChoreRuntimeCapabilities,
  getChoreWorkspaceTransport,
} from '@navet/app/services/chore-workspace.service';
import { useEffect, useState } from 'react';
import { getChoreMaterializationRange, materializeChoreWorkspace } from './chore-workspace-model';
import { useChoreWorkspaceStore } from './chore-workspace-store';

/**
 * Keeps today's occurrences materialized when the storage authority does not schedule in the
 * background. Only the Home Assistant add-on runs a periodic scheduler, so without this a surface
 * that never opens Household shows an empty day after midnight.
 *
 * Safe to mount from several components at once: occurrence IDs are deterministic, the write is a
 * compare-and-swap, and `materializeChoreWorkspace` reports whether anything is missing first.
 */
export function useChoreMaterialization({
  enabled = true,
  paused = false,
}: {
  enabled?: boolean;
  paused?: boolean;
} = {}) {
  const data = useChoreWorkspaceStore((state) => state.data);
  const status = useChoreWorkspaceStore((state) => state.status);
  const execute = useChoreWorkspaceStore((state) => state.execute);
  const [runtimeCapabilities, setRuntimeCapabilities] = useState<ChoreRuntimeCapabilities | null>(
    null
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getChoreWorkspaceTransport()
      .loadCapabilities()
      .then((capabilities) => {
        if (active) setRuntimeCapabilities(capabilities);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const authoritySchedules =
    isHomeAssistantPanelMode() || runtimeCapabilities?.backgroundScheduling === true;

  useEffect(() => {
    if (
      !enabled ||
      paused ||
      authoritySchedules ||
      status !== 'ready' ||
      !data ||
      Object.keys(data.definitionsById).length === 0
    ) {
      return;
    }
    if (!materializeChoreWorkspace(data).changed) return;
    void execute({ type: 'materialize_occurrences', ...getChoreMaterializationRange() });
  }, [authoritySchedules, data, enabled, execute, paused, status]);

  return { runtimeCapabilities, authoritySchedules };
}
