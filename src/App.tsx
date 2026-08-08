import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowRight,
  BoxSelect,
  Check,
  ChevronRight,
  ChevronDown,
  Circle,
  Copy,
  FileCode2,
  FileArchive,
  FileImage,
  Hand,
  ImagePlus,
  Layers3,
  Library,
  Maximize2,
  Minus,
  Moon,
  MousePointer2,
  Move,
  PanelRight,
  Plus,
  Redo2,
  Scan,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { templates } from './data/templates';
import { buildHtmlString, buildZip, downloadBlob, downloadText, stylesFromLayer } from './lib/export';
import { fitViewport, screenToWorld, zoomAt, type Point } from './lib/viewport';
import { loadWorkspace, saveCanvas, saveProject, saveSettings } from './lib/storage';
import { getSelectedLayer, useDesignStore } from './store/useDesignStore';
import type { CanvasDocument, Layer, LayerType, Project } from './types/design';
import './styles.css';

const AB_WIDTH = 1280;
const AB_HEIGHT = 800;

type Tool = 'select' | 'hand' | LayerType;
type PointerAction =
  | { kind: 'pan'; start: Point; origin: Point }
  | { kind: 'drag'; start: Point; origins: Record<string, Point>; ids: string[] }
  | { kind: 'marquee'; start: Point; current: Point };

const toolItems: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: '选择', icon: MousePointer2 },
  { id: 'hand', label: '平移', icon: Hand },
  { id: 'rect', label: '矩形', icon: BoxSelect },
  { id: 'circle', label: '圆形', icon: Circle },
  { id: 'text', label: '文本', icon: Type },
  { id: 'image', label: '图片', icon: ImagePlus },
  { id: 'button', label: '按钮', icon: Zap },
];

const layerTypeLabel: Record<Layer['type'], string> = {
  rect: '矩形', circle: '圆形', text: '文本', image: '图片', button: '按钮',
};

const formatNumber = (value: number | undefined) => Math.round(value ?? 0);
const isArtboardBackground = (layer: Layer) => layer.x === 0 && layer.y === 0 && layer.width === AB_WIDTH && layer.height === AB_HEIGHT;
const selectableLayers = (items: Layer[]) => items.filter((layer) => !isArtboardBackground(layer));

function App() {
  const {
    projects, canvases, activeProjectId, activeCanvasId, documentName, layers, selectedIds, activeTool, viewport,
    theme, glassEnabled, templatesOpen, clipboard, hydrated, savedAt,
    hydrateWorkspace, setDocumentName, setSelectedId, setSelectedIds, setActiveTool, setViewport, updateLayer,
    addLayer, duplicateSelected, copySelected, pasteClipboard, deleteSelected, selectAll, applyTemplate,
    createProject, createCanvas, switchProject, switchCanvas, renameProject, renameCanvas, toggleTheme, toggleGlass,
    toggleTemplates, markSaved,
  } = useDesignStore();
  const selectedLayer = useDesignStore(getSelectedLayer);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const viewportRef = useRef<HTMLElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pointerAction = useRef<PointerAction | null>(null);
  const spacePressed = useRef(false);
  const workspaceLoadStarted = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [marquee, setMarquee] = useState<{ start: Point; current: Point } | null>(null);
  const marqueeJustFinished = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const fit = useCallback(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;
    setViewport(fitViewport(viewportElement.clientWidth, viewportElement.clientHeight, AB_WIDTH, AB_HEIGHT));
  }, [setViewport]);

  useEffect(() => {
    if (workspaceLoadStarted.current) return;
    workspaceLoadStarted.current = true;
    loadWorkspace().then((workspace) => {
      hydrateWorkspace(workspace);
      window.setTimeout(() => notify('已从 IndexedDB 恢复工作区'), 0);
    }).catch(() => {
      window.setTimeout(() => notify('本地存储不可用，当前使用临时工作区'), 0);
    }).finally(() => fit());
    fit();
  // Fit is intentionally called once after the first viewport exists.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId);
    const activeProject = projects.find((project) => project.id === activeProjectId);
    if (!activeCanvas || !activeProject) return;
    const timer = window.setTimeout(() => {
      Promise.all([
        ...canvases.map((canvas) => saveCanvas(canvas.id === activeCanvasId ? { ...canvas, name: documentName, layers, viewport } : canvas)),
        ...projects.map((project) => saveProject(project)),
        saveSettings({ theme, glassEnabled }),
      ]).then(() => markSaved()).catch(() => undefined);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeCanvasId, activeProjectId, canvases, documentName, glassEnabled, hydrated, layers, markSaved, projects, theme, viewport]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressed.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressed.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (!editing && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        deleteSelected();
      }
      if (!editing && event.key.toLowerCase() === 'd' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        duplicateSelected();
      }
      if (!editing && event.key.toLowerCase() === 'c' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        copySelected();
      }
      if (!editing && event.key.toLowerCase() === 'v' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        pasteClipboard();
      }
      if (!editing && event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        selectAll();
      }
      if (!editing && event.key.toLowerCase() === 't') setActiveTool('text');
      if (!editing && event.key.toLowerCase() === 'v' && !event.metaKey && !event.ctrlKey) setActiveTool('select');
      if (!editing && event.key === 'Escape') {
        setSelectedId(null);
        setActiveTool('select');
      }
      if (event.key === '?' && !editing) setShowShortcuts((value) => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copySelected, deleteSelected, duplicateSelected, pasteClipboard, selectAll, setActiveTool, setSelectedId]);

  const handleViewportWheel = (event: React.WheelEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (event.ctrlKey || event.metaKey) {
      setViewport(zoomAt(point, Math.exp(-event.deltaY * 0.008), viewport));
      return;
    }
    setViewport({ ...viewport, x: viewport.x - event.deltaX, y: viewport.y - event.deltaY });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const viewportElement = event.currentTarget;
    if ((event.target as HTMLElement).closest('[data-canvas-ui]')) return;
    const rect = viewportElement.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const layerElement = (event.target as HTMLElement).closest<HTMLElement>('[data-layer-id]');
    const layerId = layerElement?.dataset.layerId;
    const layer = layerId ? layers.find((item) => item.id === layerId) : undefined;
    const selectableLayer = layer && !isArtboardBackground(layer) ? layer : undefined;
    const shouldPan = activeTool === 'hand' || event.button === 1 || spacePressed.current;

    if (selectableLayer && activeTool === 'select' && event.button === 0) {
      const ids = event.shiftKey
        ? selectedIds.includes(selectableLayer.id) ? selectedIds : [...selectedIds, selectableLayer.id]
        : selectedIds.includes(selectableLayer.id) ? selectedIds : [selectableLayer.id];
      setSelectedIds(ids);
      const origins = Object.fromEntries(layers.filter((item) => ids.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }]));
      pointerAction.current = { kind: 'drag', start: point, origins, ids };
    } else if (shouldPan) {
      pointerAction.current = { kind: 'pan', start: point, origin: { x: viewport.x, y: viewport.y } };
    } else if (!selectableLayer && activeTool === 'select') {
      pointerAction.current = { kind: 'marquee', start: point, current: point };
      setMarquee({ start: point, current: point });
    } else if (!selectableLayer && ['rect', 'circle', 'text', 'button'].includes(activeTool)) {
      const world = screenToWorld(point, viewport);
      addLayer(activeTool as LayerType, Math.max(24, Math.round(world.x - 90)), Math.max(24, Math.round(world.y - 40)));
      return;
    } else if (!selectableLayer && activeTool === 'image') {
      fileInputRef.current?.click();
      return;
    } else {
      return;
    }
    viewportElement.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const action = pointerAction.current;
    if (!action) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const delta = { x: point.x - action.start.x, y: point.y - action.start.y };
    if (action.kind === 'pan') {
      setViewport({ ...viewport, x: action.origin.x + delta.x, y: action.origin.y + delta.y });
    } else if (action.kind === 'drag') {
      action.ids.forEach((id) => {
        const origin = action.origins[id];
        if (origin) updateLayer(id, {
          x: Math.round(origin.x + delta.x / viewport.scale),
          y: Math.round(origin.y + delta.y / viewport.scale),
        });
      });
    } else {
      action.current = point;
      setMarquee({ start: action.start, current: point });
    }
  };

  const stopPointerAction = (event: ReactPointerEvent<HTMLElement>) => {
    const action = pointerAction.current;
    if (action?.kind === 'marquee') {
      const left = Math.min(action.start.x, action.current.x);
      const right = Math.max(action.start.x, action.current.x);
      const top = Math.min(action.start.y, action.current.y);
      const bottom = Math.max(action.start.y, action.current.y);
      const selection = selectableLayers(layers).filter((layer) => {
        const x = viewport.x + layer.x * viewport.scale;
        const y = viewport.y + layer.y * viewport.scale;
        const layerRight = x + layer.width * viewport.scale;
        const layerBottom = y + layer.height * viewport.scale;
        return x < right && layerRight > left && y < bottom && layerBottom > top;
      }).map((layer) => layer.id);
      setSelectedIds(selection);
      setMarquee(null);
      marqueeJustFinished.current = true;
      window.setTimeout(() => { marqueeJustFinished.current = false; }, 0);
    }
    pointerAction.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer was already released */ }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (marqueeJustFinished.current) return;
    if (event.target !== event.currentTarget) return;
    setSelectedIds([]);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageName = file.name.replace(/\.[^/.]+$/, '');
      if (selectedLayer?.type === 'image') {
        updateLayer(selectedLayer.id, { name: imageName, src: String(reader.result) });
      } else {
        const id = addLayer('image', 180, 160);
        updateLayer(id, { name: imageName, src: String(reader.result) });
      }
      notify('图片已加入画板');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const exportPng = async () => {
    if (!artboardRef.current) return;
    notify('正在生成 2x PNG…');
    artboardRef.current.classList.add('is-exporting');
    try {
      const dataUrl = await toPng(artboardRef.current, { pixelRatio: 2, cacheBust: true });
      const response = await fetch(dataUrl);
      downloadBlob(await response.blob(), `${documentName}.png`);
      notify('PNG 已下载');
    } catch {
      notify('PNG 导出失败，请稍后重试');
    } finally {
      artboardRef.current?.classList.remove('is-exporting');
    }
  };

  const exportHtml = () => {
    downloadText(buildHtmlString(layers, documentName), `${documentName}.html`);
    notify('HTML 已下载');
  };

  const exportZip = async () => {
    notify('正在整理资源包…');
    try {
      downloadBlob(await buildZip(layers, documentName), `${documentName}.zip`);
      notify('ZIP 资源包已下载');
    } catch {
      notify('ZIP 导出失败，请稍后重试');
    }
  };

  const zoomBy = (factor: number) => {
    const element = viewportRef.current;
    if (!element) return;
    setViewport(zoomAt({ x: element.clientWidth / 2, y: element.clientHeight / 2 }, factor, viewport));
  };

  return (
    <div className={`app-shell ${theme === 'dawn' ? 'theme-dawn' : 'theme-dusk'} ${glassEnabled ? '' : 'no-glass'}`}>
      <header className="topbar glass-panel">
        <button className="brand-lockup" onClick={() => setNavigatorOpen((value) => !value)} title="打开项目与画布" aria-label="打开项目与画布">
          <div className="brand-mark"><img src="/logo.png" alt="" /></div>
          <div className="brand-copy">
            <strong>GlassStudio</strong>
            <span>DESIGN TO DELIVER</span>
          </div>
          <ChevronDown className="brand-chevron" size={13} />
        </button>
        <div className="document-meta">
          <div className="document-name-row">
            <input aria-label="设计名称" value={documentName} onChange={(event) => setDocumentName(event.target.value)} />
            <span className="status-dot" title="本地自动保存" />
          </div>
          <span className="document-subtitle">{activeProject?.name ?? '未命名项目'} <span>/</span> {layers.length} layers</span>
        </div>
        <div className="topbar-spacer" />
        <div className="history-controls" aria-label="历史记录">
          <button className="icon-button muted" title="撤销（即将支持）" aria-label="撤销"><Undo2 size={16} /></button>
          <button className="icon-button muted" title="重做（即将支持）" aria-label="重做"><Redo2 size={16} /></button>
        </div>
        <ZoomControl scale={viewport.scale} zoomBy={zoomBy} fit={fit} />
        <div className="top-actions">
          <button className="icon-button" onClick={toggleGlass} title={glassEnabled ? '关闭毛玻璃增强' : '开启毛玻璃增强'} aria-label="切换毛玻璃"><Scan size={16} /></button>
          <button className="icon-button" onClick={toggleTheme} title={theme === 'dusk' ? '切换晨间模式' : '切换昏暗模式'} aria-label="切换主题">{theme === 'dusk' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button className="help-button" onClick={() => setShowShortcuts((value) => !value)} aria-label="打开快捷键"><span>?</span><kbd>⌘ /</kbd></button>
          <div className="export-quick-actions">
            <button className="quick-export" onClick={exportPng} title="导出 2x PNG"><FileImage size={13} /> <span>PNG</span></button>
            <button className="quick-export" onClick={exportHtml} title="导出独立 HTML"><FileCode2 size={13} /> <span>HTML</span></button>
          </div>
          <button className="export-main" onClick={exportZip}><FileArchive size={15} /> <span>导出资源包</span> <ChevronDown size={13} /></button>
        </div>
        {navigatorOpen && <WorkspaceNavigator
          projects={projects}
          canvases={canvases}
          activeProjectId={activeProjectId}
          activeCanvasId={activeCanvasId}
          onClose={() => setNavigatorOpen(false)}
          onNewProject={() => { createProject(); notify('已创建新项目'); }}
          onNewCanvas={() => { createCanvas(); notify('已创建新画布'); }}
          onDuplicateCanvas={() => { createCanvas(`${documentName} copy`, true); notify('已复制当前画布'); }}
          onProjectSelect={(id) => { switchProject(id); }}
          onCanvasSelect={(id) => { switchCanvas(id); setNavigatorOpen(false); }}
          onRenameProject={renameProject}
          onRenameCanvas={renameCanvas}
        />}
      </header>

      <div className="workspace">
        <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} toggleTemplates={toggleTemplates} />
        <section
          ref={viewportRef}
          className={`canvas-viewport ${activeTool === 'hand' ? 'is-hand' : ''}`}
          onWheel={handleViewportWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPointerAction}
          onPointerCancel={stopPointerAction}
          aria-label="设计画布"
        >
          <div className="canvas-toolbar glass-panel" data-canvas-ui>
            <span className="canvas-mode"><span className="live-indicator" /> LIVE CANVAS</span>
            <span className="canvas-divider" />
            <span className="canvas-hint">按住空格拖动</span>
          </div>
          <div
            className="world"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
          >
            <div ref={artboardRef} className="artboard" onClick={handleCanvasClick}>
              <div className="artboard-ruler ruler-top"><span>0</span><span>320</span><span>640</span><span>960</span><span>1280</span></div>
              <div className="artboard-ruler ruler-left"><span>0</span><span>200</span><span>400</span><span>600</span><span>800</span></div>
              {layers.map((layer) => (
                <CanvasLayer key={layer.id} layer={layer} selected={selectedIds.includes(layer.id)} />
              ))}
            </div>
          </div>
          {marquee && <SelectionMarquee start={marquee.start} current={marquee.current} />}
          <div className="canvas-footer glass-panel" data-canvas-ui>
            <span><Move size={13} /> <b>{Math.round(viewport.scale * 100)}%</b></span>
            <span className="canvas-footer-divider" />
            <span>1280 × 800 px</span>
            <button onClick={fit} title="适配画板" aria-label="适配画板"><Maximize2 size={13} /></button>
          </div>
          {templatesOpen && <TemplateRail onClose={toggleTemplates} applyTemplate={applyTemplate} />}
        </section>
        <Inspector layer={selectedLayer} selectedCount={selectedIds.length} updateLayer={updateLayer} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCopy={copySelected} onPaste={pasteClipboard} canPaste={clipboard.length > 0} />
      </div>

      <footer className="statusbar glass-panel">
        <div className="status-left"><span className="status-ready"><Check size={12} /> {savedAt}</span><span className="status-separator" /><span><Layers3 size={12} /> {layers.length} 个图层</span><span className="status-separator" /><span>{projects.length} 项目 / {canvases.filter((canvas) => canvas.projectId === activeProjectId).length} 画布</span></div>
        <div className="status-center"><span className="status-key">SPACE</span> 平移画布 <span className="status-key">⌘ C / ⌘ V</span> 复制粘贴</div>
        <div className="status-right"><span className="local-badge"><span /> INDEXEDDB</span><span className="build-label">v0.1.0</span></div>
      </footer>

      <input ref={fileInputRef} onChange={handleFileChange} type="file" accept="image/*" hidden />
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

function ZoomControl({ scale, zoomBy, fit }: { scale: number; zoomBy: (factor: number) => void; fit: () => void }) {
  return (
    <div className="zoom-control" aria-label="缩放控制">
      <button onClick={() => zoomBy(0.9)} title="缩小" aria-label="缩小"><Minus size={14} /></button>
      <button className="zoom-value" onClick={fit} title="适配画板">{Math.round(scale * 100)}%</button>
      <button onClick={() => zoomBy(1.1)} title="放大" aria-label="放大"><Plus size={14} /></button>
    </div>
  );
}

function Toolbar({ activeTool, setActiveTool, toggleTemplates }: { activeTool: Tool; setActiveTool: (tool: Tool) => void; toggleTemplates: () => void }) {
  return (
    <aside className="left-toolbar glass-panel" aria-label="工具栏">
      <div className="toolbar-group">
        <span className="toolbar-label">CREATE</span>
        {toolItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tool-button ${activeTool === id ? 'is-active' : ''}`} onClick={() => setActiveTool(id)} title={label} aria-label={label}>
            <Icon size={18} strokeWidth={activeTool === id ? 2.3 : 1.7} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-bottom">
        <div className="toolbar-rule" />
        <button className="tool-button" onClick={toggleTemplates} title="打开模板库" aria-label="打开模板库"><Layers3 size={18} /><span>模板</span></button>
        <button className="tool-button" title="工作台设置" aria-label="工作台设置"><Settings2 size={18} /><span>设置</span></button>
      </div>
    </aside>
  );
}

function CanvasLayer({ layer, selected }: { layer: Layer; selected: boolean }) {
  const style = stylesFromLayer(layer);
  const className = `canvas-layer layer-${layer.type} ${selected ? 'is-selected' : ''}`;
  if (layer.type === 'image') {
    return <img data-layer-id={layer.id} className={className} style={style as CSSProperties} src={layer.src} alt={layer.name} draggable={false} />;
  }
  return <div data-layer-id={layer.id} className={className} style={style as CSSProperties}>{layer.text}</div>;
}

function SelectionMarquee({ start, current }: { start: Point; current: Point }) {
  return <div className="selection-marquee" data-canvas-ui style={{ left: Math.min(start.x, current.x), top: Math.min(start.y, current.y), width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) }} />;
}

function WorkspaceNavigator({
  projects, canvases, activeProjectId, activeCanvasId, onClose, onNewProject, onNewCanvas, onDuplicateCanvas,
  onProjectSelect, onCanvasSelect, onRenameProject, onRenameCanvas,
}: {
  projects: Project[];
  canvases: CanvasDocument[];
  activeProjectId: string;
  activeCanvasId: string;
  onClose: () => void;
  onNewProject: () => void;
  onNewCanvas: () => void;
  onDuplicateCanvas: () => void;
  onProjectSelect: (id: string) => void;
  onCanvasSelect: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onRenameCanvas: (id: string, name: string) => void;
}) {
  return <div className="workspace-navigator glass-panel" onClick={(event) => event.stopPropagation()}>
    <div className="navigator-heading">
      <div><span className="eyebrow">WORKSPACE</span><h2>项目与画布</h2></div>
      <button className="icon-button small" onClick={onClose} title="关闭项目导航" aria-label="关闭项目导航"><X size={15} /></button>
    </div>
    <div className="navigator-actions">
      <button className="navigator-primary" onClick={onNewProject}><Plus size={14} /> 新建项目</button>
      <button className="navigator-secondary" onClick={onNewCanvas}><Plus size={14} /> 新建画布</button>
    </div>
    <div className="navigator-list">
      {projects.map((project) => {
        const projectCanvases = canvases.filter((canvas) => canvas.projectId === project.id);
        return <section className={`project-entry ${activeProjectId === project.id ? 'is-active' : ''}`} key={project.id}>
          <div className="project-row">
            <button className="project-select-button" onClick={() => onProjectSelect(project.id)} title="切换项目" aria-label={`切换到${project.name}`}><Library size={14} /><ChevronRight size={13} /></button>
            <input aria-label="项目名称" value={project.name} onChange={(event) => onRenameProject(project.id, event.target.value)} onBlur={(event) => onRenameProject(project.id, event.target.value)} />
          </div>
          <div className="canvas-list">
            {projectCanvases.map((canvas) => <div className={`canvas-entry ${activeCanvasId === canvas.id ? 'is-active' : ''}`} key={canvas.id}>
              <button className="canvas-select-button" onClick={() => onCanvasSelect(canvas.id)} title="切换画布" aria-label={`切换到${canvas.name}`}><span className="canvas-entry-mark" /></button>
              <input className="canvas-name-input" aria-label="画布名称" value={canvas.name} onChange={(event) => onRenameCanvas(canvas.id, event.target.value)} onClick={(event) => event.stopPropagation()} onBlur={(event) => onRenameCanvas(canvas.id, event.target.value)} />
              {activeCanvasId === canvas.id && <button className="canvas-duplicate-button" onClick={onDuplicateCanvas} title="复制当前画布" aria-label="复制当前画布"><Copy size={12} /></button>}
            </div>)}
          </div>
        </section>;
      })}
    </div>
    <p className="navigator-note">所有项目、画布与剪贴板内容均保存在此设备。</p>
  </div>;
}

function Inspector({ layer, selectedCount, updateLayer, onDelete, onDuplicate, onCopy, onPaste, canPaste }: { layer?: Layer; selectedCount: number; updateLayer: (id: string, patch: Partial<Layer>) => void; onDelete: () => void; onDuplicate: () => void; onCopy: () => void; onPaste: () => void; canPaste: boolean }) {
  if (!layer) {
    return <aside className="inspector glass-panel empty-inspector"><div className="panel-heading"><div><span className="eyebrow">INSPECTOR</span><h2>属性检查器</h2></div><PanelRight size={16} /></div><div className="empty-state"><div className="empty-icon"><BoxSelect size={20} /></div><strong>{selectedCount > 1 ? `已选择 ${selectedCount} 个图层` : '选择一个图层'}</strong><p>{selectedCount > 1 ? '使用 ⌘ C / ⌘ V 复制粘贴选中的对象。' : '点击画布中的对象，编辑它的位置、尺寸和视觉样式。'}</p></div><div className="inspector-note"><Sparkles size={14} /><span>拖动画布空白处，可以框选多个对象。</span></div></aside>;
  }
  const numeric = (key: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'fontSize', label: string, suffix = '') => (
    <label className="field"><span>{label}</span><div className="field-input"><input type="number" value={key === 'opacity' ? Math.round((layer[key] ?? 1) * 100) : formatNumber(layer[key])} min={key === 'opacity' ? 0 : undefined} max={key === 'opacity' ? 100 : undefined} onChange={(event) => updateLayer(layer.id, { [key]: key === 'opacity' ? Number(event.target.value) / 100 : Number(event.target.value) })} /><em>{suffix}</em></div></label>
  );
  return (
    <aside className="inspector glass-panel">
      <div className="panel-heading"><div><span className="eyebrow">INSPECTOR / {layerTypeLabel[layer.type]}</span><h2>{layer.name}</h2></div><button className="icon-button small" onClick={onDelete} title="删除图层" aria-label="删除图层"><Trash2 size={15} /></button></div>
      <div className="inspector-scroll">
        {selectedCount > 1 && <div className="selection-summary"><BoxSelect size={14} /><strong>已选择 {selectedCount} 个图层</strong></div>}
        <section className="inspector-section"><span className="section-label">布局 / LAYOUT</span><div className="field-grid">{numeric('x', 'X', 'px')}{numeric('y', 'Y', 'px')}{numeric('width', 'W', 'px')}{numeric('height', 'H', 'px')}</div><div className="field-grid">{numeric('rotation', '旋转', '°')}{numeric('opacity', '不透明', '%')}</div></section>
        {(layer.type === 'rect' || layer.type === 'circle' || layer.type === 'button') && <section className="inspector-section"><span className="section-label">外观 / APPEARANCE</span><ColorField label="填充" value={layer.fill ?? '#17191b'} onChange={(fill) => updateLayer(layer.id, { fill })} /><div className="field-grid single-line">{<label className="field"><span>圆角</span><div className="field-input"><input type="number" min="0" value={formatNumber(layer.radius)} onChange={(event) => updateLayer(layer.id, { radius: Number(event.target.value) })} /><em>px</em></div></label>}<label className="toggle-field"><input type="checkbox" checked={Boolean(layer.blur)} onChange={(event) => updateLayer(layer.id, { blur: event.target.checked })} /><span className="fake-toggle" /><span>玻璃效果</span></label></div></section>}
        {(layer.type === 'text' || layer.type === 'button') && <section className="inspector-section"><span className="section-label">排版 / TYPE</span><label className="field full-field"><span>内容</span><textarea value={layer.text ?? ''} onChange={(event) => updateLayer(layer.id, { text: event.target.value })} rows={3} /></label><ColorField label="文字颜色" value={layer.color ?? '#17191b'} onChange={(color) => updateLayer(layer.id, { color })} /><div className="field-grid">{numeric('fontSize', '字号', 'px')}<label className="field"><span>字重</span><div className="field-input"><select value={layer.fontWeight ?? 500} onChange={(event) => updateLayer(layer.id, { fontWeight: Number(event.target.value) })}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option></select></div></label></div></section>}
        {layer.type === 'image' && <section className="inspector-section"><span className="section-label">资源 / ASSET</span><div className="asset-preview"><img src={layer.src} alt="" /></div><button className="secondary-button" onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()}><ImagePlus size={14} /> 更换图片</button></section>}
        <section className="inspector-section action-section"><button className="secondary-button" onClick={onCopy}><Copy size={14} /> 复制选中 <span>⌘ C</span></button><button className="secondary-button" onClick={onPaste} disabled={!canPaste}><ChevronRight size={14} /> 粘贴图层 <span>⌘ V</span></button><button className="secondary-button" onClick={onDuplicate}><Copy size={14} /> 快速复制 <span>⌘ D</span></button><button className="danger-button" onClick={onDelete}><Trash2 size={14} /> 删除选中</button></section>
      </div>
    </aside>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><div className="color-control"><input type="color" value={value.startsWith('#') ? value : '#ffffff'} onChange={(event) => onChange(event.target.value)} /><input value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${label}色值`} /></div></label>;
}

function TemplateRail({ onClose, applyTemplate }: { onClose: () => void; applyTemplate: (id: string) => void }) {
  return <div className="template-rail glass-panel" data-canvas-ui><div className="template-rail-heading"><div><span className="eyebrow">STARTING POINTS</span><h2>模板库</h2></div><button className="icon-button small" onClick={onClose} title="关闭模板库" aria-label="关闭模板库"><X size={15} /></button></div><div className="template-grid">{templates.map((template) => <button className="template-card" key={template.id} onClick={() => applyTemplate(template.id)}><TemplatePreview templateId={template.id} accent={template.accent} /><div className="template-card-copy"><span>{template.category}</span><strong>{template.name}</strong><p>{template.description}</p><ArrowRight size={14} /></div></button>)}</div></div>;
}

function TemplatePreview({ templateId, accent }: { templateId: string; accent: string }) {
  return <div className={`template-preview preview-${templateId}`} style={{ '--preview-accent': accent } as CSSProperties}><span className="preview-line line-a" /><span className="preview-line line-b" /><span className="preview-shape shape-a" /><span className="preview-shape shape-b" /><span className="preview-shape shape-c" /></div>;
}

function Shortcuts({ onClose }: { onClose: () => void }) {
  return <div className="shortcut-overlay" onClick={onClose}><div className="shortcut-dialog glass-panel" onClick={(event) => event.stopPropagation()}><div className="dialog-heading"><div><span className="eyebrow">KEYBOARD MAP</span><h2>快捷键</h2></div><button className="icon-button small" onClick={onClose} aria-label="关闭"><X size={15} /></button></div><div className="shortcut-list"><Shortcut label="选择工具" keys={['V']} /><Shortcut label="文本工具" keys={['T']} /><Shortcut label="复制选中" keys={['⌘', 'C']} /><Shortcut label="粘贴图层" keys={['⌘', 'V']} /><Shortcut label="快速复制" keys={['⌘', 'D']} /><Shortcut label="全选图层" keys={['⌘', 'A']} /><Shortcut label="删除选中" keys={['⌫']} /><Shortcut label="取消选择" keys={['ESC']} /><Shortcut label="框选对象" keys={['拖动空白处']} /><Shortcut label="平移画布" keys={['SPACE', '拖动']} /></div></div></div>;
}

function Shortcut({ label, keys }: { label: string; keys: string[] }) {
  return <div className="shortcut-row"><span>{label}</span><div>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</div></div>;
}

export default App;
