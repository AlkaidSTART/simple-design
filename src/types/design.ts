export type LayerType = 'rect' | 'circle' | 'text' | 'button' | 'image' | 'brush';

export interface DrawPoint {
  x: number;
  y: number;
}

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill?: string;
  color?: string;
  radius?: number;
  blur?: boolean;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  align?: 'left' | 'center' | 'right';
  src?: string;
  points?: DrawPoint[];
  stroke?: string;
  strokeWidth?: number;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  accent: string;
  layers: Layer[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasDocument {
  id: string;
  projectId: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  viewport: ViewportState;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  theme: 'liquid' | 'ivory';
  glassEnabled: boolean;
}

export const DEFAULT_CANVAS_WIDTH = 1280;
export const DEFAULT_CANVAS_HEIGHT = 800;
export const MIN_CANVAS_WIDTH = 240;
export const MIN_CANVAS_HEIGHT = 160;
export const MAX_CANVAS_DIMENSION = 4096;

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}
