import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ArtDocument, BrushPack, ColorPalette } from '../types/artStudio';
import type { AssetItem, PlaygroundProject } from '../types/roblox';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

void testConnection();

export function subscribeToAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(res.user);
  return res.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: (user.displayName || 'Creator').slice(0, 100),
        email: (user.email || 'user@example.com').slice(0, 200),
        photoURL: (user.photoURL || '').slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const prev = snap.data();
      await setDoc(ref, {
        uid: user.uid,
        displayName: (user.displayName || prev.displayName || 'Creator').slice(0, 100),
        email: prev.email || user.email || 'user@example.com',
        photoURL: (user.photoURL || prev.photoURL || '').slice(0, 500),
        createdAt: prev.createdAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ---- Cloud UI Workshop Projects ----
export interface CloudUIProjectSummary {
  id: string;
  name: string;
  version: string;
  activeScreenId: string;
  screens: PlaygroundProject['screens'];
  library: PlaygroundProject['library'];
  updatedAt?: unknown;
}

export async function saveUIProjectToCloud(project: PlaygroundProject, ownerId: string): Promise<void> {
  const safeId = sanitizeId(project.id);
  const path = `ui_projects/${safeId}`;
  try {
    const ref = doc(db, 'ui_projects', safeId);
    const existing = await getDoc(ref);
    const payload = {
      id: safeId,
      ownerId,
      name: (project.name || 'Untitled UI').slice(0, 120),
      version: (project.version || '1.0.0').slice(0, 32),
      activeScreenId: (project.activeScreenId || project.screens[0]?.id || 'screen_1').slice(0, 128),
      screens: project.screens.slice(0, 30),
      library: project.library.slice(0, 100),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function listUIProjectsFromCloud(ownerId: string): Promise<CloudUIProjectSummary[]> {
  const path = 'ui_projects';
  try {
    const q = query(collection(db, 'ui_projects'), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CloudUIProjectSummary);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeUIProjects(
  ownerId: string,
  onData: (items: CloudUIProjectSummary[]) => void
): Unsubscribe {
  const path = 'ui_projects';
  const q = query(collection(db, 'ui_projects'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as CloudUIProjectSummary));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// ---- Cloud Art Studio Documents (compact layer metadata + bounded preview thumbnail) ----
export interface CloudArtDocumentRecord {
  id: string;
  ownerId: string;
  title: string;
  width: number;
  height: number;
  dpi: number;
  backgroundColor: string;
  layers: Array<Omit<ArtDocument['layers'][number], 'rasterDataUrl' | 'maskDataUrl' | 'previewDataUrl'>>;
  palettes?: ColorPalette[];
  previewDataUrl?: string;
}

export async function saveArtDocumentToCloud(
  artDoc: ArtDocument,
  ownerId: string,
  palettes: ColorPalette[],
  previewDataUrl?: string
): Promise<void> {
  const safeId = sanitizeId(artDoc.id);
  const path = `art_documents/${safeId}`;
  try {
    const ref = doc(db, 'art_documents', safeId);
    const existing = await getDoc(ref);
    const compactLayers = artDoc.layers.slice(0, 64).map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      parentId: l.parentId,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blendMode: l.blendMode,
      alphaLock: l.alphaLock,
      clippingMask: l.clippingMask,
      maskEnabled: l.maskEnabled,
    }));

    const payload: Record<string, unknown> = {
      id: safeId,
      ownerId,
      title: (artDoc.title || 'Untitled Artwork').slice(0, 120),
      width: Math.max(16, Math.min(8192, Math.round(artDoc.width))),
      height: Math.max(16, Math.min(8192, Math.round(artDoc.height))),
      dpi: Math.max(72, Math.min(600, Math.round(artDoc.dpi))),
      backgroundColor: (artDoc.backgroundColor || '#FFFFFF').slice(0, 32),
      layers: compactLayers,
      palettes: palettes.slice(0, 40),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (previewDataUrl && previewDataUrl.length <= 390000) {
      payload.previewDataUrl = previewDataUrl;
    }
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeArtDocuments(
  ownerId: string,
  onData: (docs: CloudArtDocumentRecord[]) => void
): Unsubscribe {
  const path = 'art_documents';
  const q = query(collection(db, 'art_documents'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as CloudArtDocumentRecord));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// ---- Cloud Shared Assets ----
export async function saveSharedAssetToCloud(
  asset: AssetItem,
  ownerId: string,
  sourceApp: 'art_studio' | 'ui_workshop' | 'imported' = 'imported'
): Promise<boolean> {
  if (asset.dataUrl.length > 480000) {
    // Firestore rule maxLength is 500,000 bytes for dataUrl; keep oversized buffers local-only cleanly
    return false;
  }
  const safeId = sanitizeId(asset.id);
  const path = `shared_assets/${safeId}`;
  try {
    const ref = doc(db, 'shared_assets', safeId);
    const existing = await getDoc(ref);
    const payload: Record<string, unknown> = {
      id: safeId,
      ownerId,
      name: (asset.name || 'Asset').slice(0, 120),
      sourceApp,
      mimeType: (asset.mimeType || 'image/png').slice(0, 64),
      dataUrl: asset.dataUrl,
      width: Math.max(1, Math.min(8192, Math.round(asset.width || 64))),
      height: Math.max(1, Math.min(8192, Math.round(asset.height || 64))),
      isAtlas: Boolean(asset.isAtlas),
      sprites: (asset.sprites || []).slice(0, 256),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (asset.robloxAssetId) {
      payload.robloxAssetId = asset.robloxAssetId.slice(0, 64);
    }
    await setDoc(ref, payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSharedAssetFromCloud(assetId: string): Promise<void> {
  const safeId = sanitizeId(assetId);
  const path = `shared_assets/${safeId}`;
  try {
    await deleteDoc(doc(db, 'shared_assets', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeSharedAssets(
  ownerId: string,
  onData: (assets: AssetItem[]) => void
): Unsubscribe {
  const path = 'shared_assets';
  const q = query(collection(db, 'shared_assets'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          name: data.name,
          mimeType: data.mimeType,
          dataUrl: data.dataUrl,
          width: data.width,
          height: data.height,
          isAtlas: data.isAtlas,
          sprites: data.sprites ?? [],
          robloxAssetId: data.robloxAssetId,
        } as AssetItem;
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// ---- Cloud Brush Packs ----
export async function saveBrushPackToCloud(pack: BrushPack, ownerId: string): Promise<void> {
  const safeId = sanitizeId(pack.id);
  const path = `brush_packs/${safeId}`;
  try {
    const ref = doc(db, 'brush_packs', safeId);
    const existing = await getDoc(ref);
    await setDoc(ref, {
      id: safeId,
      ownerId,
      name: (pack.name || 'Custom Pack').slice(0, 100),
      folder: (pack.folder || 'Custom').slice(0, 64),
      formatVersion: (pack.formatVersion || '1.0').slice(0, 16),
      brushes: pack.brushes.slice(0, 100).map((b) => ({
        ...b,
        // Strip oversized embedded image tips if needed to keep doc lightweight
        tipImageDataUrl:
          b.tipImageDataUrl && b.tipImageDataUrl.length < 40000 ? b.tipImageDataUrl : undefined,
        textureImageDataUrl:
          b.textureImageDataUrl && b.textureImageDataUrl.length < 40000 ? b.textureImageDataUrl : undefined,
      })),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeBrushPacks(
  ownerId: string,
  onData: (packs: BrushPack[]) => void
): Unsubscribe {
  const path = 'brush_packs';
  const q = query(collection(db, 'brush_packs'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const packs = snap.docs.map((d) => {
        const data = d.data();
        return {
          formatVersion: '1.0',
          id: data.id,
          name: data.name,
          folder: data.folder,
          author: 'Cloud Sync',
          brushes: data.brushes ?? [],
          createdAt: new Date().toISOString(),
        } as BrushPack;
      });
      onData(packs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// ---- Tutorial Progress ----
export async function saveTutorialProgressToCloud(
  ownerId: string,
  completedLessonIds: string[]
): Promise<void> {
  const path = `tutorial_progress/${ownerId}`;
  try {
    await setDoc(doc(db, 'tutorial_progress', ownerId), {
      ownerId,
      completedLessonIds: completedLessonIds.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadTutorialProgressFromCloud(ownerId: string): Promise<string[]> {
  const path = `tutorial_progress/${ownerId}`;
  try {
    const snap = await getDoc(doc(db, 'tutorial_progress', ownerId));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.completedLessonIds) ? data.completedLessonIds : [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
