import type { ArtDocument, BrushPack, ColorPalette, GestureConfig } from '../types/artStudio';

const DB_NAME = 'studio_ecosystem_idb_v1';
const DB_VERSION = 1;
const STORE_ART_DOCS = 'art_documents';
const STORE_PREFS = 'preferences';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ART_DOCS)) {
        db.createObjectStore(STORE_ART_DOCS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PREFS)) {
        db.createObjectStore(STORE_PREFS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveArtDocumentLocal(doc: ArtDocument): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ART_DOCS, 'readwrite');
      tx.objectStore(STORE_ART_DOCS).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem('art_studio_active_doc_id', doc.id);
  } catch {
    // Fallback gracefully in restricted environments
  }
}

export async function loadArtDocumentLocal(id?: string): Promise<ArtDocument | null> {
  try {
    const db = await openDb();
    const targetId = id ?? localStorage.getItem('art_studio_active_doc_id');
    return await new Promise<ArtDocument | null>((resolve) => {
      const tx = db.transaction(STORE_ART_DOCS, 'readonly');
      const store = tx.objectStore(STORE_ART_DOCS);
      if (targetId) {
        const req = store.get(targetId);
        req.onsuccess = () => resolve((req.result as ArtDocument) ?? null);
        req.onerror = () => resolve(null);
      } else {
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result as ArtDocument[];
          resolve(all.length > 0 ? all[0] : null);
        };
        req.onerror = () => resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function listArtDocumentsLocal(): Promise<ArtDocument[]> {
  try {
    const db = await openDb();
    return await new Promise<ArtDocument[]>((resolve) => {
      const tx = db.transaction(STORE_ART_DOCS, 'readonly');
      const req = tx.objectStore(STORE_ART_DOCS).getAll();
      req.onsuccess = () => resolve((req.result as ArtDocument[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteArtDocumentLocal(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_ART_DOCS, 'readwrite');
      tx.objectStore(STORE_ART_DOCS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export function saveSharedBrushPacksLocal(packs: BrushPack[]): void {
  try {
    localStorage.setItem('studio_brush_packs_v1', JSON.stringify(packs));
  } catch {
    // ignore
  }
}

export function loadSharedBrushPacksLocal(): BrushPack[] | null {
  try {
    const raw = localStorage.getItem('studio_brush_packs_v1');
    return raw ? (JSON.parse(raw) as BrushPack[]) : null;
  } catch {
    return null;
  }
}

export function saveSharedPalettesLocal(palettes: ColorPalette[]): void {
  try {
    localStorage.setItem('studio_palettes_v1', JSON.stringify(palettes));
  } catch {
    // ignore
  }
}

export function loadSharedPalettesLocal(): ColorPalette[] | null {
  try {
    const raw = localStorage.getItem('studio_palettes_v1');
    return raw ? (JSON.parse(raw) as ColorPalette[]) : null;
  } catch {
    return null;
  }
}

export function saveGestureConfigLocal(cfg: GestureConfig): void {
  try {
    localStorage.setItem('art_studio_gestures_v1', JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export function loadGestureConfigLocal(): GestureConfig {
  const defaults: GestureConfig = {
    oneFingerMode: 'draw',
    twoFingerTapUndo: true,
    threeFingerTapRedo: true,
    pinchToZoom: true,
    twoFingerRotate: true,
    stylusOnlyDraw: false,
  };
  try {
    const raw = localStorage.getItem('art_studio_gestures_v1');
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<GestureConfig>) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveCompletedTutorialsLocal(ids: string[]): void {
  try {
    localStorage.setItem('studio_completed_tutorials_v1', JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function loadCompletedTutorialsLocal(): string[] {
  try {
    const raw = localStorage.getItem('studio_completed_tutorials_v1');
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function savePreferenceIdb(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_PREFS, 'readwrite');
      tx.objectStore(STORE_PREFS).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}
