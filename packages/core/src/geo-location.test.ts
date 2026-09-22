import { describe, expect, it } from 'vitest';
import {
  formatCoordinate,
  geoCoordinatesKey,
  isSameGeoLocation,
  isValidLatitude,
  isValidLongitude,
  normalizeGeoLocation,
  parseCoordinate,
  roundCoordinate,
} from './geo-location';

describe('coordinate validation', () => {
  it.each([0, 59.2839, -90, 90])('accepts latitude %s', (value) => {
    expect(isValidLatitude(value)).toBe(true);
  });

  it.each([90.1, -90.1, Number.NaN, Number.POSITIVE_INFINITY, '59', null, undefined])(
    'rejects latitude %s',
    (value) => {
      expect(isValidLatitude(value)).toBe(false);
    }
  );

  it.each([0, 11.1094, -180, 180])('accepts longitude %s', (value) => {
    expect(isValidLongitude(value)).toBe(true);
  });

  it.each([180.1, -180.1, Number.NaN, '11', {}])('rejects longitude %s', (value) => {
    expect(isValidLongitude(value)).toBe(false);
  });
});

describe('parseCoordinate', () => {
  it('reads a comma decimal separator', () => {
    expect(parseCoordinate('59,2839')).toBe(59.2839);
  });

  it('trims surrounding whitespace', () => {
    expect(parseCoordinate('  11.11 ')).toBe(11.11);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('   ')).toBeNull();
    expect(parseCoordinate('Sarpsborg')).toBeNull();
  });
});

describe('roundCoordinate', () => {
  it('keeps at most four decimals', () => {
    expect(roundCoordinate(59.28394857)).toBe(59.2839);
    expect(formatCoordinate(59.1)).toBe('59.1');
  });
});

describe('normalizeGeoLocation', () => {
  it('rounds coordinates and trims the name', () => {
    expect(
      normalizeGeoLocation({ latitude: 59.283948, longitude: 11.109412, name: '  Sarpsborg ' })
    ).toEqual({
      latitude: 59.2839,
      longitude: 11.1094,
      name: 'Sarpsborg',
    });
  });

  it('defaults a missing name to an empty label', () => {
    expect(normalizeGeoLocation({ latitude: 59.3, longitude: 11.1 })).toEqual({
      latitude: 59.3,
      longitude: 11.1,
      name: '',
    });
  });

  it.each([
    null,
    'Sarpsborg',
    { latitude: 91, longitude: 11.1 },
    { latitude: 59.3, longitude: 181 },
    { latitude: Number.NaN, longitude: 11.1 },
    { longitude: 11.1 },
  ])('rejects %s', (value) => {
    expect(normalizeGeoLocation(value)).toBeNull();
  });
});

describe('isSameGeoLocation', () => {
  const location = { latitude: 59.3, longitude: 11.1, name: 'Sarpsborg' };

  it('compares by value', () => {
    expect(isSameGeoLocation(location, { ...location })).toBe(true);
    expect(isSameGeoLocation(location, { ...location, name: 'Fredrikstad' })).toBe(false);
    expect(isSameGeoLocation(location, null)).toBe(false);
    expect(isSameGeoLocation(null, null)).toBe(true);
  });
});

describe('geoCoordinatesKey', () => {
  it('ignores the display name so renaming does not refetch', () => {
    expect(geoCoordinatesKey({ latitude: 59.3, longitude: 11.1, name: 'Sarpsborg' })).toBe(
      geoCoordinatesKey({ latitude: 59.3, longitude: 11.1, name: 'Home' })
    );
  });

  it('has a distinct key for the server default', () => {
    expect(geoCoordinatesKey(null)).toBe('default');
  });
});
