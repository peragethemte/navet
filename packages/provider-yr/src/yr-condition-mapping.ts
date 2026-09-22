/**
 * Translates met.no/Yr.no symbol codes into the Home Assistant-style condition vocabulary
 * that `weather-icon.tsx` resolves icons against. Unmapped codes fall through to that
 * component's title-cased fallback, so this table does not need to be exhaustive.
 */

const DAY_NIGHT_SUFFIX_PATTERN = /_(day|night|polartwilight)$/;

type YrPeriod = 'day' | 'night' | 'polartwilight';

const BASE_CONDITION_MAP: Record<string, string> = {
  clearsky: 'clear',
  fair: 'clear',
  partlycloudy: 'partlycloudy',
  cloudy: 'cloudy',
  fog: 'fog',
  rain: 'rainy',
  lightrain: 'rainy',
  heavyrain: 'pouring',
  rainshowers: 'rainy',
  lightrainshowers: 'rainy',
  heavyrainshowers: 'pouring',
  sleet: 'snowy-rainy',
  lightsleet: 'snowy-rainy',
  heavysleet: 'snowy-rainy',
  sleetshowers: 'snowy-rainy',
  lightsleetshowers: 'snowy-rainy',
  heavysleetshowers: 'snowy-rainy',
  snow: 'snowy',
  lightsnow: 'snowy',
  heavysnow: 'snowy',
  snowshowers: 'snowy',
  lightsnowshowers: 'snowy',
  heavysnowshowers: 'snowy',
  rainandthunder: 'lightning-rainy',
  lightrainandthunder: 'lightning-rainy',
  heavyrainandthunder: 'lightning-rainy',
  rainshowersandthunder: 'lightning-rainy',
  lightrainshowersandthunder: 'lightning-rainy',
  heavyrainshowersandthunder: 'lightning-rainy',
  sleetandthunder: 'lightning-rainy',
  lightsleetandthunder: 'lightning-rainy',
  heavysleetandthunder: 'lightning-rainy',
  sleetshowersandthunder: 'lightning-rainy',
  lightssleetshowersandthunder: 'lightning-rainy',
  heavysleetshowersandthunder: 'lightning-rainy',
  snowandthunder: 'lightning',
  lightsnowandthunder: 'lightning',
  heavysnowandthunder: 'lightning',
  snowshowersandthunder: 'lightning',
  lightssnowshowersandthunder: 'lightning',
  heavysnowshowersandthunder: 'lightning',
  thunder: 'lightning',
};

const CLEAR_CONDITION_BY_PERIOD: Record<YrPeriod, string> = {
  day: 'sunny',
  night: 'clear-night',
  polartwilight: 'partlycloudy',
};

const PARTLYCLOUDY_CONDITION_BY_PERIOD: Record<YrPeriod, string> = {
  day: 'partlycloudy',
  night: 'partlycloudy-night',
  polartwilight: 'partlycloudy',
};

function splitDayNightSuffix(symbolCode: string): { base: string; period: YrPeriod | null } {
  const match = DAY_NIGHT_SUFFIX_PATTERN.exec(symbolCode);
  if (!match) {
    return { base: symbolCode, period: null };
  }

  return { base: symbolCode.slice(0, match.index), period: match[1] as YrPeriod };
}

export function mapYrSymbolCodeToCondition(symbolCode: string | undefined | null): string {
  if (!symbolCode) {
    return 'cloudy';
  }

  const { base, period } = splitDayNightSuffix(symbolCode);
  const mapped = BASE_CONDITION_MAP[base];

  if (!mapped) {
    return base;
  }

  if (mapped === 'clear') {
    return period ? CLEAR_CONDITION_BY_PERIOD[period] : 'sunny';
  }

  if (mapped === 'partlycloudy') {
    return period ? PARTLYCLOUDY_CONDITION_BY_PERIOD[period] : 'partlycloudy';
  }

  return mapped;
}
