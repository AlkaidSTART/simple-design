import { describe, expect, it } from 'vitest';
import { fitViewport, pinchViewport, screenToWorld, zoomAt } from './viewport';

describe('viewport math', () => {
  it('keeps the cursor anchored while zooming', () => {
    const before = { x: 180, y: 140 };
    const viewport = { x: 40, y: 30, scale: 1 };
    const next = zoomAt(before, 2, viewport);
    expect(screenToWorld(before, next)).toEqual(screenToWorld(before, viewport));
  });

  it('clamps zoom to the supported range', () => {
    expect(zoomAt({ x: 0, y: 0 }, 0.001, { x: 0, y: 0, scale: 1 }).scale).toBe(0.1);
    expect(zoomAt({ x: 0, y: 0 }, 99, { x: 0, y: 0, scale: 1 }).scale).toBe(4);
  });

  it('keeps the pinch midpoint anchored while the midpoint pans', () => {
    const start = { first: { x: 100, y: 100 }, second: { x: 200, y: 100 } };
    const current = { first: { x: 90, y: 80 }, second: { x: 240, y: 80 } };
    const viewport = { x: 40, y: 30, scale: 1 };
    const next = pinchViewport(start, current, viewport);

    expect(next.scale).toBeCloseTo(1.5);
    expect(screenToWorld({ x: 165, y: 80 }, next)).toEqual(screenToWorld({ x: 150, y: 100 }, viewport));
  });

  it('centers an artboard with a small breathing margin', () => {
    const result = fitViewport(1000, 700, 1280, 800);
    expect(result.scale).toBeCloseTo(0.671875);
    expect(result.x).toBeCloseTo(70);
    expect(result.y).toBeCloseTo(81.25);
  });
});
