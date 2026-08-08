import type { ViewportState } from '../types/design';

export interface Point {
  x: number;
  y: number;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const screenToWorld = (point: Point, viewport: ViewportState): Point => ({
  x: (point.x - viewport.x) / viewport.scale,
  y: (point.y - viewport.y) / viewport.scale,
});

export const zoomAt = (cursor: Point, factor: number, viewport: ViewportState): ViewportState => {
  const scale = clamp(viewport.scale * factor, 0.1, 4);
  const world = screenToWorld(cursor, viewport);
  return {
    scale,
    x: cursor.x - world.x * scale,
    y: cursor.y - world.y * scale,
  };
};

export const fitViewport = (width: number, height: number, artboardWidth: number, artboardHeight: number): ViewportState => {
  const scale = clamp(Math.min(width / artboardWidth, height / artboardHeight) * 0.86, 0.1, 4);
  return {
    scale,
    x: (width - artboardWidth * scale) / 2,
    y: (height - artboardHeight * scale) / 2,
  };
};
