import { useSettingsStore } from '@navet/app/stores/settings-store';
import { subscribeVisibilityAwareTask } from '@navet/app/utils/visibility-aware-scheduler';
import { resolveTransitBoard, type TransitJourneyOccurrence } from '@navet/core/transit-journey';
import { useEffect, useMemo, useRef, useState } from 'react';
import { planJourney, TransitRequestError } from './entur-client';
import type { TransitDeparture } from './entur-trip';

/** Keeps the countdown honest and moves the board on when a journey's window opens or closes. */
const CLOCK_TICK_MS = 30 * 1000;
const REFRESH_INTERVAL_MS = 60 * 1000;

export type TransitErrorKey = 'transit.error.unavailable' | 'transit.error.unauthenticated';

export interface TransitJourneyBoard extends TransitJourneyOccurrence {
  departures: TransitDeparture[];
  isLoading: boolean;
  errorKey: TransitErrorKey | null;
}

interface JourneyResult {
  departures: TransitDeparture[];
  errorKey: TransitErrorKey | null;
}

function occurrenceKey(occurrences: TransitJourneyOccurrence[]): string {
  // The search time carries the identity: it rolls with the clock on a depart-after journey, which
  // is exactly when the board has to ask again.
  return occurrences
    .map((entry) => `${entry.journey.id}@${entry.searchTime.toISOString()}`)
    .join('|');
}

export function useTransitDepartures(alternatives: number) {
  const journeys = useSettingsStore((state) => state.transitJourneys);
  const [now, setNow] = useState(() => new Date());
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [results, setResults] = useState<Record<string, JourneyResult>>({});
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(
    () =>
      subscribeVisibilityAwareTask(
        () => setRefreshNonce((value) => value + 1),
        REFRESH_INTERVAL_MS
      ),
    []
  );

  const occurrences = useMemo(() => resolveTransitBoard(journeys, now), [journeys, now]);
  const key = occurrenceKey(occurrences);

  useEffect(() => {
    if (occurrences.length === 0) {
      // Guarded so an empty board does not re-render the card on every refresh tick.
      setResults((current) => (Object.keys(current).length === 0 ? current : {}));
      setLoadingIds((current) => (current.length === 0 ? current : []));
      return;
    }

    const controller = new AbortController();
    const pending = occurrences.filter((entry) => !resultsRef.current[entry.journey.id]);
    setLoadingIds(pending.map((entry) => entry.journey.id));

    void Promise.all(
      occurrences.map(async (entry) => {
        try {
          const departures = await planJourney(entry.journey, entry.searchTime, alternatives, {
            signal: controller.signal,
          });
          return [entry.journey.id, { departures, errorKey: null }] as const;
        } catch (error) {
          if (controller.signal.aborted) {
            return null;
          }
          const errorKey: TransitErrorKey =
            error instanceof TransitRequestError && error.status === 401
              ? 'transit.error.unauthenticated'
              : 'transit.error.unavailable';
          return [
            entry.journey.id,
            { departures: resultsRef.current[entry.journey.id]?.departures ?? [], errorKey },
          ] as const;
        }
      })
    ).then((entries) => {
      if (controller.signal.aborted) {
        return;
      }
      const next: Record<string, JourneyResult> = {};
      for (const entry of entries) {
        if (entry) {
          next[entry[0]] = entry[1];
        }
      }
      setResults(next);
      setLoadingIds([]);
    });

    return () => controller.abort();
    // `key` collapses the occurrence list to the identity that actually changes a request.
  }, [key, alternatives, refreshNonce]);

  const board: TransitJourneyBoard[] = useMemo(
    () =>
      occurrences.map((entry) => ({
        ...entry,
        departures: results[entry.journey.id]?.departures ?? [],
        errorKey: results[entry.journey.id]?.errorKey ?? null,
        isLoading: loadingIds.includes(entry.journey.id),
      })),
    [occurrences, results, loadingIds]
  );

  return { board, now, hasJourneys: journeys.length > 0 };
}
