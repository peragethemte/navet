export interface YrProxyStatus {
  configured: boolean;
  locationName: string | null;
}

interface YrForecastPeriodDetails {
  precipitation_amount?: number;
}

interface YrForecastPeriod {
  summary?: { symbol_code?: string };
  details?: YrForecastPeriodDetails;
}

interface YrInstantDetails {
  air_temperature?: number;
  relative_humidity?: number;
  wind_speed?: number;
  wind_from_direction?: number;
  air_pressure_at_sea_level?: number;
  cloud_area_fraction?: number;
}

export interface YrTimeseriesEntry {
  time: string;
  data: {
    instant?: { details?: YrInstantDetails };
    next_1_hours?: YrForecastPeriod;
    next_6_hours?: YrForecastPeriod;
    next_12_hours?: YrForecastPeriod;
  };
}

export interface YrLocationforecastResponse {
  properties?: {
    meta?: { updated_at?: string };
    timeseries?: YrTimeseriesEntry[];
  };
}

export interface YrSunriseResponse {
  properties?: {
    sunrise?: { time?: string };
    sunset?: { time?: string };
  };
}
