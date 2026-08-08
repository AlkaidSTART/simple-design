import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowRight,
  BoxSelect,
  Check,
  ChevronRight,
  ChevronDown,
  Circle,
  Copy,
  Download,
  FileCode2,
  FileArchive,
  FileImage,
  Hand,
  ImagePlus,
  Layers3,
  Library,
  Minus,
  MousePointer2,
  Move,
  PanelRight,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Type,
  X,
  Zap,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { templates } from './data/templates';
import { buildHtmlString, buildZip, downloadBlob, downloadText, stylesFromLayer } from './lib/export';
import { fitViewport, pinchViewport, screenToWorld, zoomAt, type PinchPoints, type Point } from './lib/viewport';
import { loadWorkspace, saveCanvas, saveProject, saveSettings } from './lib/storage';
import { getSelectedLayer, useDesignStore } from './store/useDesignStore';
import { brushPointsToLocal, pointsToSvg } from './lib/brush';
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, type CanvasDocument, type DesignTool, type DrawPoint, type Layer, type LayerType, type Project, type ViewportState } from './types/design';
import './styles.css';

type Tool = DesignTool;
type PointerAction =
  | { kind: 'pan'; start: Point; origin: Point }
  | { kind: 'drag'; start: Point; origins: Record<string, Point>; ids: string[] }
  | { kind: 'marquee'; start: Point; current: Point }
  | { kind: 'brush'; points: DrawPoint[] };

type TouchGesture = { start: PinchPoints; viewport: ViewportState };

const toolItems: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'brush', label: '画笔', icon: Pencil },
  { id: 'select', label: '选择', icon: MousePointer2 },
  { id: 'hand', label: '平移', icon: Hand },
  { id: 'rect', label: '矩形', icon: BoxSelect },
  { id: 'circle', label: '圆形', icon: Circle },
  { id: 'text', label: '文本', icon: Type },
  { id: 'image', label: '图片', icon: ImagePlus },
  { id: 'button', label: '按钮', icon: Zap },
];

const layerTypeLabel: Record<Layer['type'], string> = {
  rect: '矩形', circle: '圆形', text: '文本', image: '图片', button: '按钮', brush: '画笔',
};

const formatNumber = (value: number | undefined) => Math.round(value ?? 0);
const isArtboardBackground = (layer: Layer, width: number, height: number) => layer.type === 'rect' && layer.x === 0 && layer.y === 0 && layer.width === width && layer.height === height;
const selectableLayers = (items: Layer[], width: number, height: number) => items.filter((layer) => !isArtboardBackground(layer, width, height));
const clampPoint = (point: Point, width: number, height: number): DrawPoint => ({
  x: Math.min(width, Math.max(0, point.x)),
  y: Math.min(height, Math.max(0, point.y)),
});

const getPinchPoints = (pointers: Map<number, Point>): PinchPoints | null => {
  const points = [...pointers.values()];
  if (points.length < 2) return null;
  return { first: points[0], second: points[1] };
};

function App() {
  const {
    projects, canvases, activeProjectId, activeCanvasId, documentName, layers, selectedIds, activeTool, viewport,
    theme, glassEnabled, templatesOpen, clipboard, hydrated, savedAt,
    hydrateWorkspace, setDocumentName, setSelectedId, setSelectedIds, setActiveTool, setViewport, updateLayer,
    addLayer, addBrush, setCanvasSize, duplicateSelected, copySelected, pasteClipboard, deleteSelected, selectAll, applyTemplate,
    createProject, createCanvas, switchProject, switchCanvas, renameProject, renameCanvas,
    toggleTemplates, markSaved,
  } = useDesignStore();
  const selectedLayer = useDesignStore(getSelectedLayer);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeCanvas = canvases.find((canvas) => canvas.id === activeCanvasId) ?? canvases[0];
  const canvasWidth = activeCanvas?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = activeCanvas?.height ?? DEFAULT_CANVAS_HEIGHT;
  const viewportRef = useRef<HTMLElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pointerAction = useRef<PointerAction | null>(null);
  const touchPointers = useRef(new Map<number, Point>());
  const touchGesture = useRef<TouchGesture | null>(null);
  const touchGestureConsumed = useRef(false);
  const spacePressed = useRef(false);
  const workspaceLoadStarted = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [createDialog, setCreateDialog] = useState<'project' | 'canvas' | null>(null);
  const [marquee, setMarquee] = useState<{ start: Point; current: Point } | null>(null);
  const [brushPreview, setBrushPreview] = useState<DrawPoint[] | null>(null);
  const marqueeJustFinished = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const fit = useCallback(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;
    setViewport(fitViewport(viewportElement.clientWidth, viewportElement.clientHeight, canvasWidth, canvasHeight));
  }, [canvasHeight, canvasWidth, setViewport]);

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
    const activeProject = projects.find((project) => project.id === activeProjectId);
    if (!activeCanvas || !activeProject) return;
    const timer = window.setTimeout(() => {
      Promise.all([
        ...canvases.map((canvas) => saveCanvas(canvas.id === activeCanvasId ? { ...canvas, name: documentName, layers, viewport } : canvas)),
        ...projects.map((project) => saveProject(project)),
        saveSettings({ theme, glassEnabled, activeTool }),
      ]).then(() => markSaved()).catch(() => undefined);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeCanvas, activeCanvasId, activeProjectId, activeTool, canvases, documentName, glassEnabled, hydrated, layers, markSaved, projects, theme, viewport]);

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
    if (hydrated) fit();
  }, [canvasHeight, canvasWidth, fit, hydrated]);

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
        setExportMenuOpen(false);
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
      event.preventDefault();
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
    const isTouch = event.pointerType === 'touch';

    if (isTouch) {
      touchPointers.current.set(event.pointerId, point);
      if (touchPointers.current.size >= 2) {
        const pinch = getPinchPoints(touchPointers.current);
        if (pinch) {
          touchGesture.current = { start: pinch, viewport };
          touchGestureConsumed.current = true;
          pointerAction.current = null;
          setMarquee(null);
          setBrushPreview(null);
          event.preventDefault();
          viewportElement.setPointerCapture(event.pointerId);
          return;
        }
      } else {
        touchGestureConsumed.current = false;
      }
    }

    const layerElement = (event.target as HTMLElement).closest<HTMLElement>('[data-layer-id]');
    const layerId = layerElement?.dataset.layerId;
    const layer = layerId ? layers.find((item) => item.id === layerId) : undefined;
    const selectableLayer = layer && !isArtboardBackground(layer, canvasWidth, canvasHeight) ? layer : undefined;
    const shouldPan = activeTool === 'hand' || event.button === 1 || spacePressed.current;

    if (activeTool === 'brush' && event.button === 0) {
      const world = screenToWorld(point, viewport);
      if (world.x < 0 || world.y < 0 || world.x > canvasWidth || world.y > canvasHeight) return;
      const brushPoint = clampPoint(world, canvasWidth, canvasHeight);
      setSelectedIds([]);
      pointerAction.current = { kind: 'brush', points: [brushPoint] };
      setBrushPreview([brushPoint]);
    } else if (selectableLayer && activeTool === 'select' && event.button === 0) {
      const ids = event.shiftKey
        ? selectedIds.includes(selectableLayer.id) ? selectedIds : [...selectedIds, selectableLayer.id]
        : selectedIds.includes(selectableLayer.id) ? selectedIds : [selectableLayer.id];
      setSelectedIds(ids);
      const origins = Object.fromEntries(layers.filter((item) => ids.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }]));
      pointerAction.current = { kind: 'drag', start: point, origins, ids };
    } else if (shouldPan || (isTouch && !selectableLayer && activeTool === 'select')) {
      pointerAction.current = { kind: 'pan', start: point, origin: { x: viewport.x, y: viewport.y } };
    } else if (!selectableLayer && activeTool === 'select' && !isTouch) {
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
    if (isTouch) event.preventDefault();
    viewportElement.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (event.pointerType === 'touch') {
      touchPointers.current.set(event.pointerId, point);
      const gesture = touchGesture.current;
      const pinch = getPinchPoints(touchPointers.current);
      if (gesture && pinch) {
        setViewport(pinchViewport(gesture.start, pinch, gesture.viewport));
        event.preventDefault();
        return;
      }
      if (touchGestureConsumed.current) return;
      event.preventDefault();
    }
    const action = pointerAction.current;
    if (!action) return;
    if (action.kind === 'pan') {
      const delta = { x: point.x - action.start.x, y: point.y - action.start.y };
      setViewport({ ...viewport, x: action.origin.x + delta.x, y: action.origin.y + delta.y });
    } else if (action.kind === 'drag') {
      const delta = { x: point.x - action.start.x, y: point.y - action.start.y };
      action.ids.forEach((id) => {
        const origin = action.origins[id];
        if (origin) updateLayer(id, {
          x: Math.round(origin.x + delta.x / viewport.scale),
          y: Math.round(origin.y + delta.y / viewport.scale),
        });
      });
    } else if (action.kind === 'marquee') {
      action.current = point;
      setMarquee({ start: action.start, current: point });
    } else if (action.kind === 'brush') {
      const world = screenToWorld(point, viewport);
      const nextPoint = clampPoint(world, canvasWidth, canvasHeight);
      const previousPoint = action.points[action.points.length - 1];
      if (!previousPoint || Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y) >= 1) {
        action.points.push(nextPoint);
        setBrushPreview([...action.points]);
      }
    }
  };

  const stopPointerAction = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') {
      touchPointers.current.delete(event.pointerId);
      if (touchGesture.current) {
        touchGesture.current = null;
        pointerAction.current = null;
        setMarquee(null);
        setBrushPreview(null);
        touchGestureConsumed.current = true;
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer was already released */ }
        if (touchPointers.current.size === 0) touchGestureConsumed.current = false;
        return;
      }
      if (touchGestureConsumed.current) {
        pointerAction.current = null;
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer was already released */ }
        if (touchPointers.current.size === 0) touchGestureConsumed.current = false;
        return;
      }
    }
    const action = pointerAction.current;
    if (action?.kind === 'marquee') {
      const left = Math.min(action.start.x, action.current.x);
      const right = Math.max(action.start.x, action.current.x);
      const top = Math.min(action.start.y, action.current.y);
      const bottom = Math.max(action.start.y, action.current.y);
      const selection = selectableLayers(layers, canvasWidth, canvasHeight).filter((layer) => {
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
    if (action?.kind === 'brush' && event.type !== 'pointercancel') {
      addBrush(action.points);
      setBrushPreview(null);
      marqueeJustFinished.current = true;
      window.setTimeout(() => { marqueeJustFinished.current = false; }, 0);
    }
    if (action?.kind === 'brush' && event.type === 'pointercancel') setBrushPreview(null);
    pointerAction.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer was already released */ }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (marqueeJustFinished.current) return;
    if (event.target !== event.currentTarget) return;
    setSelectedIds([]);
  };

  const handleViewportDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!['select', 'hand'].includes(activeTool) || (event.target as HTMLElement).closest('[data-canvas-ui]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setViewport(zoomAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, 1.4, viewport));
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
    downloadText(buildHtmlString(layers, documentName, canvasWidth, canvasHeight), `${documentName}.html`);
    notify('HTML 已下载');
  };

  const exportZip = async () => {
    notify('正在整理资源包…');
    try {
      downloadBlob(await buildZip(layers, documentName, canvasWidth, canvasHeight), `${documentName}.zip`);
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
    <div className={`app-shell ${theme === 'liquid' ? 'theme-liquid' : 'theme-ivory'}`}>
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
        <div className="top-actions">
          <button className="help-button" onClick={() => setShowShortcuts((value) => !value)} aria-label="打开快捷键"><span>?</span><kbd>⌘ /</kbd></button>
          <div className="export-menu-wrap">
            <button className="export-main" onClick={() => setExportMenuOpen((value) => !value)} aria-expanded={exportMenuOpen} aria-haspopup="menu"><Download size={15} /> <span>导出</span> <ChevronDown size={13} /></button>
            {exportMenuOpen && <div className="export-menu glass-panel" data-canvas-ui role="menu">
              <button onClick={() => { setExportMenuOpen(false); void exportPng(); }} role="menuitem"><FileImage size={15} /><span><strong>PNG 图片</strong><small>2x 高清画布</small></span></button>
              <button onClick={() => { setExportMenuOpen(false); exportHtml(); }} role="menuitem"><FileCode2 size={15} /><span><strong>HTML 页面</strong><small>可直接打开的网页</small></span></button>
              <button onClick={() => { setExportMenuOpen(false); void exportZip(); }} role="menuitem"><FileArchive size={15} /><span><strong>资源包</strong><small>HTML 与图片资源</small></span></button>
            </div>}
          </div>
        </div>
        {navigatorOpen && <WorkspaceNavigator
          projects={projects}
          canvases={canvases}
          activeProjectId={activeProjectId}
          activeCanvasId={activeCanvasId}
          onClose={() => setNavigatorOpen(false)}
          onNewProject={() => setCreateDialog('project')}
          onNewCanvas={() => setCreateDialog('canvas')}
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
          onDoubleClick={handleViewportDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPointerAction}
          onPointerCancel={stopPointerAction}
          aria-label="设计画布"
        >
          <div className="canvas-toolbar glass-panel" data-canvas-ui>
            <span className="canvas-mode"><span className="live-indicator" /> 画布</span>
            <span className="canvas-divider" />
            <span className="canvas-hint">正在编辑</span>
          </div>
          <div className="canvas-zoom glass-panel" data-canvas-ui>
            <ZoomControl scale={viewport.scale} zoomBy={zoomBy} fit={fit} />
          </div>
          <div
            className="world"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
          >
            <div ref={artboardRef} className="artboard" onClick={handleCanvasClick} style={{ width: canvasWidth, height: canvasHeight }}>
              <div className="artboard-ruler ruler-top"><span>0</span><span>{Math.round(canvasWidth / 4)}</span><span>{Math.round(canvasWidth / 2)}</span><span>{Math.round(canvasWidth * 0.75)}</span><span>{canvasWidth}</span></div>
              <div className="artboard-ruler ruler-left"><span>0</span><span>{Math.round(canvasHeight / 4)}</span><span>{Math.round(canvasHeight / 2)}</span><span>{Math.round(canvasHeight * 0.75)}</span><span>{canvasHeight}</span></div>
              {layers.map((layer) => (
                <CanvasLayer key={layer.id} layer={layer} selected={selectedIds.includes(layer.id)} />
              ))}
              {brushPreview && <BrushStroke points={brushPreview} preview canvasWidth={canvasWidth} canvasHeight={canvasHeight} />}
            </div>
          </div>
          {marquee && <SelectionMarquee start={marquee.start} current={marquee.current} />}
          <div className="canvas-footer glass-panel" data-canvas-ui>
            <span><Move size={13} /> <b>画布</b></span>
            <span className="canvas-footer-divider" />
            <span>{canvasWidth} × {canvasHeight} px</span>
          </div>
          <ExportReminder />
          {templatesOpen && <TemplateRail onClose={toggleTemplates} applyTemplate={applyTemplate} />}
        </section>
        <Inspector layer={selectedLayer} selectedCount={selectedIds.length} updateLayer={updateLayer} canvasWidth={canvasWidth} canvasHeight={canvasHeight} onCanvasSizeChange={setCanvasSize} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCopy={copySelected} onPaste={pasteClipboard} canPaste={clipboard.length > 0} />
      </div>

      <footer className="statusbar glass-panel">
        <div className="status-left"><span className="status-ready"><Check size={12} /> {savedAt}</span><span className="status-separator" /><span><Layers3 size={12} /> {layers.length} 个图层</span><span className="status-separator" /><span>{projects.length} 项目 / {canvases.filter((canvas) => canvas.projectId === activeProjectId).length} 画布</span></div>
        <div className="status-center"><span className="status-key">SPACE</span> 平移画布 <span className="status-key">⌘ C / ⌘ V</span> 复制粘贴</div>
        <div className="status-right"><span className="local-badge"><span /> INDEXEDDB</span><span className="build-label">v0.1.0</span></div>
      </footer>

      <input ref={fileInputRef} onChange={handleFileChange} type="file" accept="image/*" hidden />
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
      {createDialog && <CreateDialog type={createDialog} onClose={() => setCreateDialog(null)} onCreate={(name, width, height) => {
        if (createDialog === 'project') createProject(name, width, height);
        else createCanvas(name, false, width, height);
        setCreateDialog(null);
        notify(createDialog === 'project' ? '已创建自定义项目' : '已创建自定义画布');
      }} />}
    </div>
  );
}

function ZoomControl({ scale, zoomBy, fit }: { scale: number; zoomBy: (factor: number) => void; fit: () => void }) {
  return (
    <div className="zoom-control" aria-label="画布缩放">
      <button onClick={() => zoomBy(0.9)} title="缩小画布" aria-label="缩小画布"><Minus size={14} /></button>
      <button className="zoom-value" onClick={fit} title="适配画布" aria-label={`当前画布缩放 ${Math.round(scale * 100)}%，点击适配画布`}>{Math.round(scale * 100)}%</button>
      <button onClick={() => zoomBy(1.1)} title="放大画布" aria-label="放大画布"><Plus size={14} /></button>
    </div>
  );
}

function ExportReminder() {
  return <div className="export-reminder" data-canvas-ui role="note" aria-label="完成设计后，记得及时导出">
    <div className="export-reminder-window">
      <div className="export-reminder-track">
        <ExportReminderItems />
        <ExportReminderItems ariaHidden />
      </div>
    </div>
  </div>;
}

function ExportReminderItems({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return <div className="export-reminder-items" aria-hidden={ariaHidden}>
    <span><Download size={13} strokeWidth={2.2} />完成设计后，记得及时导出</span>
    <i />
    <span>完成设计后，记得及时导出</span>
    <i />
    <span>完成设计后，记得及时导出</span>
  </div>;
}

function Toolbar({ activeTool, setActiveTool, toggleTemplates }: { activeTool: Tool; setActiveTool: (tool: Tool) => void; toggleTemplates: () => void }) {
  return (
    <aside className="left-toolbar glass-panel" aria-label="工具栏" role="toolbar">
      <div className="toolbar-group toolbar-navigation">
        <span className="toolbar-label">编辑</span>
        {toolItems.filter(({ id }) => id === 'select' || id === 'hand').map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tool-button ${activeTool === id ? 'is-active' : ''}`} onClick={() => setActiveTool(id)} title={label} aria-label={label}>
            <Icon size={18} strokeWidth={activeTool === id ? 2.3 : 1.7} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-group toolbar-create">
        <span className="toolbar-label">添加</span>
        {toolItems.filter(({ id }) => id !== 'select' && id !== 'hand').map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tool-button ${activeTool === id ? 'is-active' : ''}`} onClick={() => setActiveTool(id)} title={label} aria-label={label}>
            <Icon size={18} strokeWidth={activeTool === id ? 2.3 : 1.7} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-bottom">
        <div className="toolbar-rule" />
        <button className="tool-button" onClick={toggleTemplates} title="打开模板库" aria-label="打开模板库"><Layers3 size={18} /><span>模板</span></button>
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
  if (layer.type === 'brush') return <BrushStroke layer={layer} selected={selected} />;
  return <div data-layer-id={layer.id} className={className} style={style as CSSProperties}>{layer.text}</div>;
}

function BrushStroke({ layer, points, preview, selected = false, canvasWidth = 1, canvasHeight = 1 }: { layer?: Layer; points?: DrawPoint[]; preview?: boolean; selected?: boolean; canvasWidth?: number; canvasHeight?: number }) {
  const localPoints = layer ? brushPointsToLocal(layer) : points ?? [];
  const style = layer ? stylesFromLayer(layer) : { left: 0, top: 0, width: '100%', height: '100%' };
  return <svg
    data-layer-id={layer?.id}
    className={`canvas-layer layer-brush ${selected ? 'is-selected' : ''} ${preview ? 'brush-preview' : ''}`}
    style={style as CSSProperties}
    viewBox={`0 0 ${layer ? Math.max(layer.width, 1) : canvasWidth} ${layer ? Math.max(layer.height, 1) : canvasHeight}`}
    preserveAspectRatio="none"
    aria-label={layer?.name ?? '正在绘制'}
  >
    <polyline points={pointsToSvg(localPoints)} fill="none" stroke={layer?.stroke ?? '#315f59'} strokeWidth={layer?.strokeWidth ?? 8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
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

function Inspector({ layer, selectedCount, updateLayer, canvasWidth, canvasHeight, onCanvasSizeChange, onDelete, onDuplicate, onCopy, onPaste, canPaste }: { layer?: Layer; selectedCount: number; updateLayer: (id: string, patch: Partial<Layer>) => void; canvasWidth: number; canvasHeight: number; onCanvasSizeChange: (width: number, height: number) => void; onDelete: () => void; onDuplicate: () => void; onCopy: () => void; onPaste: () => void; canPaste: boolean }) {
  if (!layer) {
    return <aside className="inspector glass-panel empty-inspector"><div className="panel-heading"><div><span className="eyebrow">INSPECTOR</span><h2>属性检查器</h2></div><PanelRight size={16} /></div><div className="inspector-scroll"><CanvasSizeFields key={`${canvasWidth}-${canvasHeight}`} width={canvasWidth} height={canvasHeight} onChange={onCanvasSizeChange} /><div className="empty-state"><div className="empty-icon"><BoxSelect size={20} /></div><strong>{selectedCount > 1 ? `已选择 ${selectedCount} 个图层` : '选择一个图层'}</strong><p>{selectedCount > 1 ? '使用 ⌘ C / ⌘ V 复制粘贴选中的对象。' : '点击画布中的对象，编辑它的位置、尺寸和视觉样式。'}</p></div><div className="inspector-note"><Sparkles size={14} /><span>拖动画布空白处，可以框选多个对象。</span></div></div></aside>;
  }
  const numeric = (key: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'fontSize' | 'strokeWidth', label: string, suffix = '') => (
    <label className="field"><span>{label}</span><div className="field-input"><input type="number" value={key === 'opacity' ? Math.round((layer[key] ?? 1) * 100) : formatNumber(layer[key])} min={key === 'opacity' ? 0 : undefined} max={key === 'opacity' ? 100 : undefined} onChange={(event) => updateLayer(layer.id, { [key]: key === 'opacity' ? Number(event.target.value) / 100 : Number(event.target.value) })} /><em>{suffix}</em></div></label>
  );
  return (
    <aside className="inspector glass-panel">
      <div className="panel-heading"><div><span className="eyebrow">INSPECTOR / {layerTypeLabel[layer.type]}</span><h2>{layer.name}</h2></div><button className="icon-button small" onClick={onDelete} title="删除图层" aria-label="删除图层"><Trash2 size={15} /></button></div>
      <div className="inspector-scroll">
        <CanvasSizeFields key={`${canvasWidth}-${canvasHeight}`} width={canvasWidth} height={canvasHeight} onChange={onCanvasSizeChange} />
        {selectedCount > 1 && <div className="selection-summary"><BoxSelect size={14} /><strong>已选择 {selectedCount} 个图层</strong></div>}
        <section className="inspector-section"><span className="section-label">布局 / LAYOUT</span><div className="field-grid">{numeric('x', 'X', 'px')}{numeric('y', 'Y', 'px')}{numeric('width', 'W', 'px')}{numeric('height', 'H', 'px')}</div><div className="field-grid">{numeric('rotation', '旋转', '°')}{numeric('opacity', '不透明', '%')}</div></section>
        {(layer.type === 'rect' || layer.type === 'circle' || layer.type === 'button') && <section className="inspector-section"><span className="section-label">外观 / APPEARANCE</span><ColorField label="填充" value={layer.fill ?? '#17191b'} onChange={(fill) => updateLayer(layer.id, { fill })} /><div className="field-grid single-line">{<label className="field"><span>圆角</span><div className="field-input"><input type="number" min="0" value={formatNumber(layer.radius)} onChange={(event) => updateLayer(layer.id, { radius: Number(event.target.value) })} /><em>px</em></div></label>}<label className="toggle-field"><input type="checkbox" checked={Boolean(layer.blur)} onChange={(event) => updateLayer(layer.id, { blur: event.target.checked })} /><span className="fake-toggle" /><span>玻璃效果</span></label></div></section>}
        {(layer.type === 'text' || layer.type === 'button') && <section className="inspector-section"><span className="section-label">排版 / TYPE</span><label className="field full-field"><span>内容</span><textarea value={layer.text ?? ''} onChange={(event) => updateLayer(layer.id, { text: event.target.value })} rows={3} /></label><ColorField label="文字颜色" value={layer.color ?? '#17191b'} onChange={(color) => updateLayer(layer.id, { color })} /><div className="field-grid">{numeric('fontSize', '字号', 'px')}<label className="field"><span>字重</span><div className="field-input"><select value={layer.fontWeight ?? 500} onChange={(event) => updateLayer(layer.id, { fontWeight: Number(event.target.value) })}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option></select></div></label></div></section>}
        {layer.type === 'brush' && <section className="inspector-section"><span className="section-label">画笔 / BRUSH</span><ColorField label="笔触颜色" value={layer.stroke ?? '#315f59'} onChange={(stroke) => updateLayer(layer.id, { stroke })} />{numeric('strokeWidth', '笔触粗细', 'px')}</section>}
        {layer.type === 'image' && <section className="inspector-section"><span className="section-label">资源 / ASSET</span><div className="asset-preview"><img src={layer.src} alt="" /></div><button className="secondary-button" onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()}><ImagePlus size={14} /> 更换图片</button></section>}
        <section className="inspector-section action-section"><button className="secondary-button" onClick={onCopy}><Copy size={14} /> 复制选中 <span>⌘ C</span></button><button className="secondary-button" onClick={onPaste} disabled={!canPaste}><ChevronRight size={14} /> 粘贴图层 <span>⌘ V</span></button><button className="secondary-button" onClick={onDuplicate}><Copy size={14} /> 快速复制 <span>⌘ D</span></button><button className="danger-button" onClick={onDelete}><Trash2 size={14} /> 删除选中</button></section>
      </div>
    </aside>
  );
}

function CanvasSizeFields({ width, height, onChange }: { width: number; height: number; onChange: (width: number, height: number) => void }) {
  const [nextWidth, setNextWidth] = useState(width);
  const [nextHeight, setNextHeight] = useState(height);
  const commit = () => onChange(nextWidth, nextHeight);
  return <section className="inspector-section canvas-size-section"><span className="section-label">画布 / CANVAS</span><div className="field-grid"><label className="field"><span>宽度</span><div className="field-input"><input type="number" min="240" max="4096" value={nextWidth} onChange={(event) => setNextWidth(Number(event.target.value))} onBlur={commit} /><em>px</em></div></label><label className="field"><span>高度</span><div className="field-input"><input type="number" min="160" max="4096" value={nextHeight} onChange={(event) => setNextHeight(Number(event.target.value))} onBlur={commit} /><em>px</em></div></label></div><span className="canvas-size-caption">{width} × {height} · 可随时调整</span></section>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><div className="color-control"><input type="color" value={value.startsWith('#') ? value : '#ffffff'} onChange={(event) => onChange(event.target.value)} /><input value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${label}色值`} /></div></label>;
}

function CreateDialog({ type, onClose, onCreate }: { type: 'project' | 'canvas'; onClose: () => void; onCreate: (name: string, width: number, height: number) => void }) {
  const [name, setName] = useState(type === 'project' ? '新项目' : '新画布');
  const [width, setWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [height, setHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onCreate(name.trim() || (type === 'project' ? '新项目' : '新画布'), width, height);
  };
  return <div className="dialog-overlay" onClick={onClose}>
    <form className="create-dialog glass-panel" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
      <div className="dialog-heading"><div><span className="eyebrow">NEW {type === 'project' ? 'PROJECT' : 'CANVAS'}</span><h2>{type === 'project' ? '新建项目' : '新建画布'}</h2></div><button type="button" className="icon-button small" onClick={onClose} title="关闭" aria-label="关闭"><X size={15} /></button></div>
      <div className="create-dialog-fields">
        <label className="field full-field"><span>名称</span><div className="field-input"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></div></label>
        <div className="field-grid"><label className="field"><span>宽度</span><div className="field-input"><input type="number" min="240" max="4096" required value={width} onChange={(event) => setWidth(Number(event.target.value))} /><em>px</em></div></label><label className="field"><span>高度</span><div className="field-input"><input type="number" min="160" max="4096" required value={height} onChange={(event) => setHeight(Number(event.target.value))} /><em>px</em></div></label></div>
      </div>
      <div className="create-dialog-actions"><button type="button" className="navigator-secondary" onClick={onClose}>取消</button><button type="submit" className="navigator-primary"><Plus size={14} /> 创建</button></div>
    </form>
  </div>;
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
