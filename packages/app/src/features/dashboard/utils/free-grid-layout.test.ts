import { describe, expect, it } from 'vitest';
import { resolveFreeGridPlacements } from './free-grid-layout';

const span = { w: 8, h: 8 };

describe('free grid placement', () => {
  it('keeps cards where they were dropped, gaps included', () => {
    const placements = resolveFreeGridPlacements(
      [
        { id: 'a', span, position: { x: 0, y: 0 } },
        { id: 'b', span, position: { x: 12, y: 10 } },
      ],
      24
    );

    expect(placements.get('b')).toEqual({ x: 12, y: 10 });
  });

  it('pushes overlapped cards straight down, cascading', () => {
    const placements = resolveFreeGridPlacements(
      [
        { id: 'a', span, position: { x: 0, y: 0 } },
        { id: 'b', span, position: { x: 0, y: 8 } },
        { id: 'moved', span, position: { x: 2, y: 4 } },
      ],
      24,
      'moved'
    );

    expect(placements.get('moved')).toEqual({ x: 2, y: 4 });
    expect(placements.get('a')).toEqual({ x: 0, y: 12 });
    expect(placements.get('b')).toEqual({ x: 0, y: 20 });
  });

  it('puts cards without a position below everything instead of into gaps', () => {
    const placements = resolveFreeGridPlacements(
      [
        { id: 'a', span, position: { x: 16, y: 0 } },
        { id: 'new', span: { w: 4, h: 4 } },
      ],
      24
    );

    expect(placements.get('new')).toEqual({ x: 0, y: 8 });
  });

  it('clamps a card that would stick out of a narrower grid', () => {
    const placements = resolveFreeGridPlacements(
      [{ id: 'a', span, position: { x: 20, y: 0 } }],
      24
    );

    expect(placements.get('a')).toEqual({ x: 16, y: 0 });
  });
});
