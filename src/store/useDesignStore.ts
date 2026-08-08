import { create } from 'zustand';
import { starterLayers, templates } from '../data/templates';
import type { Layer, LayerType, ViewportState } from '../types/design';

const cloneLayers = (layers: Layer[]) => layers.map((layer) => ({ ...layer }));

interface DesignState {
  documentName: string;
  layers: Layer[];
  selectedId: string | null;
  activeTool: LayerType | 'select' | 'hand';
  viewport: ViewportState;
  theme: 'dawn' | 'dusk';
  glassEnabled: boolean;
  templatesOpen: boolean;
  savedAt: string;
  setDocumentName: (name: string) => void;
  setLayers: (layers: Layer[]) => void;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: DesignState['activeTool']) => void;
  setViewport: (viewport: ViewportState) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  addLayer: (type: LayerType, x?: number, y?: number) => string;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  applyTemplate: (templateId: string) => void;
  toggleTheme: () => void;
  toggleGlass: () => void;
  toggleTemplates: () => void;
  markSaved: () => void;
}

const newLayer = (type: LayerType, x = 120, y = 120): Layer => {
  const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const base = { id, type, name: '新图层', x, y, width: 180, height: 100, rotation: 0, opacity: 1 };
  if (type === 'text') return { ...base, name: '文本', text: '输入文本', width: 240, height: 58, fontSize: 24, fontWeight: 600, color: '#17191b', align: 'left' };
  if (type === 'button') return { ...base, name: '按钮', text: '按钮', width: 140, height: 44, fontSize: 14, fontWeight: 700, color: '#f7f4ec', fill: '#17191b', radius: 4, align: 'center' };
  if (type === 'circle') return { ...base, name: '圆形', width: 112, height: 112, fill: '#f0c93d', radius: 56 };
  if (type === 'image') return { ...base, name: '图片', width: 260, height: 180, src: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=640&q=85' };
  return { ...base, name: '矩形', fill: '#d9d5c8', radius: 8 };
};

export const useDesignStore = create<DesignState>((set, get) => ({
  documentName: 'Untitled / 001',
  layers: cloneLayers(starterLayers),
  selectedId: starterLayers.find((layer) => layer.name === '主标题')?.id ?? null,
  activeTool: 'select',
  viewport: { x: 0, y: 0, scale: 0.8 },
  theme: 'dusk',
  glassEnabled: true,
  templatesOpen: false,
  savedAt: '刚刚',
  setDocumentName: (documentName) => set({ documentName }),
  setLayers: (layers) => set({ layers }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setViewport: (viewport) => set({ viewport }),
  updateLayer: (id, patch) => set((state) => ({
    layers: state.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer),
    savedAt: '保存中…',
  })),
  addLayer: (type, x = 120, y = 120) => {
    const layer = newLayer(type, x, y);
    set((state) => ({ layers: [...state.layers, layer], selectedId: layer.id, activeTool: 'select', savedAt: '保存中…' }));
    return layer.id;
  },
  duplicateSelected: () => {
    const { selectedId } = get();
    if (!selectedId) return;
    set((state) => {
      const source = state.layers.find((layer) => layer.id === selectedId);
      if (!source) return state;
      const duplicate = { ...source, id: `layer-${Date.now()}`, name: `${source.name} copy`, x: source.x + 24, y: source.y + 24 };
      return { layers: [...state.layers, duplicate], selectedId: duplicate.id, savedAt: '保存中…' };
    });
  },
  deleteSelected: () => {
    const { selectedId } = get();
    if (!selectedId) return;
    set((state) => ({ layers: state.layers.filter((layer) => layer.id !== selectedId), selectedId: null, savedAt: '保存中…' }));
  },
  applyTemplate: (templateId) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const layers = cloneLayers(template.layers).map((layer) => ({ ...layer, id: `${templateId}-${layer.id}` }));
    set({ layers, selectedId: layers.find((layer) => layer.name === '主标题')?.id ?? layers[0]?.id ?? null, documentName: template.name, templatesOpen: false, savedAt: '保存中…' });
  },
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dusk' ? 'dawn' : 'dusk' })),
  toggleGlass: () => set((state) => ({ glassEnabled: !state.glassEnabled })),
  toggleTemplates: () => set((state) => ({ templatesOpen: !state.templatesOpen })),
  markSaved: () => set({ savedAt: `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` }),
}));

export const getSelectedLayer = (state: DesignState) => state.layers.find((layer) => layer.id === state.selectedId);
