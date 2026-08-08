import type { DrawPoint, Layer } from '../types/design';

export const getBrushBounds = (points: DrawPoint[], strokeWidth = 8) => {
  const padding = Math.max(strokeWidth / 2, 2);
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const x = Math.max(0, Math.floor(minX - padding));
  const y = Math.max(0, Math.floor(minY - padding));
  const right = Math.ceil(maxX + padding);
  const bottom = Math.ceil(maxY + padding);

  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
};

export const brushPointsToLocal = (layer: Layer) => (layer.points ?? []).map((point) => ({
  x: point.x - layer.x,
  y: point.y - layer.y,
}));

export const pointsToSvg = (points: DrawPoint[]) => {
  if (points.length === 1) return `${points[0].x},${points[0].y} ${points[0].x},${points[0].y}`;
  return points.map((point) => `${point.x},${point.y}`).join(' ');
};
