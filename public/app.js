// Fully-Wired Production Client with Universal Mixed-Media Note Containers
import {
  Viewport,
  StrokeRenderer,
  TouchGestureRecognizer,
  DocumentModel,
  HistoryManager,
  AddBlockCommand,
  CloudflareR2Sync,
  LocalVault,
  showToast,
  setupStorageSettingsModal,
  initHierarchy,
  saveHierarchy,
  renderHierarchyUI,
  setupSidebarControls,
  setupInkPaletteControls,
  setupLayoutSwitcher,
  setMode,
  setupInstallPrompt,
  registerServiceWorker,
  setupRibbonControls,
  setupKeyboardAndClipboard,
  setupViewportInteractions,
  setupInkingInteractions,
  setupThemeController,
  createViewportCamera,
  createPageStorageManager,
  renderBlocks as modularRenderBlocks,
  initSplashScreen
} from './src/core.js';

// Global State
const state = {
  layout: 'layout-a',
  mode: 'windows', // 'windows' | 'ipad'
  activeTool: 'select',
  selectedBlockIds: new Set(),
  activeContainerId: null,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  isMarquee: false,
  marqueeStart: { x: 0, y: 0 },
  isDrawing: false,
  drawStartTime: 0,
  currentStrokePoints: [],
  viewport: new Viewport(40, 40, 1.0),
  history: new HistoryManager(),
  hierarchy: null,
  activeNotebookId: null,
  activeSectionId: null,
  activePageId: null,
  doc: null,
  vault: new LocalVault('NotesAppLocalVault', 1),
  r2: new CloudflareR2Sync(),
  touchRecognizer: null,
  sidebarCollapsed: false,
  inkTool: 'pen', // 'pen' | 'eraser'
  inkColor: '#0f172a',
  inkWidth: 3,
  eraserMode: 'full', // 'full' | 'partial'
  eraserSize: 24,
  isErasing: false,
  eraserStartStrokes: null,
  focusItemId: null,
  activeTouches: new Map(),
  touchDragBlock: null,
  touchDragStart: { x: 0, y: 0 },
};
window.state = state;

// --- IndexedDB Local Asset Vault (powered by LocalVault) ---
async function saveAssetIDB(key, val) {
  return state.vault.storeAsset(key, val);
}

async function getAssetIDB(key) {
  return state.vault.getAsset(key);
}

// DOM Elements
const container = document.getElementById('canvas-container');
const world = document.getElementById('canvas-world');
const blocksLayer = document.getElementById('blocks-container');
const annotationsSvg = document.getElementById('global-annotations-svg');
const activeDrawCanvas = document.getElementById('active-draw-canvas');
const ctx = activeDrawCanvas ? activeDrawCanvas.getContext('2d') : null;

function resizeActiveDrawCanvas() {
  if (!activeDrawCanvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = container ? (container.clientWidth || window.innerWidth) : window.innerWidth;
  const h = container ? (container.clientHeight || window.innerHeight) : window.innerHeight;
  activeDrawCanvas.width = Math.round(w * dpr);
  activeDrawCanvas.height = Math.round(h * dpr);
  activeDrawCanvas.style.width = w + 'px';
  activeDrawCanvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearActiveDrawCanvas() {
  if (!activeDrawCanvas || !ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, activeDrawCanvas.width, activeDrawCanvas.height);
  ctx.restore();
}

const zoomIndicator = document.getElementById('zoom-indicator');
const marqueeBox = document.getElementById('selection-marquee');
const selectionStatus = document.getElementById('selection-status');
const sidebar = document.getElementById('app-sidebar');
const storageStatus = document.getElementById('storage-status');
const pageStatusLabel = document.getElementById('page-status-label');
const mediaFileInput = document.getElementById('media-file-input');
const pdfFileInput = document.getElementById('pdf-file-input');

// --- Kinetic Momentum pan reference ---
let stopMomentum = () => {};

// --- 2D Infinite Canvas Viewport Camera (Smooth Glide & Auto-Clamping) ---
const camera = createViewportCamera({
  state,
  container,
  world,
  zoomIndicator,
  getStopMomentum: () => stopMomentum
});
const {
  updateWorldTransform,
  animateViewport,
  fitAllContent,
  applyViewportClamping,
  refreshScrollbars
} = camera;

// --- Active Page Document Management (IndexedDB LocalVault & Fallbacks) ---
const pageStorage = createPageStorageManager({
  state,
  storageStatus
});
const {
  loadActivePageDocument,
  saveActivePageDocument,
  debouncedSave,
  flushPendingSave,
  getPageStorageKey
} = pageStorage;

// --- Initialization ---

async function initApp() {
  const splash = initSplashScreen();
  await state.vault.init();
  await initHierarchy({
    state,
    renderHierarchyUI: () => renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll })
  });
  initTouchRecognizer();
  setupLayoutSwitcher({
    state,
    sidebar,
    resizeActiveDrawCanvas,
    updateWorldTransform,
    switchMode: (mode, silent) => setMode({
      state,
      mode,
      silent,
      activeDrawCanvas,
      clearActiveDrawCanvas,
      resizeActiveDrawCanvas,
      showToast
    })
  });
  setupRibbonControls({
    state,
    container,
    world,
    zoomIndicator,
    mediaFileInput,
    pdfFileInput,
    showToast,
    renderAll,
    saveActivePageDocument,
    debouncedSave,
    createNewNoteContainer,
    getOrCreateActiveContainer,
    saveAssetIDB,
    AddBlockCommand
  });
  setupInkPaletteControls({
    state,
    activeDrawCanvas,
    clearActiveDrawCanvas,
    showToast
  });
  setupSidebarControls({
    state,
    saveActivePageDocument,
    loadActivePageDocument,
    renderAll,
    showToast
  });
  setupCanvasInteractions();
  setupKeyboardAndClipboard({
    state,
    container,
    showToast,
    saveActivePageDocument,
    renderAll,
    fitAllContent,
    animateViewport,
    getOrCreateActiveContainer,
    createNewNoteContainer,
    AddBlockCommand,
    zoomIndicator
  });
  setupStorageSettingsModal({
    state,
    storageStatus,
    showToast,
    initHierarchy: () => initHierarchy({
      state,
      renderHierarchyUI: () => renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll })
    }),
    saveHierarchy: (st) => saveHierarchy(st || state),
    renderHierarchyUI: () => renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll }),
    loadActivePageDocument,
    renderAll
  });

  // PWA Offline-First Service Worker & Install Management
  registerServiceWorker(showToast);
  setupInstallPrompt({ showToast });

  // Theme Controller (Dark Mode by default based on #282828)
  setupThemeController({ state, showToast });

  await loadActivePageDocument();
  renderAll();
  setTimeout(() => { if (splash && splash.dismiss) splash.dismiss(); }, 700);
}

// --- Touch Gesture Recognizer ---

function initTouchRecognizer() {
  state.touchRecognizer = new TouchGestureRecognizer({
    onDoubleTap: () => {
      if (state.history.canUndo()) {
        state.history.undo();
        saveActivePageDocument();
        renderAll();
        showToast('↺ Undone (Double-Tap)');
      }
    },
    onPinchZoom: ({ scaleFactor, center, panDelta }) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const originX = center.x - rect.left;
      const originY = center.y - rect.top;

      // True Locked Paper Anchoring: Scale seamlessly around the midpoint and glide with finger drift
      if (scaleFactor && scaleFactor > 0 && Math.abs(scaleFactor - 1.0) > 0.001) {
        state.viewport.zoomAt(originX, originY, scaleFactor);
      }
      if (panDelta && (panDelta.dx !== 0 || panDelta.dy !== 0)) {
        state.viewport.pan(panDelta.dx, panDelta.dy);
      }
      updateWorldTransform();
      debouncedSave(800);
    }
  });
}

// --- Render Engine Pipeline ---

function renderAll() {
  updateWorldTransform();
  renderBlocks();
  renderGlobalAnnotations();
  updateSelectionStatus();
}

function updateSelectionStatus() {
  if (!selectionStatus) return;
  const count = state.selectedBlockIds.size;
  selectionStatus.textContent = `${count} selected`;
}

// --- Universal Note Containers Rendering (Modular Engine) ---

function renderBlocks() {
  modularRenderBlocks({
    state,
    blocksLayer,
    saveActivePageDocument,
    renderAll,
    showToast,
    updateSelectionStatus,
    mediaFileInput,
    pdfFileInput,
    registerActiveDragCallback: () => {},
    unregisterActiveDragCallback: () => {},
    debouncedSave
  });
}

// --- Global Vector Ink Annotations ---

function renderGlobalAnnotations() {
  if (!annotationsSvg) return;
  annotationsSvg.innerHTML = '';
  if (!state.doc) return;

  const strokes = state.doc.globalAnnotations || [];
  strokes.forEach(stroke => {
    appendStrokeToSvg(stroke);
  });
}

function appendStrokeToSvg(stroke) {
  if (!annotationsSvg || !stroke || !stroke.points) return;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', StrokeRenderer.pointsToSvgPath(stroke.points));
  path.setAttribute('stroke', stroke.color || '#2563eb');
  path.setAttribute('stroke-width', stroke.width || 3);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  if (stroke.tool === 'highlighter' || stroke.opacity) {
    path.setAttribute('stroke-opacity', String(stroke.opacity || 0.45));
    path.setAttribute('style', 'mix-blend-mode: multiply;');
  }
  annotationsSvg.appendChild(path);
}

// --- Natural 2D Navigation, Auto-Shapes & Canvas Interactions ---

function setupCanvasInteractions() {
  const vpInteractions = setupViewportInteractions({
    state,
    container,
    marqueeBox,
    updateWorldTransform,
    updateSelectionStatus,
    saveActivePageDocument,
    debouncedSave,
    renderAll,
    animateViewport,
    fitAllContent,
    createNewNoteContainer,
    AddBlockCommand,
    showToast
  });
  stopMomentum = vpInteractions.stopMomentum;

  setupInkingInteractions({
    state,
    activeDrawCanvas,
    ctx,
    clearActiveDrawCanvas,
    renderGlobalAnnotations,
    appendStrokeToSvg,
    saveActivePageDocument,
    debouncedSave,
    showToast
  });
}

// --- Universal Helper to Get or Create Active Container ---

function getOrCreateActiveContainer() {
  let target = null;
  if (state.activeContainerId) {
    target = state.doc.getBlock(state.activeContainerId);
  }
  if (!target && state.doc.blocks.length > 0) {
    target = state.doc.blocks[0];
  }
  if (!target) {
    const center = state.viewport.screenToWorld(container.clientWidth / 2, container.clientHeight / 2);
    target = createNewNoteContainer(center.x - 290, center.y - 120);
    state.history.execute(new AddBlockCommand(state.doc, target));
  }
  state.activeContainerId = target.id;
  state.selectedBlockIds.clear();
  state.selectedBlockIds.add(target.id);
  return target;
}

function createNewNoteContainer(x, y, title = 'Note') {
  return {
    id: 'note_' + Math.random().toString(36).substr(2, 9),
    type: 'note_container',
    x: Math.round(x),
    y: Math.round(y),
    width: 580,
    title,
    items: [
      { id: 'item_' + Date.now(), type: 'text', content: '# Heading\nType notes here with $inline$ or $$block$$ math...' }
    ]
  };
}

// --- Lifecycle Event Handlers (Safe Background Flush) ---

window.addEventListener('beforeunload', flushPendingSave);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPendingSave();
});
window.addEventListener('blur', flushPendingSave);

// Immediate execution if DOM ready, otherwise attach listener
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
