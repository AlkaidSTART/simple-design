export type LayerType = 'rect' | 'circle' | 'text' | 'button' | 'image';

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
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  accent: string;
  layers: Layer[];
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}
