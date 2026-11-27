import React from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Brush,
  Cloud,
  Download,
  FilePlus2,
  FolderOpen,
  Grid3X3,
  LayoutGrid,
  Magnet,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  AssetItem,
  ComponentStateName,
  EditorWorkspaceTab,
  PlaygroundProject,
  SavedComponentTemplate,
  ScreenArtboard,
  ToolType,
  UIElement,
} from './types/roblox';
import type {
  ArtDocument,
  BrushConfig,
  BrushPack,
  ColorPalette,
  GestureConfig,
  WorkspaceAppMode,
} from './types/artStudio';
import { createStarterProject } from './data/starterProject';
import {
  cloneDeep,
  collectDescendants,
  createElement,
  createId,
  enableInteractiveComponent,
  getScreenById,
  reorderElementZIndex,
} from './utils/projectLogic';
import { LeftToolbarAndLayers } from './components/LeftToolbarAndLayers';
import { DesignCanvas } from './components/DesignCanvas';
import { PropertiesInspector } from './components/PropertiesInspector';
import { StateTimelinePanel } from './components/StateTimelinePanel';
import { PreviewMode } from './components/PreviewMode';
import { EventEditor } from './components/EventEditor';
import { AssetManager } from './components/AssetManager';
import { ComponentLibrary } from './components/ComponentLibrary';
import { RobloxExportView } from './components/RobloxExportView';
import { ArtStudioWorkspace } from './components/art/ArtStudioWorkspace';
import { CloudAccountModal } from './components/CloudAccountModal';
import { TutorialAcademyDrawer } from './components/academy/TutorialAcademyDrawer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ArtCanvasEngine, createBlankArtDocument } from './engine/ArtCanvasEngine';
import { DEFAULT_BRUSH_PACK, DEFAULT_PALETTES } from './engine/brushPresets';
import {
  loadArtDocumentLocal,
  loadCompletedTutorialsLocal,
  loadGestureConfigLocal,
  loadSharedBrushPacksLocal,
  loadSharedPalettesLocal,
  saveArtDocumentLocal,
  saveCompletedTutorialsLocal,
  saveGestureConfigLocal,
  saveSharedBrushPacksLocal,
  saveSharedPalettesLocal,
} from './utils/indexedDbStorage';
import {
  loadTutorialProgressFromCloud,
  saveArtDocumentToCloud,
  saveBrushPackToCloud,
  saveSharedAssetToCloud,
  saveTutorialProgressToCloud,
  saveUIProjectToCloud,
  signInWithGoogle,
  signOutAccount,
  subscribeArtDocuments,
  subscribeBrushPacks,
  subscribeSharedAssets,
  subscribeToAuth,
  subscribeUIProjects,
  type CloudArtDocumentRecord,
  type CloudUIProjectSummary,
} from './services/firebase';

const STORAGE_KEY = 'roblox_ui_playground_project_v1';

function loadInitialProject(): PlaygroundProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlaygroundProject;
      if (parsed && Array.isArray(parsed.screens) && parsed.screens.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return createStarterProject();
}

export default function App() {
  // Active Ecosystem Application ('ui_workshop' | 'art_studio')
  const [activeApp, setActiveApp] = React.useState<WorkspaceAppMode>('ui_workshop');

  // UI Workshop State
  const [project, setProject] = React.useState<PlaygroundProject>(loadInitialProject);
  const [historyPast, setHistoryPast] = React.useState<PlaygroundProject[]>([]);
  const [historyFuture, setHistoryFuture] = React.useState<PlaygroundProject[]>([]);

  const [activeTab, setActiveTab] = React.useState<EditorWorkspaceTab>('design');
  const [activeTool, setActiveTool] = React.useState<ToolType>('select');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [editingState, setEditingState] = React.useState<ComponentStateName>('idle');
  const [clipboard, setClipboard] = React.useState<UIElement[]>([]);
  const [focusedEventElId, setFocusedEventElId] = React.useState<string | null>(null);

  const [zoom, setZoom] = React.useState(0.6);
  const [pan, setPan] = React.useState({ x: 36, y: 40 });
  const [showGrid, setShowGrid] = React.useState(true);
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  // Shared Ecosystem State (Brushes, Palettes, Gestures, Art Engine)
  const [brushPacks, setBrushPacks] = React.useState<BrushPack[]>(
    () => loadSharedBrushPacksLocal() ?? [DEFAULT_BRUSH_PACK]
  );
  const [palettes, setPalettes] = React.useState<ColorPalette[]>(
    () => loadSharedPalettesLocal() ?? DEFAULT_PALETTES
  );
  const [gestures, setGestures] = React.useState<GestureConfig>(() => loadGestureConfigLocal());

  const artEngineRef = React.useRef<ArtCanvasEngine | null>(null);
  if (!artEngineRef.current) {
    artEngineRef.current = new ArtCanvasEngine(createBlankArtDocument('Game Emblem Sketch', 1024, 1024));
  }
  const artEngine = artEngineRef.current;
  const [artDoc, setArtDoc] = React.useState<ArtDocument>(() => artEngine.getDocument());

  // Academy State
  const [academyOpen, setAcademyOpen] = React.useState(false);
  const [completedLessons, setCompletedLessons] = React.useState<string[]>(() =>
    loadCompletedTutorialsLocal()
  );
  const [activeLessonId, setActiveLessonId] = React.useState<string | null>(null);
  const [activeStepIdx, setActiveStepIdx] = React.useState(0);

  // Firebase Auth & Cloud Sync State
  const [user, setUser] = React.useState<User | null>(null);
  const [cloudModalOpen, setCloudModalOpen] = React.useState(false);
  const [authBusy, setAuthBusy] = React.useState(false);
  const [syncBusy, setSyncBusy] = React.useState(false);
  const [cloudError, setCloudError] = React.useState<string | null>(null);
  const [cloudUIProjects, setCloudUIProjects] = React.useState<CloudUIProjectSummary[]>([]);
  const [cloudArtDocs, setCloudArtDocs] = React.useState<CloudArtDocumentRecord[]>([]);

  const activeScreen =
    getScreenById(project.screens, project.activeScreenId) ?? project.screens[0];

  const notify = React.useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 2400);
  }, []);

  // Load IndexedDB crash recovery document for Art Studio on startup
  React.useEffect(() => {
    let mounted = true;
    loadArtDocumentLocal().then(async (saved) => {
      if (mounted && saved) {
        await artEngine.loadDocument(saved);
        setArtDoc(artEngine.getDocument());
      }
    });
    const unsub = artEngine.subscribe(() => {
      const next = artEngine.getDocument();
      setArtDoc(next);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [artEngine]);

  // Periodic IndexedDB autosave when artDoc updates
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      artEngine.serializeForStorage().then((fullDoc) => {
        void saveArtDocumentLocal(fullDoc);
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [artDoc, artEngine]);

  // Persist UI project, brush packs, palettes, gestures, tutorials locally
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // ignore quota errors
    }
  }, [project]);

  React.useEffect(() => {
    saveSharedBrushPacksLocal(brushPacks);
  }, [brushPacks]);

  React.useEffect(() => {
    saveSharedPalettesLocal(palettes);
  }, [palettes]);

  React.useEffect(() => {
    saveGestureConfigLocal(gestures);
  }, [gestures]);

  React.useEffect(() => {
    saveCompletedTutorialsLocal(completedLessons);
  }, [completedLessons]);

  // Firebase Auth + Real-Time Firestore Subscriptions
  React.useEffect(() => {
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
    });
  }, []);

  React.useEffect(() => {
    if (!user) {
      setCloudUIProjects([]);
      setCloudArtDocs([]);
      return;
    }
    const unsubProj = subscribeUIProjects(user.uid, setCloudUIProjects);
    const unsubArt = subscribeArtDocuments(user.uid, setCloudArtDocs);
    const unsubAssets = subscribeSharedAssets(user.uid, (cloudAssets) => {
      if (cloudAssets.length === 0) return;
      setProject((prev) => {
        const map = new Map(prev.assets.map((a) => [a.id, a]));
        for (const ca of cloudAssets) {
          map.set(ca.id, ca);
        }
        return { ...prev, assets: Array.from(map.values()) };
      });
    });
    const unsubBrushes = subscribeBrushPacks(user.uid, (cloudPacks) => {
      if (cloudPacks.length === 0) return;
      setBrushPacks((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const cp of cloudPacks) {
          map.set(cp.id, cp);
        }
        return Array.from(map.values());
      });
    });

    loadTutorialProgressFromCloud(user.uid)
      .then((cloudDone) => {
        if (cloudDone.length > 0) {
          setCompletedLessons((prev) => Array.from(new Set([...prev, ...cloudDone])));
        }
      })
      .catch(() => {});

    return () => {
      unsubProj();
      unsubArt();
      unsubAssets();
      unsubBrushes();
    };
  }, [user]);

  const commitProject = React.useCallback(
    (updater: (prev: PlaygroundProject) => PlaygroundProject, recordHistory = true) => {
      setProject((prev) => {
        const next = updater(prev);
        if (recordHistory) {
          setHistoryPast((past) => [...past.slice(-29), prev]);
          setHistoryFuture([]);
        }
        return { ...next, updatedAt: new Date().toISOString() };
      });
    },
    []
  );

  const handleUndo = React.useCallback(() => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setHistoryFuture((fut) => [project, ...fut]);
      setProject(previous);
      setSelectedIds([]);
      return past.slice(0, -1);
    });
  }, [project]);

  const handleRedo = React.useCallback(() => {
    setHistoryFuture((fut) => {
      if (fut.length === 0) return fut;
      const next = fut[0];
      setHistoryPast((past) => [...past, project]);
      setProject(next);
      setSelectedIds([]);
      return fut.slice(1);
    });
  }, [project]);

  const updateActiveScreen = React.useCallback(
    (updater: (s: ScreenArtboard) => ScreenArtboard, recordHistory = true) => {
      commitProject(
        (prev) => ({
          ...prev,
          screens: prev.screens.map((s) =>
            s.id === activeScreen.id ? updater(s) : s
          ),
        }),
        recordHistory
      );
    },
    [activeScreen.id, commitProject]
  );

  const handleCreateElement = React.useCallback(
    (el: UIElement) => {
      updateActiveScreen((s) => ({
        ...s,
        elements: [...s.elements, el],
      }));
      setSelectedIds([el.id]);
      setEditingState('idle');
    },
    [updateActiveScreen]
  );

  const handleUpdateElement = React.useCallback(
    (id: string, updater: (el: UIElement) => UIElement, recordHistory = true) => {
      updateActiveScreen(
        (s) => ({
          ...s,
          elements: s.elements.map((el) => (el.id === id ? updater(el) : el)),
        }),
        recordHistory
      );
    },
    [updateActiveScreen]
  );

  const handleMoveElements = React.useCallback(
    (updates: Array<{ id: string; x: number; y: number }>, recordHistory = false) => {
      const map = new Map(updates.map((u) => [u.id, u]));
      updateActiveScreen(
        (s) => ({
          ...s,
          elements: s.elements.map((el) => {
            const u = map.get(el.id);
            return u ? { ...el, x: u.x, y: u.y } : el;
          }),
        }),
        recordHistory
      );
    },
    [updateActiveScreen]
  );

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    const toRemove = new Set<string>(selectedIds);
    for (const id of selectedIds) {
      for (const desc of collectDescendants(activeScreen.elements, id)) {
        toRemove.add(desc.id);
      }
    }
    updateActiveScreen((s) => ({
      ...s,
      elements: s.elements.filter((e) => !toRemove.has(e.id)),
      rules: s.rules.filter((r) => !toRemove.has(r.sourceElementId)),
    }));
    setSelectedIds([]);
  }, [activeScreen.elements, selectedIds, updateActiveScreen]);

  const handleDuplicateSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    const maxZ = activeScreen.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const clones: UIElement[] = [];
    selectedIds.forEach((id, idx) => {
      const orig = activeScreen.elements.find((e) => e.id === id);
      if (!orig) return;
      const copy = cloneDeep(orig);
      copy.id = createId('el');
      copy.name = `${orig.name}_Copy`;
      copy.x += 20;
      copy.y += 20;
      copy.zIndex = maxZ + idx + 1;
      clones.push(copy);
    });
    if (clones.length > 0) {
      updateActiveScreen((s) => ({ ...s, elements: [...s.elements, ...clones] }));
      setSelectedIds(clones.map((c) => c.id));
    }
  }, [activeScreen.elements, selectedIds, updateActiveScreen]);

  const handleGroupSelected = React.useCallback(() => {
    if (selectedIds.length < 2) return;
    const targets = activeScreen.elements.filter((e) => selectedIds.includes(e.id));
    const minX = Math.min(...targets.map((t) => t.x));
    const minY = Math.min(...targets.map((t) => t.y));
    const maxX = Math.max(...targets.map((t) => t.x + t.width));
    const maxY = Math.max(...targets.map((t) => t.y + t.height));

    const groupEl = createElement('frame', {
      name: 'GroupContainer',
      x: minX,
      y: minY,
      width: Math.max(24, maxX - minX),
      height: Math.max(24, maxY - minY),
      zIndex: Math.min(...targets.map((t) => t.zIndex)),
    });
    groupEl.appearance.fillOpacity = 0;
    groupEl.appearance.strokeWidth = 0;

    updateActiveScreen((s) => ({
      ...s,
      elements: [
        ...s.elements.map((e) =>
          selectedIds.includes(e.id)
            ? { ...e, parentId: groupEl.id, x: e.x - minX, y: e.y - minY }
            : e
        ),
        groupEl,
      ],
    }));
    setSelectedIds([groupEl.id]);
    notify('Grouped selected layers into container');
  }, [activeScreen.elements, notify, selectedIds, updateActiveScreen]);

  const handleSaveComponent = React.useCallback(
    (elementId: string) => {
      const root = activeScreen.elements.find((e) => e.id === elementId);
      if (!root) return;
      const children = collectDescendants(activeScreen.elements, root.id);
      const relatedIds = new Set([root.id, ...children.map((c) => c.id)]);
      const relatedRules = activeScreen.rules.filter((r) =>
        relatedIds.has(r.sourceElementId)
      );

      const template: SavedComponentTemplate = {
        id: createId('comp'),
        name: root.name,
        description: root.interactive.isInteractive
          ? `Interactive ${root.interactive.componentType} component`
          : `Reusable ${root.type} element`,
        category: root.interactive.isInteractive
          ? root.interactive.componentType
          : 'layout',
        rootElement: cloneDeep({ ...root, parentId: null }),
        childElements: cloneDeep(children),
        rules: cloneDeep(relatedRules),
        createdAt: new Date().toISOString(),
      };

      commitProject((prev) => ({
        ...prev,
        library: [template, ...prev.library],
      }));
      notify(`Saved "${root.name}" to Component Library`);
    },
    [activeScreen.elements, activeScreen.rules, commitProject, notify]
  );

  // Keyboard shortcuts (scoped to UI Workshop when activeApp === 'ui_workshop')
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeApp !== 'ui_workshop') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedIds.length > 0) {
          const copied = activeScreen.elements.filter((el) =>
            selectedIds.includes(el.id)
          );
          setClipboard(cloneDeep(copied));
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
          const maxZ = activeScreen.elements.reduce((m, el) => Math.max(m, el.zIndex), 0);
          const pasted = clipboard.map((item, i) => ({
            ...cloneDeep(item),
            id: createId('el'),
            name: `${item.name}_Paste`,
            x: item.x + 24,
            y: item.y + 24,
            zIndex: maxZ + i + 1,
          }));
          updateActiveScreen((s) => ({ ...s, elements: [...s.elements, ...pasted] }));
          setSelectedIds(pasted.map((p) => p.id));
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleGroupSelected();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeTab === 'design' && selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      if (activeTab === 'design' && !e.ctrlKey && !e.metaKey) {
        const keyMap: Record<string, ToolType> = {
          v: 'select',
          h: 'pan',
          r: 'rectangle',
          s: 'square',
          c: 'circle',
          e: 'ellipse',
          p: 'polygon',
          t: 'text',
          i: 'image',
          l: 'line',
          f: 'frame',
        };
        const mapped = keyMap[e.key.toLowerCase()];
        if (mapped) setActiveTool(mapped);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeApp,
    activeScreen.elements,
    activeTab,
    clipboard,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleGroupSelected,
    handleRedo,
    handleUndo,
    selectedIds,
    updateActiveScreen,
  ]);

  const handleExportProjectJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}.robloxui.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Exported project JSON');
  };

  const handleImportProjectJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PlaygroundProject;
      if (parsed && Array.isArray(parsed.screens) && parsed.screens.length > 0) {
        commitProject(() => parsed);
        setSelectedIds([]);
        notify(`Loaded project "${parsed.name}"`);
      } else {
        notify('Invalid project JSON format');
      }
    } catch {
      notify('Could not parse project JSON');
    }
    e.target.value = '';
  };

  const handleNewProject = () => {
    const fresh: PlaygroundProject = {
      id: createId('proj'),
      name: 'Untitled Roblox UI',
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      activeScreenId: 'screen_1',
      screens: [
        {
          id: 'screen_1',
          name: 'ScreenGui1',
          width: 1280,
          height: 720,
          backgroundColor: '#13151B',
          elements: [],
          rules: [],
        },
      ],
      assets: project.assets,
      library: project.library,
    };
    commitProject(() => fresh);
    setSelectedIds([]);
    notify('Created new blank project');
  };

  const handleAddScreen = () => {
    const newScreen: ScreenArtboard = {
      id: createId('screen'),
      name: `ScreenGui${project.screens.length + 1}`,
      width: 1280,
      height: 720,
      backgroundColor: '#13151B',
      elements: [],
      rules: [],
    };
    commitProject((prev) => ({
      ...prev,
      activeScreenId: newScreen.id,
      screens: [...prev.screens, newScreen],
    }));
    setSelectedIds([]);
  };

  const handleDeleteScreen = (screenId: string) => {
    if (project.screens.length <= 1) return;
    commitProject((prev) => {
      const remaining = prev.screens.filter((s) => s.id !== screenId);
      return {
        ...prev,
        screens: remaining,
        activeScreenId:
          prev.activeScreenId === screenId ? remaining[0].id : prev.activeScreenId,
      };
    });
    setSelectedIds([]);
  };

  // Art Studio -> Shared Asset / UI Element State Workflow
  const handleArtExportToUIWorkshop = ({
    asset,
    targetElementId,
    targetState,
    switchToUI,
  }: {
    asset: AssetItem;
    targetElementId: string | 'new_image' | 'none';
    targetState: ComponentStateName;
    switchToUI: boolean;
  }) => {
    commitProject((prev) => {
      const nextAssets = [asset, ...prev.assets];
      if (targetElementId === 'none') {
        return { ...prev, assets: nextAssets };
      }

      if (targetElementId === 'new_image') {
        const newImg = createElement('image', {
          name: asset.name.replace(/\s+/g, '_'),
          x: 160,
          y: 160,
          width: Math.min(256, asset.width),
          height: Math.min(256, asset.height),
          zIndex: activeScreen.elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1,
        });
        newImg.appearance.fillOpacity = 0;
        newImg.appearance.strokeWidth = 0;
        newImg.appearance.image = {
          assetId: asset.id,
          spriteId: asset.sprites[0]?.id,
          scaleType: 'Fit',
          tintColor: '#FFFFFF',
          tintOpacity: 1,
        };
        setSelectedIds([newImg.id]);
        return {
          ...prev,
          assets: nextAssets,
          screens: prev.screens.map((sc) =>
            sc.id === activeScreen.id
              ? { ...sc, elements: [...sc.elements, newImg] }
              : sc
          ),
        };
      }

      // Bind directly to an existing element & state
      return {
        ...prev,
        assets: nextAssets,
        screens: prev.screens.map((sc) =>
          sc.id === activeScreen.id
            ? {
                ...sc,
                elements: sc.elements.map((el) => {
                  if (el.id !== targetElementId) return el;
                  let updated = el;
                  if (!updated.interactive.isInteractive) {
                    updated = enableInteractiveComponent(updated, 'button');
                  }
                  const targetOverride = updated.interactive.states[targetState] ?? {
                    appearance: cloneDeep(updated.appearance),
                    transformDelta: { dx: 0, dy: 0, dw: 0, dh: 0, dRotation: 0 },
                    transition: { durationMs: 140, easing: 'easeOut' as const },
                  };
                  const withImage = {
                    ...targetOverride,
                    appearance: {
                      ...targetOverride.appearance,
                      image: {
                        assetId: asset.id,
                        spriteId: asset.sprites[0]?.id,
                        scaleType: targetOverride.appearance.image?.scaleType ?? 'Fit',
                        tintColor: '#FFFFFF',
                        tintOpacity: 1,
                      },
                    },
                  };
                  return {
                    ...updated,
                    appearance:
                      targetState === 'idle'
                        ? withImage.appearance
                        : updated.appearance,
                    interactive: {
                      ...updated.interactive,
                      states: {
                        ...updated.interactive.states,
                        [targetState]: withImage,
                      },
                    },
                  };
                }),
              }
            : sc
        ),
      };
    });

    if (user) {
      void saveSharedAssetToCloud(asset, user.uid, 'art_studio');
    }

    if (switchToUI) {
      setActiveApp('ui_workshop');
      setActiveTab('design');
      if (targetElementId !== 'none' && targetElementId !== 'new_image') {
        setSelectedIds([targetElementId]);
        setEditingState(targetState);
      }
    }
    notify(`Sent "${asset.name}" to UI Workshop`);
  };

  // Cloud Sync Actions
  const handleSignIn = async () => {
    setAuthBusy(true);
    setCloudError(null);
    try {
      await signInWithGoogle();
      notify('Signed in to Cloud Account');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAccount();
    notify('Signed out');
  };

  const handleSaveUIProjectCloud = async () => {
    if (!user) return;
    setSyncBusy(true);
    setCloudError(null);
    try {
      await saveUIProjectToCloud(project, user.uid);
      notify('Saved UI Project to Cloud');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Failed to save UI project');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSaveArtDocCloud = async () => {
    if (!user) return;
    setSyncBusy(true);
    setCloudError(null);
    try {
      const thumb = await artEngine.exportPngDataUrl({
        transparent: false,
        maxDim: 360,
      });
      await saveArtDocumentToCloud(artDoc, user.uid, palettes, thumb.dataUrl);
      notify('Saved Art Studio document to Cloud');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Failed to save Art document');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSyncAllAssetsCloud = async () => {
    if (!user) return;
    setSyncBusy(true);
    setCloudError(null);
    try {
      for (const a of project.assets) {
        await saveSharedAssetToCloud(a, user.uid, 'ui_workshop');
      }
      for (const pack of brushPacks) {
        await saveBrushPackToCloud(pack, user.uid);
      }
      await saveTutorialProgressToCloud(user.uid, completedLessons);
      notify('Synced shared assets, brush packs, and Academy progress');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Cloud sync failed');
    } finally {
      setSyncBusy(false);
    }
  };

  const selectedElements = activeScreen.elements.filter((el) =>
    selectedIds.includes(el.id)
  );
  const singleSelected =
    selectedElements.length === 1 ? selectedElements[0] : undefined;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#111216] text-zinc-100">
      {/* Ecosystem Top Bar: App Switcher (UI Workshop <-> Art Studio) + Account + Academy + PWA */}
      <header className="h-12 shrink-0 px-2.5 sm:px-3 border-b border-zinc-800 bg-[#16181D] flex items-center justify-between gap-2 overflow-x-auto">
        {/* Left: Ecosystem Switcher + Active Project Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <div
            role="tablist"
            aria-label="Creative Ecosystem Applications"
            className="flex items-center gap-0.5 bg-zinc-900 p-0.5 rounded-md border border-zinc-800 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeApp === 'ui_workshop'}
              onClick={() => setActiveApp('ui_workshop')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                activeApp === 'ui_workshop'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>UI Workshop</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeApp === 'art_studio'}
              onClick={() => setActiveApp('art_studio')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                activeApp === 'art_studio'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Brush className="w-3.5 h-3.5" />
              <span>Art Studio</span>
            </button>
          </div>

          {activeApp === 'ui_workshop' && (
            <input
              type="text"
              aria-label="Project name"
              value={project.name}
              onChange={(e) =>
                commitProject((p) => ({ ...p, name: e.target.value }), false)
              }
              className="hidden sm:block w-36 px-1.5 py-0.5 rounded bg-transparent hover:bg-zinc-800/70 focus:bg-zinc-900 border border-transparent focus:border-zinc-700 text-xs text-zinc-200 outline-none truncate"
            />
          )}
        </div>

        {/* Center: UI Workshop Workspace Mode Tabs (when UI Workshop active) */}
        {activeApp === 'ui_workshop' && (
          <nav
            aria-label="Workspace modes"
            className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-md border border-zinc-800 shrink-0"
          >
            {(
              [
                { id: 'design', label: 'Design', tour: 'ui-tab-design' },
                { id: 'preview', label: 'Preview', tour: 'ui-tab-preview' },
                { id: 'events', label: 'Events', tour: 'ui-tab-events' },
                { id: 'assets', label: `Assets (${project.assets.length})`, tour: 'ui-tab-assets' },
                { id: 'library', label: 'Library', tour: 'ui-tab-library' },
                { id: 'export', label: 'Export', tour: 'ui-tab-export' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-tour-id={tab.tour}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right: UI Controls + Academy + Cloud Account + PWA */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeApp === 'ui_workshop' && (
            <>
              <button
                type="button"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={historyPast.length === 0}
                onClick={handleUndo}
                className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={historyFuture.length === 0}
                onClick={handleRedo}
                className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-300"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              {activeTab === 'design' && (
                <>
                  <div className="hidden md:block h-4 w-px bg-zinc-800 mx-0.5" />
                  <button
                    type="button"
                    aria-label="Toggle grid"
                    title="Toggle Grid"
                    onClick={() => setShowGrid((g) => !g)}
                    className={`hidden md:inline-flex p-1.5 rounded ${
                      showGrid ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Toggle snap to grid"
                    title="Snap to Grid"
                    onClick={() => setSnapToGrid((s) => !s)}
                    className={`hidden md:inline-flex p-1.5 rounded ${
                      snapToGrid ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <Magnet className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}
                    className="hidden lg:inline-flex p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Reset zoom"
                    onClick={() => {
                      setZoom(0.6);
                      setPan({ x: 36, y: 40 });
                    }}
                    className="hidden lg:inline-flex px-1.5 py-0.5 rounded hover:bg-zinc-800 text-xs font-mono tabular-nums text-zinc-300"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
                    className="hidden lg:inline-flex p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </>
              )}

              <div className="hidden sm:block h-4 w-px bg-zinc-800 mx-0.5" />
              <button
                type="button"
                title="New Project"
                aria-label="New Project"
                onClick={handleNewProject}
                className="hidden sm:inline-flex p-1.5 rounded hover:bg-zinc-800 text-zinc-300"
              >
                <FilePlus2 className="w-4 h-4" />
              </button>
              <label
                title="Open Project JSON"
                aria-label="Open Project JSON"
                className="hidden sm:inline-flex p-1.5 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportProjectJson}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleExportProjectJson}
                className="hidden xl:flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Save JSON
              </button>
            </>
          )}

          <PWAInstallButton />

          <button
            type="button"
            onClick={() => setAcademyOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-amber-300 whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Academy</span>
          </button>

          <button
            type="button"
            onClick={() => setCloudModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
              user
                ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 hover:bg-emerald-900/60'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {user ? user.displayName?.split(' ')[0] || 'Cloud' : 'Account'}
            </span>
          </button>
        </div>
      </header>

      {/* UI WORKSHOP WORKSPACE */}
      {activeApp === 'ui_workshop' && (
        <>
          {/* Secondary Screen Tabs Bar */}
          <div className="h-8 shrink-0 px-3 border-b border-zinc-800 bg-[#13151A] flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[11px] text-zinc-500 mr-1">Screens:</span>
            {project.screens.map((sc) => {
              const active = sc.id === activeScreen.id;
              return (
                <div
                  key={sc.id}
                  className={`group flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                    active
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      commitProject((p) => ({ ...p, activeScreenId: sc.id }), false);
                      setSelectedIds([]);
                    }}
                    className="whitespace-nowrap"
                  >
                    {sc.name}
                  </button>
                  {project.screens.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete screen ${sc.name}`}
                      onClick={() => handleDeleteScreen(sc.id)}
                      className="opacity-60 hover:opacity-100 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddScreen}
              className="flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 whitespace-nowrap"
            >
              <Plus className="w-3 h-3" /> Add Screen
            </button>
          </div>

          <main className="flex-1 flex flex-col overflow-hidden relative">
            {activeTab === 'design' && (
              <>
                <div className="flex-1 flex overflow-hidden">
                  <div data-tour-id="ui-left-toolbar" className="flex">
                    <LeftToolbarAndLayers
                      activeTool={activeTool}
                      onSelectTool={setActiveTool}
                      elements={activeScreen.elements}
                      selectedIds={selectedIds}
                      onSelectElement={(id, additive) => {
                        setSelectedIds((prev) =>
                          additive
                            ? prev.includes(id)
                              ? prev.filter((x) => x !== id)
                              : [...prev, id]
                            : [id]
                        );
                        setEditingState('idle');
                      }}
                      onToggleVisible={(id) =>
                        handleUpdateElement(id, (el) => ({ ...el, visible: !el.visible }))
                      }
                      onToggleLock={(id) =>
                        handleUpdateElement(id, (el) => ({ ...el, locked: !el.locked }))
                      }
                      onReorder={(id, dir) =>
                        updateActiveScreen((s) => ({
                          ...s,
                          elements: reorderElementZIndex(s.elements, id, dir),
                        }))
                      }
                      onDuplicateSelected={handleDuplicateSelected}
                      onDeleteSelected={handleDeleteSelected}
                      onGroupSelected={handleGroupSelected}
                      onSaveComponent={handleSaveComponent}
                    />
                  </div>

                  <div data-tour-id="ui-design-canvas" className="flex-1 flex overflow-hidden">
                    <DesignCanvas
                      screen={activeScreen}
                      assets={project.assets}
                      activeTool={activeTool}
                      selectedIds={selectedIds}
                      editingState={editingState}
                      zoom={zoom}
                      pan={pan}
                      showGrid={showGrid}
                      snapToGrid={snapToGrid}
                      gridSize={16}
                      onChangeZoom={setZoom}
                      onChangePan={setPan}
                      onSelectIds={(ids) => {
                        setSelectedIds(ids);
                        setEditingState('idle');
                      }}
                      onCreateElement={handleCreateElement}
                      onUpdateElement={handleUpdateElement}
                      onMoveElements={handleMoveElements}
                      onSelectTool={setActiveTool}
                    />
                  </div>

                  <div data-tour-id="ui-properties-inspector" className="flex">
                    <PropertiesInspector
                      screen={activeScreen}
                      selectedElements={selectedElements}
                      assets={project.assets}
                      editingState={editingState}
                      onUpdateScreen={(updater) => updateActiveScreen(updater)}
                      onUpdateElement={(id, updater) => handleUpdateElement(id, updater)}
                      onSaveComponent={handleSaveComponent}
                      onOpenEventsForElement={(id) => {
                        setFocusedEventElId(id);
                        setActiveTab('events');
                      }}
                    />
                  </div>
                </div>

                <div data-tour-id="ui-state-timeline">
                  <StateTimelinePanel
                    element={singleSelected}
                    editingState={editingState}
                    onSelectEditingState={setEditingState}
                    onUpdateElement={(id, updater) => handleUpdateElement(id, updater)}
                  />
                </div>
              </>
            )}

            {activeTab === 'preview' && (
              <PreviewMode project={project} initialScreenId={activeScreen.id} />
            )}

            {activeTab === 'events' && (
              <EventEditor
                screen={activeScreen}
                allScreens={project.screens}
                focusedElementId={focusedEventElId}
                onUpdateScreen={(updater) => updateActiveScreen(updater)}
              />
            )}

            {activeTab === 'assets' && (
              <AssetManager
                assets={project.assets}
                selectedElementName={singleSelected?.name ?? null}
                onAddAssets={(items: AssetItem[]) => {
                  commitProject((p) => ({ ...p, assets: [...p.assets, ...items] }));
                  if (user) {
                    items.forEach((it) => void saveSharedAssetToCloud(it, user.uid, 'imported'));
                  }
                }}
                onUpdateAsset={(id, updater) =>
                  commitProject((p) => ({
                    ...p,
                    assets: p.assets.map((a) => (a.id === id ? updater(a) : a)),
                  }))
                }
                onDeleteAsset={(id) =>
                  commitProject((p) => ({
                    ...p,
                    assets: p.assets.filter((a) => a.id !== id),
                  }))
                }
                onAssignToSelected={(assetId, spriteId) => {
                  if (!singleSelected) return;
                  handleUpdateElement(singleSelected.id, (curr) => {
                    const useOverride =
                      curr.interactive.isInteractive &&
                      Boolean(curr.interactive.states[editingState]);
                    if (useOverride) {
                      const st = curr.interactive.states[editingState]!;
                      return {
                        ...curr,
                        interactive: {
                          ...curr.interactive,
                          states: {
                            ...curr.interactive.states,
                            [editingState]: {
                              ...st,
                              appearance: {
                                ...st.appearance,
                                image: {
                                  assetId,
                                  spriteId,
                                  scaleType: st.appearance.image?.scaleType ?? 'Fit',
                                  tintColor: st.appearance.image?.tintColor ?? '#FFFFFF',
                                  tintOpacity: st.appearance.image?.tintOpacity ?? 1,
                                },
                              },
                            },
                          },
                        },
                      };
                    }
                    return {
                      ...curr,
                      appearance: {
                        ...curr.appearance,
                        image: {
                          assetId,
                          spriteId,
                          scaleType: curr.appearance.image?.scaleType ?? 'Fit',
                          tintColor: curr.appearance.image?.tintColor ?? '#FFFFFF',
                          tintOpacity: curr.appearance.image?.tintOpacity ?? 1,
                        },
                      },
                    };
                  });
                  notify(`Assigned image to ${singleSelected.name}`);
                }}
              />
            )}

            {activeTab === 'library' && (
              <ComponentLibrary
                library={project.library}
                onInsertTemplate={(tpl) => {
                  const idMap = new Map<string, string>();
                  const rootCopy = cloneDeep(tpl.rootElement);
                  const newRootId = createId('el');
                  idMap.set(tpl.rootElement.id, newRootId);
                  rootCopy.id = newRootId;
                  rootCopy.x = 120;
                  rootCopy.y = 120;
                  rootCopy.zIndex =
                    activeScreen.elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1;

                  const childCopies = tpl.childElements.map((c, idx) => {
                    const copy = cloneDeep(c);
                    const cid = createId('el');
                    idMap.set(c.id, cid);
                    copy.id = cid;
                    copy.parentId = c.parentId ? idMap.get(c.parentId) ?? newRootId : newRootId;
                    copy.zIndex = rootCopy.zIndex + idx + 1;
                    return copy;
                  });

                  const ruleCopies = tpl.rules.map((r) => {
                    const rc = cloneDeep(r);
                    rc.id = createId('rule');
                    rc.sourceElementId = idMap.get(r.sourceElementId) ?? newRootId;
                    rc.actions = rc.actions.map((a) => ({
                      ...a,
                      id: createId('act'),
                      targetElementId: a.targetElementId
                        ? idMap.get(a.targetElementId) ?? a.targetElementId
                        : undefined,
                    }));
                    return rc;
                  });

                  updateActiveScreen((s) => ({
                    ...s,
                    elements: [...s.elements, rootCopy, ...childCopies],
                    rules: [...s.rules, ...ruleCopies],
                  }));
                  setSelectedIds([newRootId]);
                  setActiveTab('design');
                  notify(`Inserted "${tpl.name}" onto ${activeScreen.name}`);
                }}
                onDuplicateTemplate={(id) =>
                  commitProject((p) => {
                    const orig = p.library.find((t) => t.id === id);
                    if (!orig) return p;
                    const copy = cloneDeep(orig);
                    copy.id = createId('comp');
                    copy.name = `${orig.name} Copy`;
                    return { ...p, library: [copy, ...p.library] };
                  })
                }
                onRenameTemplate={(id, name) =>
                  commitProject((p) => ({
                    ...p,
                    library: p.library.map((t) => (t.id === id ? { ...t, name } : t)),
                  }))
                }
                onDeleteTemplate={(id) =>
                  commitProject((p) => ({
                    ...p,
                    library: p.library.filter((t) => t.id !== id),
                  }))
                }
              />
            )}

            {activeTab === 'export' && <RobloxExportView project={project} />}
          </main>
        </>
      )}

      {/* ART STUDIO WORKSPACE */}
      {activeApp === 'art_studio' && (
        <ArtStudioWorkspace
          engine={artEngine}
          doc={artDoc}
          brushPacks={brushPacks}
          palettes={palettes}
          gestures={gestures}
          uiElements={activeScreen.elements}
          onSaveBrush={(packId, brush) =>
            setBrushPacks((prev) =>
              prev.map((p) => {
                if (p.id !== packId) return p;
                const exists = p.brushes.some((b) => b.id === brush.id);
                return {
                  ...p,
                  brushes: exists
                    ? p.brushes.map((b) => (b.id === brush.id ? brush : b))
                    : [brush, ...p.brushes],
                };
              })
            )
          }
          onDeleteBrush={(packId, brushId) =>
            setBrushPacks((prev) =>
              prev.map((p) =>
                p.id === packId
                  ? { ...p, brushes: p.brushes.filter((b) => b.id !== brushId) }
                  : p
              )
            )
          }
          onAddBrushPack={(pack) => {
            setBrushPacks((prev) => [pack, ...prev]);
            if (user) void saveBrushPackToCloud(pack, user.uid);
          }}
          onAddSwatchToPalette={(paletteId, hex) =>
            setPalettes((prev) =>
              prev.map((pal) =>
                pal.id === paletteId && !pal.colors.includes(hex)
                  ? { ...pal, colors: [...pal.colors, hex] }
                  : pal
              )
            )
          }
          onCreatePalette={(name) =>
            setPalettes((prev) => [
              ...prev,
              { id: `pal_${Date.now().toString(36)}`, name, colors: ['#2563EB', '#FFFFFF'] },
            ])
          }
          onUpdateGestures={setGestures}
          onExportToUIWorkshop={handleArtExportToUIWorkshop}
          onResetDocument={async (nextDoc) => {
            await artEngine.loadDocument(nextDoc);
            setArtDoc(artEngine.getDocument());
          }}
          notify={notify}
        />
      )}

      {/* Global Overlays: Academy, Cloud Account, Offline Indicator, Toast */}
      <TutorialAcademyDrawer
        open={academyOpen}
        onClose={() => setAcademyOpen(false)}
        activeApp={activeApp}
        onSwitchApp={setActiveApp}
        completedLessonIds={completedLessons}
        onCompleteLesson={(lessonId) => {
          setCompletedLessons((prev) => {
            const next = prev.includes(lessonId) ? prev : [...prev, lessonId];
            if (user) void saveTutorialProgressToCloud(user.uid, next);
            return next;
          });
          notify('Lesson completed!');
        }}
        onResetProgress={() => {
          setCompletedLessons([]);
          if (user) void saveTutorialProgressToCloud(user.uid, []);
        }}
        activeLessonId={activeLessonId}
        activeStepIdx={activeStepIdx}
        onSelectLesson={(lessonId, stepIdx = 0) => {
          setActiveLessonId(lessonId);
          setActiveStepIdx(stepIdx);
        }}
      />

      <CloudAccountModal
        open={cloudModalOpen}
        onClose={() => setCloudModalOpen(false)}
        user={user}
        authBusy={authBusy}
        syncBusy={syncBusy}
        cloudError={cloudError}
        cloudUIProjects={cloudUIProjects}
        cloudArtDocs={cloudArtDocs}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onSaveUIProjectCloud={handleSaveUIProjectCloud}
        onSaveArtDocCloud={handleSaveArtDocCloud}
        onLoadUIProjectCloud={(p) => {
          commitProject((curr) => ({
            ...curr,
            id: p.id,
            name: p.name,
            version: p.version,
            activeScreenId: p.activeScreenId,
            screens: p.screens,
            library: p.library,
          }));
          setActiveApp('ui_workshop');
          notify(`Loaded "${p.name}" from Cloud`);
        }}
        onLoadArtDocCloud={async (d) => {
          const fresh: ArtDocument = {
            id: d.id,
            version: '1.0.0',
            title: d.title,
            width: d.width,
            height: d.height,
            dpi: d.dpi,
            backgroundColor: d.backgroundColor,
            activeLayerId: d.layers[0]?.id ?? 'layer_1',
            layers: d.layers,
            guides: createBlankArtDocument().guides,
            updatedAt: new Date().toISOString(),
          };
          await artEngine.loadDocument(fresh);
          setArtDoc(artEngine.getDocument());
          setActiveApp('art_studio');
          notify(`Opened "${d.title}" metadata from Cloud`);
        }}
        onSyncAllAssetsCloud={handleSyncAllAssetsCloud}
      />

      <OfflineIndicator />

      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
