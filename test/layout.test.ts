import { describe, expect, it } from 'vitest';
import { layoutFor, SIDEWAYS_MAX_HEIGHT } from '../src/layout';

describe('layoutFor', () => {
  it.each([
    [1280, 800, 'desk'],
    [412, 915, 'portrait'],
    [360, 800, 'portrait'],
    [915, 412, 'sideways'],
    [820, 1180, 'portrait'],
    [1180, 820, 'desk'],
  ] as const)('%i x %i is %s', (w, h, layout) => {
    expect(layoutFor(w, h)).toBe(layout);
  });

  it('is sideways at 500 tall and desk at 501', () => {
    expect(SIDEWAYS_MAX_HEIGHT).toBe(500);
    expect(layoutFor(900, 500)).toBe('sideways');
    expect(layoutFor(900, 501)).toBe('desk');
  });

  it('takes a square screen as sideways when short and desk when tall, never portrait', () => {
    expect(layoutFor(500, 500)).toBe('sideways');
    expect(layoutFor(800, 800)).toBe('desk');
  });

  it('is portrait the moment it is taller than wide, however short', () => {
    expect(layoutFor(300, 301)).toBe('portrait');
    expect(layoutFor(200, 100)).toBe('sideways');
  });
});
