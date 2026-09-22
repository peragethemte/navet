import {
  type CountdownDisplay,
  type CountdownPrecision,
  type CountdownTarget,
  parseCountdownTarget,
} from '@navet/core/countdown';

/** Stored on `card.data` for a `countdown` card. */
export interface CountdownCardData {
  title?: string;
  targetDate?: string;
  targetTime?: string;
  precision?: CountdownPrecision;
  display?: CountdownDisplay;
  /** A `builtin:` wallpaper token or an http(s) image address. */
  background?: string;
  tintColor?: string;
  removeWhenFinished?: boolean;
}

export const COUNTDOWN_TITLE_MAX_LENGTH = 80;
export const COUNTDOWN_BACKGROUND_MAX_LENGTH = 2000;

/** Whole days is the calm default; the full breakdown is opt-in because it ticks every second. */
export function resolveCountdownDisplay(display: unknown): CountdownDisplay {
  return display === 'full' ? 'full' : 'days';
}

export function resolveCountdownTargetFromData(
  data: CountdownCardData | undefined
): CountdownTarget | null {
  return parseCountdownTarget({
    date: data?.targetDate,
    time: data?.targetTime,
    precision: data?.precision,
  });
}

/** Opt-out, not opt-in: a finished countdown has nothing left to say on a dashboard. */
export function shouldRemoveFinishedCountdown(data: CountdownCardData | undefined): boolean {
  return data?.removeWhenFinished !== false;
}
