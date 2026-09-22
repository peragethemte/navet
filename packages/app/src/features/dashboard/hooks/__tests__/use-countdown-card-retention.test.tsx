import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomCard } from '../../stores/custom-cards-store';
import { useCountdownCardRetention } from '../use-countdown-card-retention';

function countdownCard(id: string, data: Record<string, unknown>): CustomCard {
  return { id, type: 'countdown', size: 'medium', room: 'Kitchen', data, createdAt: 0 };
}

function renderSweep(cards: CustomCard[], enabled = true) {
  const onExpired = vi.fn();
  renderHook(() => useCountdownCardRetention({ enabled, cards, onExpired }));
  return onExpired;
}

describe('useCountdownCardRetention', () => {
  it('removes a countdown whose day is over', () => {
    const onExpired = renderSweep([countdownCard('expired', { targetDate: '2020-01-01' })]);

    expect(onExpired).toHaveBeenCalledWith('expired');
  });

  it('keeps a countdown that is still running', () => {
    const onExpired = renderSweep([countdownCard('upcoming', { targetDate: '2099-01-01' })]);

    expect(onExpired).not.toHaveBeenCalled();
  });

  it('keeps a countdown with no target, so a freshly added card survives', () => {
    const onExpired = renderSweep([countdownCard('unset', {})]);

    expect(onExpired).not.toHaveBeenCalled();
  });

  it('honours an opted-out card', () => {
    const onExpired = renderSweep([
      countdownCard('kept', { targetDate: '2020-01-01', removeWhenFinished: false }),
    ]);

    expect(onExpired).not.toHaveBeenCalled();
  });

  it('leaves other card types alone', () => {
    const onExpired = renderSweep([
      { id: 'note', type: 'note', size: 'medium', room: 'Kitchen', createdAt: 0 },
    ]);

    expect(onExpired).not.toHaveBeenCalled();
  });

  it('sweeps once across renders that hand it a fresh card list', () => {
    // A rerender-per-sweep would resubscribe the shared timer and re-run on every dashboard render.
    const onExpired = vi.fn();
    const card = countdownCard('expired', { targetDate: '2020-01-01' });
    const { rerender } = renderHook(
      ({ cards }) => useCountdownCardRetention({ enabled: true, cards, onExpired }),
      { initialProps: { cards: [card] } }
    );

    rerender({ cards: [{ ...card }] });
    rerender({ cards: [{ ...card }] });

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the dashboard is in edit mode', () => {
    const onExpired = renderSweep([countdownCard('expired', { targetDate: '2020-01-01' })], false);

    expect(onExpired).not.toHaveBeenCalled();
  });
});
