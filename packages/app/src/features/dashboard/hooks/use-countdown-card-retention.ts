import { subscribeVisibilityAwareTask } from '@navet/app/utils/visibility-aware-scheduler';
import { isCountdownExpired } from '@navet/core/countdown';
import { useEffect, useRef } from 'react';
import {
  type CountdownCardData,
  resolveCountdownTargetFromData,
  shouldRemoveFinishedCountdown,
} from '../components/widgets/countdown-widget-data';
import type { CustomCard } from '../stores/custom-cards-store';

const SWEEP_INTERVAL_MS = 60 * 1000;

export interface CountdownCardRetentionParams {
  /** Off in edit mode: a card vanishing under someone rearranging the screen is worse than a stale day. */
  enabled: boolean;
  cards: CustomCard[];
  onExpired: (cardId: string) => void;
}

/**
 * A countdown has nothing left to say once its day is over, so the card clears itself instead of
 * sitting on the dashboard as a stale number. Cards on a dashboard that is not open are swept the
 * next time that dashboard is shown.
 *
 * The card list and the callback are read through refs. Both change identity on ordinary dashboard
 * renders, and resubscribing the shared timer that often would sweep on every render instead of
 * once a minute.
 */
export function useCountdownCardRetention({
  enabled,
  cards,
  onExpired,
}: CountdownCardRetentionParams): void {
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const sweep = () => {
      const now = new Date();

      for (const card of cardsRef.current) {
        if (card.type !== 'countdown') {
          continue;
        }

        const data = card.data as CountdownCardData | undefined;
        if (!shouldRemoveFinishedCountdown(data)) {
          continue;
        }

        const target = resolveCountdownTargetFromData(data);
        if (target && isCountdownExpired(target, now)) {
          onExpiredRef.current(card.id);
        }
      }
    };

    sweep();
    return subscribeVisibilityAwareTask(sweep, SWEEP_INTERVAL_MS);
  }, [enabled]);
}
