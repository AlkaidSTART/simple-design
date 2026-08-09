import { starterLayers } from '../data/templates';
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../types/design';
import type { CanvasDocument, Layer, Project, WorkspaceSettings } from '../types/design';

const DB_NAME = 'glassstudio-workspace';
const DB_VERSION = 1;
const SETTINGS_KEY = 'workspace';
const CLIPBOARD_KEY = 'layers';

let writeQueue = Promise.resolve();

export interface WorkspaceData {
  projects: Project[];
  canvases: CanvasDocument[];
  settings?: WorkspaceSettings;
  clipboard: Layer[];
}

const transactionToPromise = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
});

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB is unavailable in this browser'));
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects', { keyPath: 'id' });
    if (!database.objectStoreNames.contains('canvases')) database.createObjectStore('canvases', { keyPath: 'id' });
    if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings', { keyPath: 'key' });
    if (!database.objectStoreNames.contains('clipboard')) database.createObjectStore('clipboard', { keyPath: 'key' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
});

const readStore = async <T,>(database: IDBDatabase, storeName: string) => {
  return new Promise<T[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
};

const readRecord = async <T,>(database: IDBDatabase, storeName: string, key: string) => {
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
};

const enqueueWrite = <T,>(operation: () => Promise<T>) => {
  const queuedOperation = writeQueue.then(operation, operation);
  writeQueue = queuedOperation.then(() => undefined, () => undefined);
  return queuedOperation;
};

const writeRecord = (storeName: string, value: unknown) => enqueueWrite(async () => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    const completion = transactionToPromise(transaction);
    transaction.objectStore(storeName).put(value);
    await completion;
  } finally {
    database.close();
  }
});

const deleteRecord = (storeName: string, key: string) => enqueueWrite(async () => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    const completion = transactionToPromise(transaction);
    transaction.objectStore(storeName).delete(key);
    await completion;
  } finally {
    database.close();
  }
});

const createWorkspaceProject = (timestamp: string): Project => ({
  id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '我的第一个项目',
  createdAt: timestamp,
  updatedAt: timestamp,
});

const createWorkspaceCanvas = (projectId: string, timestamp: string, layers = starterLayers): CanvasDocument => ({
  id: `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  projectId,
  name: '首张画布',
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
  layers: layers.map((layer) => ({ ...layer })),
  viewport: { x: 0, y: 0, scale: 0.8 },
  createdAt: timestamp,
  updatedAt: timestamp,
});

const normalizeWorkspaceRecords = (projects: Project[], canvases: CanvasDocument[]) => {
  const timestamp = new Date().toISOString();
  const nextProjects = projects.length > 0 ? projects : [createWorkspaceProject(timestamp)];
  const projectIds = new Set(nextProjects.map((project) => project.id));
  const projectWithCanvas = nextProjects.find((project) => canvases.some((canvas) => canvas.projectId === project.id));
  const fallbackProjectId = projectWithCanvas?.id ?? nextProjects[0].id;
  const normalizedCanvases = canvases.length > 0
    ? canvases.map((canvas) => ({
      ...canvas,
      projectId: projectIds.has(canvas.projectId) ? canvas.projectId : fallbackProjectId,
      width: canvas.width ?? DEFAULT_CANVAS_WIDTH,
      height: canvas.height ?? DEFAULT_CANVAS_HEIGHT,
      layers: Array.isArray(canvas.layers) ? canvas.layers : [],
      viewport: canvas.viewport ?? { x: 0, y: 0, scale: 0.8 },
    }))
    : [createWorkspaceCanvas(fallbackProjectId, timestamp)];
  const projectsWithCanvas = new Set(normalizedCanvases.map((canvas) => canvas.projectId));
  const missingProjectCanvases = nextProjects
    .filter((project) => !projectsWithCanvas.has(project.id))
    .map((project) => createWorkspaceCanvas(project.id, timestamp));
  const nextCanvases = [...normalizedCanvases, ...missingProjectCanvases];

  return {
    projects: nextProjects,
    canvases: nextCanvases,
    needsRepair: projects.length === 0
      || canvases.length === 0
      || nextCanvases.some((canvas, index) => {
        const source = canvases[index];
        return canvas.projectId !== source?.projectId
          || canvas.width !== source?.width
          || canvas.height !== source?.height
          || canvas.layers !== source?.layers
          || canvas.viewport !== source?.viewport;
      })
      || missingProjectCanvases.length > 0,
  };
};

const readLegacyDraft = (): { documentName?: string; layers?: Layer[] } | undefined => {
  try {
    const rawDraft = localStorage.getItem('glassstudio-draft-v1');
    return rawDraft ? JSON.parse(rawDraft) as { documentName?: string; layers?: Layer[] } : undefined;
  } catch {
    return undefined;
  }
};

export const loadWorkspace = async (): Promise<WorkspaceData> => {
  const database = await openDatabase();
  const [projects, canvases, settingsRecord, clipboardRecord] = await Promise.all([
    readStore<Project>(database, 'projects'),
    readStore<CanvasDocument>(database, 'canvases'),
    readRecord<{ key: string; value: WorkspaceSettings }>(database, 'settings', SETTINGS_KEY),
    readRecord<{ key: string; value: Layer[] }>(database, 'clipboard', CLIPBOARD_KEY),
  ]);
  database.close();

  if (projects.length > 0 || canvases.length > 0) {
    const normalized = normalizeWorkspaceRecords(projects, canvases);
    if (normalized.needsRepair) await saveWorkspace(normalized.projects, normalized.canvases).catch(() => undefined);
    return { ...normalized, settings: settingsRecord?.value, clipboard: clipboardRecord?.value ?? [] };
  }

  const legacyDraft = readLegacyDraft();
  const now = new Date().toISOString();
  const project: Project = createWorkspaceProject(now);
  const canvas: CanvasDocument = {
    ...createWorkspaceCanvas(project.id, now, Array.isArray(legacyDraft?.layers) ? legacyDraft.layers : starterLayers),
    name: legacyDraft?.documentName ?? '首张画布',
  };
  const seeded = { projects: [project], canvases: [canvas], settings: settingsRecord?.value, clipboard: clipboardRecord?.value ?? [] };
  await saveWorkspace(seeded.projects, seeded.canvases);
  return seeded;
};

export const saveProject = (project: Project) => writeRecord('projects', project);
export const saveCanvas = (canvas: CanvasDocument) => writeRecord('canvases', canvas);
export const saveWorkspace = (projects: Project[], canvases: CanvasDocument[]) => enqueueWrite(async () => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(['projects', 'canvases'], 'readwrite');
    const completion = transactionToPromise(transaction);
    const projectStore = transaction.objectStore('projects');
    const canvasStore = transaction.objectStore('canvases');
    projects.forEach((project) => projectStore.put(project));
    canvases.forEach((canvas) => canvasStore.put(canvas));
    await completion;
  } finally {
    database.close();
  }
});
export const removeCanvas = (id: string) => deleteRecord('canvases', id);
export const saveSettings = (settings: WorkspaceSettings) => writeRecord('settings', { key: SETTINGS_KEY, value: settings });
export const saveClipboard = (layers: Layer[]) => writeRecord('clipboard', { key: CLIPBOARD_KEY, value: layers });
