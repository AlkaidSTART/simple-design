import { create } from 'zustand';
import { starterLayers, templates } from '../data/templates';
import { getBrushBounds } from '../lib/brush';
import { saveCanvas, saveClipboard, saveProject } from '../lib/storage';
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, MAX_CANVAS_DIMENSION, MIN_CANVAS_HEIGHT, MIN_CANVAS_WIDTH } from '../types/design';
import type { CanvasDocument, DrawPoint, Layer, LayerType, Project, ViewportState, WorkspaceSettings } from '../types/design';

const cloneLayers = (layers: Layer[]) => layers.map((layer) => ({ ...layer }));
const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const initialNow = now();
const initialProject: Project = { id: 'project-default', name: '我的第一个项目', createdAt: initialNow, updatedAt: initialNow };
const initialCanvas: CanvasDocument = {
  id: 'canvas-default', projectId: initialProject.id, name: '首张画布', width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT, layers: cloneLayers(starterLayers),
  viewport: { x: 0, y: 0, scale: 0.8 }, createdAt: initialNow, updatedAt: initialNow,
};
const normalizeDimension = (value: number | undefined, fallback: number, minimum: number) => Math.min(MAX_CANVAS_DIMENSION, Math.max(minimum, Math.round(Number.isFinite(value) ? value! : fallback)));
const isArtboardBackground = (layer: Layer, width: number, height: number) => layer.type === 'rect' && layer.x === 0 && layer.y === 0 && layer.width === width && layer.height === height;

interface DesignState {
  projects: Project[];
  canvases: CanvasDocument[];
  activeProjectId: string;
  activeCanvasId: string;
  documentName: string;
  layers: Layer[];
  selectedIds: string[];
  activeTool: LayerType | 'select' | 'hand';
  viewport: ViewportState;
  theme: 'liquid' | 'ivory';
  glassEnabled: boolean;
  templatesOpen: boolean;
  clipboard: Layer[];
  hydrated: boolean;
  savedAt: string;
  hydrateWorkspace: (data: { projects: Project[]; canvases: CanvasDocument[]; settings?: WorkspaceSettings; clipboard: Layer[] }) => void;
  setDocumentName: (name: string) => void;
  setLayers: (layers: Layer[]) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setActiveTool: (tool: DesignState['activeTool']) => void;
  setViewport: (viewport: ViewportState) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  moveLayers: (ids: string[], delta: { x: number; y: number }) => void;
  addLayer: (type: LayerType, x?: number, y?: number) => string;
  addBrush: (points: DrawPoint[]) => string;
  setCanvasSize: (width: number, height: number) => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  deleteSelected: () => void;
  selectAll: () => void;
  applyTemplate: (templateId: string) => void;
  createProject: (name?: string, width?: number, height?: number) => void;
  createCanvas: (name?: string, duplicateActive?: boolean, width?: number, height?: number) => void;
  switchProject: (id: string) => void;
  switchCanvas: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  renameCanvas: (id: string, name: string) => void;
  toggleTheme: () => void;
  toggleGlass: () => void;
  toggleTemplates: () => void;
  markSaved: () => void;
}

const newLayer = (type: LayerType, x = 120, y = 120): Layer => {
  const id = uid('layer');
  const base = { id, type, name: '新图层', x, y, width: 180, height: 100, rotation: 0, opacity: 1 };
  if (type === 'text') return { ...base, name: '文本', text: '输入文本', width: 240, height: 58, fontSize: 24, fontWeight: 600, color: '#17191b', align: 'left' };
  if (type === 'button') return { ...base, name: '按钮', text: '按钮', width: 140, height: 44, fontSize: 14, fontWeight: 700, color: '#f7f4ec', fill: '#17191b', radius: 4, align: 'center' };
  if (type === 'circle') return { ...base, name: '圆形', width: 112, height: 112, fill: '#f0c93d', radius: 56 };
  if (type === 'image') return { ...base, name: '图片', width: 260, height: 180, src: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=640&q=85' };
  if (type === 'brush') return { ...base, name: '笔触', width: 1, height: 1, stroke: '#315f59', strokeWidth: 8, points: [{ x, y }, { x: x + 1, y: y + 1 }] };
  return { ...base, name: '矩形', fill: '#d9d5c8', radius: 8 };
};

const currentCanvasPatch = (state: DesignState, patch: Partial<CanvasDocument>) => {
  const updatedAt = now();
  return {
    canvases: state.canvases.map((canvas) => canvas.id === state.activeCanvasId ? { ...canvas, ...patch, updatedAt } : canvas),
    projects: state.projects.map((project) => project.id === state.activeProjectId ? { ...project, updatedAt } : project),
    savedAt: '保存中…',
  };
};

export const useDesignStore = create<DesignState>((set, get) => ({
  projects: [initialProject],
  canvases: [initialCanvas],
  activeProjectId: initialProject.id,
  activeCanvasId: initialCanvas.id,
  documentName: initialCanvas.name,
  layers: cloneLayers(initialCanvas.layers),
  selectedIds: [starterLayers.find((layer) => layer.name === '主标题')?.id ?? ''],
  activeTool: 'select',
  viewport: initialCanvas.viewport,
  theme: 'liquid',
  glassEnabled: true,
  templatesOpen: false,
  clipboard: [],
  hydrated: false,
  savedAt: '准备保存',
  hydrateWorkspace: ({ projects, canvases, settings, clipboard }) => {
    const nextProjects = projects.length > 0 ? projects : [initialProject];
    const nextCanvases = (canvases.length > 0 ? canvases : [initialCanvas]).map((item) => ({
      ...item,
      width: normalizeDimension(item.width, DEFAULT_CANVAS_WIDTH, MIN_CANVAS_WIDTH),
      height: normalizeDimension(item.height, DEFAULT_CANVAS_HEIGHT, MIN_CANVAS_HEIGHT),
    }));
    const project = nextProjects.find((item) => nextCanvases.some((canvas) => canvas.projectId === item.id)) ?? nextProjects[0];
    const canvas = nextCanvases.find((item) => item.projectId === project.id) ?? nextCanvases[0];
    set({
      projects: nextProjects,
      canvases: nextCanvases,
      activeProjectId: project.id,
      activeCanvasId: canvas.id,
      documentName: canvas.name,
      layers: cloneLayers(canvas.layers),
      selectedIds: canvas.layers.find((layer) => layer.name === '主标题') ? [canvas.layers.find((layer) => layer.name === '主标题')!.id] : [],
      viewport: canvas.viewport,
      theme: settings?.theme === 'ivory' ? 'ivory' : 'liquid',
      glassEnabled: settings?.glassEnabled ?? true,
      clipboard: cloneLayers(clipboard),
      hydrated: true,
      savedAt: '已从本地恢复',
    });
  },
  setDocumentName: (documentName) => set((state) => ({ documentName, ...currentCanvasPatch(state, { name: documentName }) })),
  setLayers: (layers) => set((state) => ({ layers, ...currentCanvasPatch(state, { layers: cloneLayers(layers) }) })),
  setSelectedId: (id) => set({ selectedIds: id ? [id] : [] }),
  setSelectedIds: (ids) => set({ selectedIds: [...new Set(ids)] }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setViewport: (viewport) => set((state) => ({ viewport, ...currentCanvasPatch(state, { viewport }) })),
  updateLayer: (id, patch) => set((state) => {
    const layers = state.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer);
    return { layers, ...currentCanvasPatch(state, { layers: cloneLayers(layers) }) };
  }),
  moveLayers: (ids, delta) => set((state) => {
    const selected = new Set(ids);
    const layers = state.layers.map((layer) => selected.has(layer.id) ? { ...layer, x: Math.round(layer.x + delta.x), y: Math.round(layer.y + delta.y) } : layer);
    return { layers, ...currentCanvasPatch(state, { layers: cloneLayers(layers) }) };
  }),
  addLayer: (type, x = 120, y = 120) => {
    const layer = newLayer(type, x, y);
    set((state) => {
      const layers = [...state.layers, layer];
      return { layers, selectedIds: [layer.id], activeTool: 'select', ...currentCanvasPatch(state, { layers }) };
    });
    return layer.id;
  },
  addBrush: (points) => {
    if (points.length === 0) return '';
    const strokeWidth = 8;
    const bounds = getBrushBounds(points, strokeWidth);
    const layer: Layer = {
      id: uid('layer'), type: 'brush', name: '笔触', ...bounds, rotation: 0, opacity: 1,
      points: points.map((point) => ({ ...point })), stroke: '#315f59', strokeWidth,
    };
    set((state) => {
      const layers = [...state.layers, layer];
      return { layers, selectedIds: [layer.id], activeTool: 'select', ...currentCanvasPatch(state, { layers }) };
    });
    return layer.id;
  },
  setCanvasSize: (width, height) => set((state) => {
    const activeCanvas = state.canvases.find((canvas) => canvas.id === state.activeCanvasId);
    const nextWidth = normalizeDimension(width, activeCanvas?.width ?? DEFAULT_CANVAS_WIDTH, MIN_CANVAS_WIDTH);
    const nextHeight = normalizeDimension(height, activeCanvas?.height ?? DEFAULT_CANVAS_HEIGHT, MIN_CANVAS_HEIGHT);
    const previousWidth = activeCanvas?.width ?? DEFAULT_CANVAS_WIDTH;
    const previousHeight = activeCanvas?.height ?? DEFAULT_CANVAS_HEIGHT;
    const layers = state.layers.map((layer) => isArtboardBackground(layer, previousWidth, previousHeight)
      ? { ...layer, width: nextWidth, height: nextHeight }
      : layer);
    const canvases = state.canvases.map((canvas) => canvas.id === state.activeCanvasId
      ? { ...canvas, width: nextWidth, height: nextHeight, layers: cloneLayers(layers), updatedAt: now() }
      : canvas);
    return { canvases, layers, savedAt: '保存中…' };
  }),
  duplicateSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((state) => {
      const selected = new Set(selectedIds);
      const duplicates = state.layers.filter((layer) => selected.has(layer.id)).map((layer) => ({ ...layer, id: uid('layer'), name: `${layer.name} copy`, x: layer.x + 24, y: layer.y + 24 }));
      const layers = [...state.layers, ...duplicates];
      return { layers, selectedIds: duplicates.map((layer) => layer.id), ...currentCanvasPatch(state, { layers }) };
    });
  },
  copySelected: () => {
    const { layers, selectedIds } = get();
    const copied = layers.filter((layer) => selectedIds.includes(layer.id)).map((layer) => ({ ...layer }));
    if (copied.length === 0) return;
    set({ clipboard: copied, savedAt: '已复制到本地剪贴板' });
    void saveClipboard(copied).catch(() => undefined);
  },
  pasteClipboard: () => {
    const { clipboard } = get();
    if (clipboard.length === 0) return;
    set((state) => {
      const pasted = clipboard.map((layer) => ({ ...layer, id: uid('layer'), name: `${layer.name} copy`, x: layer.x + 24, y: layer.y + 24 }));
      const layers = [...state.layers, ...pasted];
      return { layers, selectedIds: pasted.map((layer) => layer.id), ...currentCanvasPatch(state, { layers }) };
    });
  },
  deleteSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((state) => {
      const selected = new Set(selectedIds);
      const layers = state.layers.filter((layer) => !selected.has(layer.id));
      return { layers, selectedIds: [], ...currentCanvasPatch(state, { layers }) };
    });
  },
  selectAll: () => set((state) => {
    const canvas = state.canvases.find((item) => item.id === state.activeCanvasId);
    return { selectedIds: state.layers.filter((layer) => !isArtboardBackground(layer, canvas?.width ?? DEFAULT_CANVAS_WIDTH, canvas?.height ?? DEFAULT_CANVAS_HEIGHT)).map((layer) => layer.id) };
  }),
  applyTemplate: (templateId) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const activeCanvas = get().canvases.find((canvas) => canvas.id === get().activeCanvasId);
    const canvasWidth = activeCanvas?.width ?? DEFAULT_CANVAS_WIDTH;
    const canvasHeight = activeCanvas?.height ?? DEFAULT_CANVAS_HEIGHT;
    const layers = cloneLayers(template.layers).map((layer) => ({
      ...layer,
      id: `${templateId}-${layer.id}`,
      ...(isArtboardBackground(layer, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT) ? { width: canvasWidth, height: canvasHeight } : {}),
    }));
    set((state) => ({ layers, selectedIds: layers.find((layer) => layer.name === '主标题') ? [layers.find((layer) => layer.name === '主标题')!.id] : layers[0]?.id ? [layers[0].id] : [], documentName: template.name, templatesOpen: false, ...currentCanvasPatch(state, { layers, name: template.name }) }));
  },
  createProject: (name = '新项目', width = DEFAULT_CANVAS_WIDTH, height = DEFAULT_CANVAS_HEIGHT) => {
    const timestamp = now();
    const project: Project = { id: uid('project'), name, createdAt: timestamp, updatedAt: timestamp };
    const canvas: CanvasDocument = { id: uid('canvas'), projectId: project.id, name: '首张画布', width: normalizeDimension(width, DEFAULT_CANVAS_WIDTH, MIN_CANVAS_WIDTH), height: normalizeDimension(height, DEFAULT_CANVAS_HEIGHT, MIN_CANVAS_HEIGHT), layers: [], viewport: { x: 0, y: 0, scale: 0.8 }, createdAt: timestamp, updatedAt: timestamp };
    set({ projects: [...get().projects, project], canvases: [...get().canvases, canvas], activeProjectId: project.id, activeCanvasId: canvas.id, documentName: canvas.name, layers: [], selectedIds: [], viewport: canvas.viewport, templatesOpen: false, savedAt: '保存中…' });
  },
  createCanvas: (name = '新画布', duplicateActive = false, width = DEFAULT_CANVAS_WIDTH, height = DEFAULT_CANVAS_HEIGHT) => {
    const state = get();
    const timestamp = now();
    const source = duplicateActive ? state.canvases.find((canvas) => canvas.id === state.activeCanvasId) : undefined;
    const canvas: CanvasDocument = { id: uid('canvas'), projectId: state.activeProjectId, name, width: source?.width ?? normalizeDimension(width, DEFAULT_CANVAS_WIDTH, MIN_CANVAS_WIDTH), height: source?.height ?? normalizeDimension(height, DEFAULT_CANVAS_HEIGHT, MIN_CANVAS_HEIGHT), layers: source ? cloneLayers(source.layers).map((layer) => ({ ...layer, id: uid('layer') })) : [], viewport: source?.viewport ?? { x: 0, y: 0, scale: 0.8 }, createdAt: timestamp, updatedAt: timestamp };
    set({ canvases: [...state.canvases, canvas], activeCanvasId: canvas.id, documentName: canvas.name, layers: cloneLayers(canvas.layers), selectedIds: [], viewport: canvas.viewport, templatesOpen: false, savedAt: '保存中…' });
  },
  switchProject: (id) => {
    const state = get();
    const canvas = state.canvases.find((item) => item.projectId === id);
    if (!canvas) return;
    set({ activeProjectId: id, activeCanvasId: canvas.id, documentName: canvas.name, layers: cloneLayers(canvas.layers), selectedIds: [], viewport: canvas.viewport, templatesOpen: false });
  },
  switchCanvas: (id) => {
    const state = get();
    const canvas = state.canvases.find((item) => item.id === id);
    if (!canvas) return;
    set({ activeProjectId: canvas.projectId, activeCanvasId: id, documentName: canvas.name, layers: cloneLayers(canvas.layers), selectedIds: [], viewport: canvas.viewport, templatesOpen: false });
  },
  renameProject: (id, name) => {
    const project = get().projects.find((item) => item.id === id);
    if (!project) return;
    const nextProject = { ...project, name: name.trim() || project.name, updatedAt: now() };
    set((state) => ({ projects: state.projects.map((item) => item.id === id ? nextProject : item) }));
    void saveProject(nextProject).catch(() => undefined);
  },
  renameCanvas: (id, name) => {
    const state = get();
    const currentCanvas = state.canvases.find((canvas) => canvas.id === id);
    const nextName = name.trim() || currentCanvas?.name || state.documentName;
    const canvases = state.canvases.map((canvas) => canvas.id === id ? { ...canvas, name: nextName, updatedAt: now() } : canvas);
    const renamed = canvases.find((canvas) => canvas.id === id);
    if (renamed) void saveCanvas(renamed).catch(() => undefined);
    set({ canvases, documentName: id === state.activeCanvasId ? nextName : state.documentName, savedAt: '保存中…' });
  },
  toggleTheme: () => set((state) => ({ theme: state.theme === 'liquid' ? 'ivory' : 'liquid' })),
  toggleGlass: () => set((state) => ({ glassEnabled: !state.glassEnabled })),
  toggleTemplates: () => set((state) => ({ templatesOpen: !state.templatesOpen })),
  markSaved: () => set({ savedAt: `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` }),
}));

export const getSelectedLayer = (state: DesignState) => state.layers.find((layer) => layer.id === state.selectedIds[0]);
export const getSelectedLayers = (state: DesignState) => state.layers.filter((layer) => state.selectedIds.includes(layer.id));
