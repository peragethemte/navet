import type { ProviderWeatherFeatureService } from '@navet/core/provider-feature-services';
import { getYrForecast } from './yr-client';
import { buildDailyForecastEntries, buildHourlyForecastEntries } from './yr-forecast-utils';

export const yrWeatherFeatureService: ProviderWeatherFeatureService = {
  async getForecast(_entityId, type) {
    const forecast = await getYrForecast();
    const timeseries = forecast?.properties?.timeseries ?? [];
    if (timeseries.length === 0) {
      return [];
    }

    return type === 'hourly'
      ? buildHourlyForecastEntries(timeseries)
      : buildDailyForecastEntries(timeseries);
  },
};
