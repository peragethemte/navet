import type { ThemeType } from '@navet/app/hooks';

// Mirrors textPrimary/textSecondary in theme-surface-tokens as colour values, since the calendar
// passes text colours as inline styles. The contrast-derived neutral tokens land on slate grey.
const UNTINTED_TEXT_COLORS: Record<ThemeType, { primary: string; secondary: string }> = {
  light: { primary: '#020617', secondary: '#334155' },
  dark: { primary: '#ffffff', secondary: '#d1d5db' },
  black: { primary: '#ffffff', secondary: '#d1d5db' },
  glass: { primary: '#ffffff', secondary: 'rgba(255, 255, 255, 0.86)' },
};

interface CalendarThemeColors {
  textPrimary: string;
  textSecondary: string;
  overlayBg: string;
  iconBg: string;
  iconColor: string;
  dividerColor: string;
  hoverBg: string;
  hoverText: string;
  dotColor: string;
  moreEventsColor: string;
  chipBg: string;
  chipHoverBg: string;
  todayBg: string;
}

export function useCalendarTheme(
  theme: ThemeType,
  backgroundColor?: string,
  tintTextPrimary?: string,
  tintTextSecondary?: string
): CalendarThemeColors {
  const untintedText = UNTINTED_TEXT_COLORS[theme];
  const textPrimary = tintTextPrimary ?? untintedText.primary;
  const textSecondary = tintTextSecondary ?? untintedText.secondary;
  const overlayBg =
    theme === 'light' ? 'bg-white/60 backdrop-blur-sm' : 'bg-black/20 backdrop-blur-sm';
  const iconBg =
    theme === 'light'
      ? 'bg-indigo-100'
      : theme === 'glass'
        ? 'bg-indigo-300/24 border border-indigo-100/20 backdrop-blur-sm'
        : 'bg-white/10 border border-white/14 backdrop-blur-sm';
  const iconColor =
    theme === 'light' ? 'text-indigo-700' : theme === 'glass' ? 'text-indigo-100' : 'text-white';
  const dividerColor = theme === 'light' ? 'bg-gray-200' : 'bg-white/12';
  const hoverBg = theme === 'light' ? 'hover:bg-gray-100/80' : 'hover:bg-white/5';
  const hoverText = '';
  const dotColor = theme === 'light' ? 'text-slate-400' : backgroundColor ? '' : 'text-white/72';
  const moreEventsColor =
    theme === 'light' ? 'text-slate-600' : backgroundColor ? '' : 'text-white/78';
  // Event chips sit on the card surface, so they lean on the same neutral wash the dividers use
  // rather than introducing a second material.
  const chipBg = theme === 'light' ? 'bg-slate-900/6' : 'bg-white/10';
  const chipHoverBg = theme === 'light' ? 'hover:bg-slate-900/12' : 'hover:bg-white/16';
  const todayBg = theme === 'light' ? 'bg-slate-900/8' : 'bg-white/12';

  return {
    textPrimary,
    textSecondary,
    overlayBg,
    iconBg,
    iconColor,
    dividerColor,
    hoverBg,
    hoverText,
    dotColor,
    moreEventsColor,
    chipBg,
    chipHoverBg,
    todayBg,
  };
}
