import { mapYrSymbolCodeToCondition } from './yr-condition-mapping';
import type { YrTimeseriesEntry } from './yr-types';

type WeatherForecastEntry = Record<string, unknown>;

export function pickEntrySymbolCode(entry: YrTimeseriesEntry): string | undefined {
  return (
    entry.data.next_1_hours?.summary?.symbol_code ??
    entry.data.next_6_hours?.summary?.symbol_code ??
    entry.data.next_12_hours?.summary?.symbol_code
  );
}

export function pickEntryPrecipitation(entry: YrTimeseriesEntry): number | undefined {
  return (
    entry.data.next_1_hours?.details?.precipitation_amount ??
    entry.data.next_6_hours?.details?.precipitation_amount
  );
}

export function pickEntryTemperature(entry: YrTimeseriesEntry): number | undefined {
  return entry.data.instant?.details?.air_temperature;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

interface DailyBucket {
  date: string;
  entries: YrTimeseriesEntry[];
}

function groupTimeseriesByLocalDay(timeseries: YrTimeseriesEntry[]): DailyBucket[] {
  const buckets = new Map<string, YrTimeseriesEntry[]>();

  for (const entry of timeseries) {
    const time = new Date(entry.time);
    if (Number.isNaN(time.getTime())) {
      continue;
    }

    const key = localDateKey(time);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  }

  return [...buckets.entries()].map(([date, entries]) => ({ date, entries }));
}

function pickRepresentativeEntry(entries: YrTimeseriesEntry[]): YrTimeseriesEntry {
  return entries.reduce((best, entry) => {
    const bestHourDelta = Math.abs(new Date(best.time).getHours() - 12);
    const entryHourDelta = Math.abs(new Date(entry.time).getHours() - 12);
    return entryHourDelta < bestHourDelta ? entry : best;
  }, entries[0] as YrTimeseriesEntry);
}

export function buildDailyForecastEntries(
  timeseries: YrTimeseriesEntry[],
  maxDays = 7
): WeatherForecastEntry[] {
  return groupTimeseriesByLocalDay(timeseries)
    .slice(0, maxDays)
    .map(({ date, entries }) => {
      const temperatures = entries
        .map(pickEntryTemperature)
        .filter((value): value is number => value !== undefined);
      const representative = pickRepresentativeEntry(entries);
      const precipitation = entries.reduce(
        (max, entry) => Math.max(max, pickEntryPrecipitation(entry) ?? 0),
        0
      );

      return {
        datetime: `${date}T00:00:00`,
        condition: mapYrSymbolCodeToCondition(pickEntrySymbolCode(representative)),
        temperature: temperatures.length > 0 ? Math.max(...temperatures) : undefined,
        native_temperature_unit: '°C',
        templow: temperatures.length > 0 ? Math.min(...temperatures) : undefined,
        native_templow_unit: '°C',
        precipitation,
        precipitation_unit: 'mm',
      } satisfies WeatherForecastEntry;
    });
}

export function buildHourlyForecastEntries(
  timeseries: YrTimeseriesEntry[],
  maxEntries = 48
): WeatherForecastEntry[] {
  return timeseries.slice(0, maxEntries).map(
    (entry) =>
      ({
        datetime: entry.time,
        condition: mapYrSymbolCodeToCondition(pickEntrySymbolCode(entry)),
        temperature: pickEntryTemperature(entry),
        native_temperature_unit: '°C',
        precipitation: pickEntryPrecipitation(entry) ?? 0,
        precipitation_unit: 'mm',
      }) satisfies WeatherForecastEntry
  );
}
