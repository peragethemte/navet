import { describe, expect, it } from 'vitest';
import { buildGeocoderQuery, buildSearchBoundingBox, mapGeocoderResponse } from '../entur-geocoder';

describe('buildGeocoderQuery', () => {
  it('asks only for stop places', () => {
    const params = new URLSearchParams(buildGeocoderQuery('Greåker'));
    expect(params.get('q')).toBe('Greåker');
    expect(params.get('layers')).toBe('stopPlace');
    expect(params.get('limit')).toBe('6');
    expect(params.has('counties')).toBe(false);
  });

  it('applies a bounding box when one is configured', () => {
    const params = new URLSearchParams(
      buildGeocoderQuery('  skole  ', { boundingBox: '10.6,58.8,11.6,59.7', limit: 3 })
    );
    expect(params.get('q')).toBe('skole');
    expect(params.get('bbox')).toBe('10.6,58.8,11.6,59.7');
    expect(params.get('limit')).toBe('3');
  });
});

describe('buildSearchBoundingBox', () => {
  const sarpsborg = { latitude: 59.2839, longitude: 11.1094, name: 'Sarpsborg' };

  it('orders the box as minLon,minLat,maxLon,maxLat', () => {
    const [minLon, minLat, maxLon, maxLat] = buildSearchBoundingBox(sarpsborg)
      .split(',')
      .map(Number);
    expect(minLon).toBeLessThan(maxLon);
    expect(minLat).toBeLessThan(maxLat);
    expect(minLat).toBeLessThan(sarpsborg.latitude);
    expect(maxLon).toBeGreaterThan(sarpsborg.longitude);
  });

  it('widens longitude as meridians converge', () => {
    const [minLon, minLat, maxLon, maxLat] = buildSearchBoundingBox(sarpsborg)
      .split(',')
      .map(Number);
    expect(maxLon - minLon).toBeGreaterThan(maxLat - minLat);
  });

  it('honours a smaller radius', () => {
    const wide = buildSearchBoundingBox(sarpsborg, 50).split(',').map(Number);
    const narrow = buildSearchBoundingBox(sarpsborg, 10).split(',').map(Number);
    expect(narrow[2] - narrow[0]).toBeLessThan(wide[2] - wide[0]);
  });

  it('stays finite at the pole', () => {
    const values = buildSearchBoundingBox({ latitude: 90, longitude: 0, name: 'Pole' })
      .split(',')
      .map(Number);
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe('mapGeocoderResponse', () => {
  const feature = {
    properties: {
      id: 'NSR:StopPlace:2545',
      names: { default: 'Greåker', display: 'Greåker, Sarpsborg' },
      address: { locality: 'Sarpsborg', county: 'Østfold' },
      transportModes: [{ mode: 'bus' }],
    },
  };

  it('prefers the display name and keeps the locality', () => {
    expect(mapGeocoderResponse({ features: [feature] })).toEqual([
      {
        id: 'NSR:StopPlace:2545',
        name: 'Greåker, Sarpsborg',
        locality: 'Sarpsborg',
        modes: ['bus'],
      },
    ]);
  });

  it('falls back to the default name', () => {
    const [suggestion] = mapGeocoderResponse({
      features: [{ properties: { ...feature.properties, names: { default: 'Greåker' } } }],
    });
    expect(suggestion?.name).toBe('Greåker');
  });

  it('drops features without an id or a name', () => {
    expect(
      mapGeocoderResponse({
        features: [
          { properties: { id: '', names: { display: 'Nowhere' } } },
          { properties: { id: 'x' } },
        ],
      })
    ).toEqual([]);
  });

  it('keeps only the first feature per id', () => {
    expect(mapGeocoderResponse({ features: [feature, feature] })).toHaveLength(1);
  });

  it('survives an empty or malformed response', () => {
    expect(mapGeocoderResponse({})).toEqual([]);
    expect(mapGeocoderResponse({ features: [null] })).toEqual([]);
  });
});
