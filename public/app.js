// Fully-Wired Production Client with Universal Mixed-Media Note Containers
import {
  Viewport,
  FrustumCuller,
  StrokeRenderer,
  ShapeDetector,
  ShapeType,
  TouchGestureRecognizer,
  MarkdownLatexParser,
  PDFPrintoutManager,
  FunctionPlotter,
  TableBlockModel,
  MediaBlockModel,
  ResizeHandleEngine,
  ResizeHandleType,
  HierarchyManager,
  DocumentModel,
  HistoryManager,
  AddBlockCommand,
  RemoveBlockCommand,
  AddStrokeCommand,
  EraseStrokesCommand,
  EraserEngine,
  CloudflareR2Sync,
  Sandbox,
  BlockType,
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
  getCanvasContentBounds,
  clampViewportBounds,
  updateScrollbars,
  setupScrollbarDragging,
  setupEdgeAutoScroll,
  registerActiveDragCallback,
  unregisterActiveDragCallback,
  setupRibbonTabs,
  setupRibbonControls,
  setupKeyboardAndClipboard,
  setupViewportInteractions,
  setupInkingInteractions,
  setupThemeController,
  createBlankDocument,
  createSampleDocument,
  renderBlocks as modularRenderBlocks
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

// --- Inking & Palm Rejection High-Precision State ---
let lastPenTouchTime = 0;
let liveStrokePoints = [];
let lastMidPoint = null;
let liveStrokeWidth = 3;

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
const ctx = activeDrawCanvas.getContext('2d');

function resizeActiveDrawCanvas() {
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

// --- Initialization ---

async function initApp() {
  await state.vault.init();
  await initHierarchy({ state, renderHierarchyUI: () => renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll }) });
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
    initHierarchy: () => initHierarchy({ state, renderHierarchyUI: () => renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll }) }),
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
}

function saveHierarchyNow() {
  saveHierarchy(state);
}

function renderHierarchy() {
  renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
}

// --- Hierarchy & Navigation is now managed by src/ui/sidebar.js ---


// --- Active Page Document Management ---

function getPageStorageKey(pageId) {
  return `notes_universal_page_${pageId || 'default'}`;
}

async function loadActivePageDocument() {
  if (!state.activePageId) {
    state.doc = new DocumentModel({ title: 'New Note' });
    return;
  }

  state.vault.saveSetting('activePageId', state.activePageId);

  // 1. Load full document from LocalVault (IndexedDB)
  const vaultDoc = await state.vault.loadPage(state.activePageId);
  if (vaultDoc) {
    const parsed = DocumentModel.fromJSON(vaultDoc);
    // Legacy cleanup: If a non-demo page was polluted by the early prototype demo data, auto-clean to a blank canvas
    if (
      state.activePageId !== 'nb_physics_demo_p1' &&
      parsed.blocks &&
      parsed.blocks.some(b => b.title === 'Kinematics & Derivatives' || b.id === 'note_kinematics_1')
    ) {
      state.doc = createBlankDocument(state.activePageId);
      saveActivePageDocument(state.activePageId);
    } else {
      state.doc = parsed;
    }
  } else {
    // Fallback to localStorage for backward compatibility with initial prototype data
    const key = getPageStorageKey(state.activePageId);
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = DocumentModel.fromJSON(raw);
        if (
          state.activePageId !== 'nb_physics_demo_p1' &&
          parsed.blocks &&
          parsed.blocks.some(b => b.title === 'Kinematics & Derivatives' || b.id === 'note_kinematics_1')
        ) {
          state.doc = createBlankDocument(state.activePageId);
        } else {
          state.doc = parsed;
        }
      } catch {
        state.doc = createBlankDocument(state.activePageId);
      }
    } else if (state.activePageId === 'nb_physics_demo_p1') {
      // Only the first demo page of the default sample notebook gets sample content
      state.doc = createSampleDocument(state.activePageId);
    } else {
      // All other pages start completely clean and blank
      state.doc = createBlankDocument(state.activePageId);
    }
    // Persist clean page into LocalVault
    saveActivePageDocument(state.activePageId);
  }

  if (state.doc.viewport) {
    state.viewport.x = state.doc.viewport.x ?? 40;
    state.viewport.y = state.doc.viewport.y ?? 40;
    state.viewport.zoom = state.doc.viewport.zoom ?? 1.0;
  }
  state.history.clear();
  state.selectedBlockIds.clear();
  state.activeContainerId = (state.mode !== 'ipad' && state.doc.blocks[0]) ? state.doc.blocks[0].id : null;
}

let saveTimer = null;
function debouncedSave(delay = 500) {
  if (saveTimer) clearTimeout(saveTimer);
  const targetId = state.activePageId;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveActivePageDocument(targetId);
  }, delay);
}

function saveActivePageDocument(targetPageId = state.activePageId) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const pageIdToSave = targetPageId || state.activePageId;
  if (!state.doc || !pageIdToSave) return;

  // Flush any dirty text editor content before committing document
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.note-item-text').forEach(el => {
      if (typeof el._syncContent === 'function') el._syncContent();
    });
  }

  state.doc.viewport = { x: state.viewport.x, y: state.viewport.y, zoom: state.viewport.zoom };
  const docJson = state.doc.toJSON();

  // 1. Always persist full fidelity asynchronously in LocalVault (IndexedDB)
  state.vault.savePage(pageIdToSave, docJson).catch(e => console.warn('LocalVault save warning:', e));

  // 2. Write to localStorage during idle time to prevent synchronous UI freezes
  const scheduleDiskWrite = (typeof window !== 'undefined' && window.requestIdleCallback)
    ? (cb) => window.requestIdleCallback(cb, { timeout: 1000 })
    : (cb) => setTimeout(cb, 20);

  scheduleDiskWrite(() => {
    try {
      const key = getPageStorageKey(pageIdToSave);
      localStorage.setItem(key, JSON.stringify(docJson));
    } catch (err) {
      try {
        const shallow = JSON.parse(JSON.stringify(docJson));
        if (shallow.blocks) {
          shallow.blocks.forEach(b => {
            if (b.items) {
              b.items.forEach(it => {
                if (it.dataUrl && it.dataUrl.length > 50000) it.dataUrl = '';
                if (it.src && it.src.length > 50000) it.src = '';
              });
            }
          });
        }
        localStorage.setItem(getPageStorageKey(pageIdToSave), JSON.stringify(shallow));
      } catch (_) {}
    }
  });

  if (storageStatus) {
    storageStatus.textContent = 'Saved locally';
    storageStatus.title = 'Saved to LocalVault at ' + new Date().toLocaleTimeString();
  }
}

// Blank and sample starter documents are modularly imported from ./src/core.js (src/core/sample_notebook.js)



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


// --- Smooth Animated Viewport Glides & Zoom to Fit All ---

let viewportAnimFrame = null;
function animateViewport(targetX, targetY, targetZoom, duration = 320) {
  stopMomentum();
  if (viewportAnimFrame) cancelAnimationFrame(viewportAnimFrame);

  const startX = state.viewport.x;
  const startY = state.viewport.y;
  const startZoom = state.viewport.zoom;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    // Ease-out cubic: 1 - (1 - t)^3
    const ease = 1 - Math.pow(1 - progress, 3);

    state.viewport.x = startX + (targetX - startX) * ease;
    state.viewport.y = startY + (targetY - startY) * ease;
    state.viewport.zoom = startZoom + (targetZoom - startZoom) * ease;

    updateWorldTransform();

    if (progress < 1) {
      viewportAnimFrame = requestAnimationFrame(step);
    } else {
      viewportAnimFrame = null;
      debouncedSave(600);
    }
  }

  viewportAnimFrame = requestAnimationFrame(step);
}

function fitAllContent(animate = true) {
  if (!state.doc || !container) return;
  const blocks = state.doc.blocks || [];
  const strokes = state.doc.globalAnnotations || [];

  if (blocks.length === 0 && strokes.length === 0) {
    if (animate) animateViewport(40, 40, 1.0);
    else {
      state.viewport.x = 40;
      state.viewport.y = 40;
      state.viewport.zoom = 1.0;
      updateWorldTransform();
    }
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  blocks.forEach(b => {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + (b.width || 520));
    maxY = Math.max(maxY, b.y + (b.height || 360));
  });

  strokes.forEach(s => {
    if (s.points) {
      s.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
    }
  });

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const containerW = container.clientWidth || window.innerWidth;
  const containerH = container.clientHeight || window.innerHeight;

  const paddingX = Math.max(60, containerW * 0.1);
  const paddingY = Math.max(60, containerH * 0.1);
  const availW = containerW - paddingX * 2;
  const availH = containerH - paddingY * 2;

  const targetZoom = Math.min(2.0, Math.max(0.3, Math.min(availW / contentW, availH / contentH)));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const targetX = (containerW / 2) - centerX * targetZoom;
  const targetY = (containerH / 2) - centerY * targetZoom;

  if (animate) {
    animateViewport(targetX, targetY, targetZoom);
  } else {
    state.viewport.x = targetX;
    state.viewport.y = targetY;
    state.viewport.zoom = targetZoom;
    updateWorldTransform();
  }
}

// --- Kinetic Inertial Momentum Panning is modularly managed by src/canvas/kinetic_pan.js ---
let stopMomentum = () => {};


// --- Canvas Boundary Clamping & Dynamic Spatial Extension ---
function applyViewportClamping() {
  clampViewportBounds({
    viewport: state.viewport,
    doc: state.doc,
    containerWidth: container.offsetWidth || window.innerWidth
  });
}

function refreshScrollbars() {
  updateScrollbars({ state, container });
}

let lastRenderedZoom = -1;
function updateWorldTransform() {
  applyViewportClamping();
  world.style.transform = `translate3d(${state.viewport.x}px, ${state.viewport.y}px, 0px) scale(${state.viewport.zoom})`;
  
  const currentZoomPercent = Math.round(state.viewport.zoom * 100);
  if (currentZoomPercent !== lastRenderedZoom) {
    lastRenderedZoom = currentZoomPercent;
    zoomIndicator.textContent = currentZoomPercent + '%';
  }

  refreshScrollbars();
}

function renderAll() {
  updateWorldTransform();
  renderBlocks();
  renderGlobalAnnotations();
  updateSelectionStatus();
}

function updateSelectionStatus() {
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
    registerActiveDragCallback,
    unregisterActiveDragCallback,
    debouncedSave
  });
}

// --- Global Vector Ink Annotations ---

function renderGlobalAnnotations() {
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

// --- Ribbon Actions & Keyboard Shortcuts are modularly managed by src/ui/ribbon_actions.js & src/ui/keyboard_shortcuts.js ---


// --- Sidebar Controls ---



// --- Layout, Floating Puck & Inking Palette are now managed by src/ui/ modules ---



// --- Scrollbars, Edge Auto-Scroll & Ribbon are now managed by modular controllers ---


// Flush pending debounced auto-save immediately before window unloads, hides, or loses focus
const flushPendingSave = () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveActivePageDocument();
  }
};
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
