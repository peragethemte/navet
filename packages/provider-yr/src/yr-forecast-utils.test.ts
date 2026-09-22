import { describe, expect, it } from 'vitest';
import {
  buildDailyForecastEntries,
  buildHourlyForecastEntries,
  pickEntryPrecipitation,
  pickEntrySymbolCode,
  pickEntryTemperature,
} from './yr-forecast-utils';
import type { YrTimeseriesEntry } from './yr-types';

function entry(
  isoTime: string,
  temperature: number,
  symbolCode: string,
  precipitation = 0
): YrTimeseriesEntry {
  return {
    time: isoTime,
    data: {
      instant: { details: { air_temperature: temperature } },
      next_1_hours: {
        summary: { symbol_code: symbolCode },
        details: { precipitation_amount: precipitation },
      },
    },
  };
}

describe('yr forecast entry pickers', () => {
  it('prefers next_1_hours, then next_6_hours, then next_12_hours for the symbol code', () => {
    const withOnlySixHour: YrTimeseriesEntry = {
      time: '2026-09-22T06:00:00Z',
      data: { next_6_hours: { summary: { symbol_code: 'cloudy' } } },
    };
    expect(pickEntrySymbolCode(withOnlySixHour)).toBe('cloudy');

    const withBoth: YrTimeseriesEntry = {
      time: '2026-09-22T06:00:00Z',
      data: {
        next_1_hours: { summary: { symbol_code: 'rain' } },
        next_6_hours: { summary: { symbol_code: 'cloudy' } },
      },
    };
    expect(pickEntrySymbolCode(withBoth)).toBe('rain');
  });

  it('reads instant temperature and next_1_hours precipitation', () => {
    const sample = entry('2026-09-22T06:00:00Z', 12.4, 'rain', 0.8);
    expect(pickEntryTemperature(sample)).toBe(12.4);
    expect(pickEntryPrecipitation(sample)).toBe(0.8);
  });
});

describe('buildHourlyForecastEntries', () => {
  it('maps each raw entry to an hourly forecast entry, capped at maxEntries', () => {
    const timeseries = [
      entry('2026-09-22T06:00:00Z', 10, 'clearsky_day'),
      entry('2026-09-22T07:00:00Z', 11, 'partlycloudy_day', 0.2),
      entry('2026-09-22T08:00:00Z', 12, 'rain', 1.5),
    ];

    const result = buildHourlyForecastEntries(timeseries, 2);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      datetime: '2026-09-22T06:00:00Z',
      condition: 'sunny',
      temperature: 10,
      precipitation: 0,
    });
    expect(result[1]).toMatchObject({
      datetime: '2026-09-22T07:00:00Z',
      condition: 'partlycloudy',
      temperature: 11,
      precipitation: 0.2,
    });
  });
});

describe('buildDailyForecastEntries', () => {
  it('groups entries by local calendar day and derives high/low/representative condition', () => {
    // Local time zone in the test runner is UTC by default, so these entries land on
    // two distinct UTC calendar days.
    const timeseries: YrTimeseriesEntry[] = [
      entry('2026-09-22T00:00:00Z', 8, 'cloudy'),
      entry('2026-09-22T12:00:00Z', 18, 'clearsky_day', 0.4),
      entry('2026-09-22T18:00:00Z', 14, 'partlycloudy_day'),
      entry('2026-09-23T09:00:00Z', 9, 'rain', 2.1),
      entry('2026-09-23T13:00:00Z', 13, 'rain', 3.4),
    ];

    const result = buildDailyForecastEntries(timeseries, 7);

    expect(result).toHaveLength(2);
    // The noon entry (12:00) is closest to local midday, so its condition represents the day.
    expect(result[0]).toMatchObject({
      datetime: '2026-09-22T00:00:00',
      condition: 'sunny',
      temperature: 18,
      templow: 8,
      precipitation: 0.4,
    });
    expect(result[1]).toMatchObject({
      datetime: '2026-09-23T00:00:00',
      condition: 'rainy',
      temperature: 13,
      templow: 9,
      precipitation: 3.4,
    });
  });

  it('caps the number of days returned', () => {
    const timeseries: YrTimeseriesEntry[] = Array.from({ length: 10 }, (_, index) =>
      entry(`2026-09-${String(22 + index).padStart(2, '0')}T12:00:00Z`, 10 + index, 'cloudy')
    );

    expect(buildDailyForecastEntries(timeseries, 3)).toHaveLength(3);
  });
});
