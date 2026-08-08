import { starterLayers } from '../data/templates';
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../types/design';
import type { CanvasDocument, Layer, Project, WorkspaceSettings } from '../types/design';

const DB_NAME = 'glassstudio-workspace';
const DB_VERSION = 1;
const SETTINGS_KEY = 'workspace';
const CLIPBOARD_KEY = 'layers';

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

const writeRecord = async (storeName: string, value: unknown) => {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const completion = transactionToPromise(transaction);
  transaction.objectStore(storeName).put(value);
  await completion;
  database.close();
};

const deleteRecord = async (storeName: string, key: string) => {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  const completion = transactionToPromise(transaction);
  transaction.objectStore(storeName).delete(key);
  await completion;
  database.close();
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

  if (projects.length > 0 && canvases.length > 0) {
    return {
      projects,
      canvases: canvases.map((canvas) => ({ ...canvas, width: canvas.width ?? DEFAULT_CANVAS_WIDTH, height: canvas.height ?? DEFAULT_CANVAS_HEIGHT })),
      settings: settingsRecord?.value,
      clipboard: clipboardRecord?.value ?? [],
    };
  }

  const legacyDraft = readLegacyDraft();
  const now = new Date().toISOString();
  const project: Project = { id: `project-${Date.now()}`, name: '我的第一个项目', createdAt: now, updatedAt: now };
  const canvas: CanvasDocument = {
    id: `canvas-${Date.now()}`,
    projectId: project.id,
    name: legacyDraft?.documentName ?? '首张画布',
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
    layers: Array.isArray(legacyDraft?.layers) ? legacyDraft.layers : starterLayers.map((layer) => ({ ...layer })),
    viewport: { x: 0, y: 0, scale: 0.8 },
    createdAt: now,
    updatedAt: now,
  };
  const seeded = { projects: [project], canvases: [canvas], settings: settingsRecord?.value, clipboard: clipboardRecord?.value ?? [] };
  await Promise.all([saveProject(project), saveCanvas(canvas)]);
  return seeded;
};

export const saveProject = (project: Project) => writeRecord('projects', project);
export const saveCanvas = (canvas: CanvasDocument) => writeRecord('canvases', canvas);
export const removeCanvas = (id: string) => deleteRecord('canvases', id);
export const saveSettings = (settings: WorkspaceSettings) => writeRecord('settings', { key: SETTINGS_KEY, value: settings });
export const saveClipboard = (layers: Layer[]) => writeRecord('clipboard', { key: CLIPBOARD_KEY, value: layers });
