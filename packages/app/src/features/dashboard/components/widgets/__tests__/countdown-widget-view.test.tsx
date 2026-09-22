import { renderWithProviders } from '@navet/app/test/render';
import { parseCountdownTarget } from '@navet/core/countdown';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CountdownWidgetView } from '../countdown-widget-view';

function localDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const wholeDayTarget = parseCountdownTarget({ date: '2027-06-20' });
const timedTarget = parseCountdownTarget({
  date: '2027-06-20',
  time: '09:30',
  precision: 'datetime',
});

describe('CountdownWidgetView', () => {
  it('asks for a date before a target is set', () => {
    const onOpenSettings = vi.fn();
    renderWithProviders(
      <CountdownWidgetView
        size="medium"
        now={localDate(2027, 6, 1)}
        target={null}
        display="days"
        canConfigure
        onOpenSettings={onOpenSettings}
      />
    );

    expect(screen.getByText('Choose a date to start counting')).toBeInTheDocument();
  });

  it('shows whole days and the title in the days display', () => {
    renderWithProviders(
      <CountdownWidgetView
        size="medium"
        now={localDate(2027, 6, 17, 6)}
        title="Summer holiday"
        target={wholeDayTarget}
        display="days"
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('days')).toBeInTheDocument();
    expect(screen.getByText('Summer holiday')).toBeInTheDocument();
  });

  it('uses the singular unit with one day left', () => {
    renderWithProviders(
      <CountdownWidgetView
        size="medium"
        now={localDate(2027, 6, 19, 23)}
        target={wholeDayTarget}
        display="days"
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('day')).toBeInTheDocument();
  });

  it('breaks the remaining time into four labelled units on a roomy card', () => {
    renderWithProviders(
      <CountdownWidgetView
        size="large"
        now={localDate(2027, 6, 17, 8, 15)}
        target={timedTarget}
        display="full"
      />
    );

    expect(screen.getByText('hours')).toBeInTheDocument();
    expect(screen.getByText('min')).toBeInTheDocument();
    expect(screen.getByText('sec')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('collapses the breakdown to a clock line on a compact card', () => {
    renderWithProviders(
      <CountdownWidgetView
        size="small"
        now={localDate(2027, 6, 17, 8, 15)}
        target={timedTarget}
        display="full"
      />
    );

    expect(screen.getByText('01:15:00')).toBeInTheDocument();
    expect(screen.queryByText('min')).not.toBeInTheDocument();
  });

  it('says today for the rest of the day once the target is reached', () => {
    renderWithProviders(
      <CountdownWidgetView
        size="medium"
        now={localDate(2027, 6, 20, 18)}
        target={timedTarget}
        display="full"
      />
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders a built-in wallpaper behind the countdown', () => {
    const { container } = renderWithProviders(
      <CountdownWidgetView
        size="large"
        now={localDate(2027, 6, 17)}
        target={wholeDayTarget}
        display="days"
        background="builtin:nocturne-01"
      />
    );

    expect(container.querySelector('picture')).not.toBeNull();
  });

  it('drops an unsafe background instead of rendering it', () => {
    const { container } = renderWithProviders(
      <CountdownWidgetView
        size="large"
        now={localDate(2027, 6, 17)}
        target={wholeDayTarget}
        display="days"
        background="javascript:alert(1)"
      />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
