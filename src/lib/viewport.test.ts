import { describe, expect, it } from 'vitest';
import { fitViewport, screenToWorld, zoomAt } from './viewport';

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

  it('centers an artboard with a small breathing margin', () => {
    const result = fitViewport(1000, 700, 1280, 800);
    expect(result.scale).toBeCloseTo(0.671875);
    expect(result.x).toBeCloseTo(70);
    expect(result.y).toBeCloseTo(81.25);
  });
});
