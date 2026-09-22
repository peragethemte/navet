import { describe, expect, it } from 'vitest';
import { mapYrSymbolCodeToCondition } from './yr-condition-mapping';

describe('mapYrSymbolCodeToCondition', () => {
  it('maps clear sky codes to time-of-day specific conditions', () => {
    expect(mapYrSymbolCodeToCondition('clearsky_day')).toBe('sunny');
    expect(mapYrSymbolCodeToCondition('clearsky_night')).toBe('clear-night');
    expect(mapYrSymbolCodeToCondition('fair_day')).toBe('sunny');
    expect(mapYrSymbolCodeToCondition('fair_night')).toBe('clear-night');
  });

  it('maps partly cloudy codes to time-of-day specific conditions', () => {
    expect(mapYrSymbolCodeToCondition('partlycloudy_day')).toBe('partlycloudy');
    expect(mapYrSymbolCodeToCondition('partlycloudy_night')).toBe('partlycloudy-night');
  });

  it('maps rain and precipitation intensity codes', () => {
    expect(mapYrSymbolCodeToCondition('rain')).toBe('rainy');
    expect(mapYrSymbolCodeToCondition('lightrainshowers_day')).toBe('rainy');
    expect(mapYrSymbolCodeToCondition('heavyrain')).toBe('pouring');
    expect(mapYrSymbolCodeToCondition('heavyrainshowers_night')).toBe('pouring');
  });

  it('maps sleet and snow codes', () => {
    expect(mapYrSymbolCodeToCondition('sleet')).toBe('snowy-rainy');
    expect(mapYrSymbolCodeToCondition('lightsleetshowers_day')).toBe('snowy-rainy');
    expect(mapYrSymbolCodeToCondition('snow')).toBe('snowy');
    expect(mapYrSymbolCodeToCondition('heavysnowshowers_night')).toBe('snowy');
  });

  it('maps thunder codes to lightning conditions', () => {
    expect(mapYrSymbolCodeToCondition('rainandthunder')).toBe('lightning-rainy');
    expect(mapYrSymbolCodeToCondition('heavyrainshowersandthunder_day')).toBe('lightning-rainy');
    expect(mapYrSymbolCodeToCondition('snowandthunder')).toBe('lightning');
  });

  it('maps cloudy and fog directly', () => {
    expect(mapYrSymbolCodeToCondition('cloudy')).toBe('cloudy');
    expect(mapYrSymbolCodeToCondition('fog')).toBe('fog');
  });

  it('falls back to cloudy for missing symbol codes', () => {
    expect(mapYrSymbolCodeToCondition(undefined)).toBe('cloudy');
    expect(mapYrSymbolCodeToCondition(null)).toBe('cloudy');
  });

  it('degrades gracefully for unmapped symbol codes by returning the stripped base code', () => {
    expect(mapYrSymbolCodeToCondition('some_unknown_symbol_day')).toBe('some_unknown_symbol');
  });
});
