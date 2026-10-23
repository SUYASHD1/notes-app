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
  registerServiceWorker
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
  setupRibbonControls();
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
  setupKeyboardAndClipboard();
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

function createBlankDocument(pageId) {
  const pageMeta = state.hierarchy?.pages?.find(p => p.id === pageId);
  return new DocumentModel({
    id: pageId,
    title: pageMeta ? pageMeta.title : 'Untitled Page',
    blocks: [],
    globalAnnotations: []
  });
}

// Default Universal Note Containers
function createSampleDocument(pageId) {
  const doc = new DocumentModel({ id: pageId, title: 'Calculus & Physics Notes' });

  // Container 1: Kinematics & Derivatives (Mixed text, LaTeX math, table, and function plot)
  doc.addBlock({
    id: 'note_kinematics_1',
    type: 'note_container',
    x: 60,
    y: 60,
    width: 580,
    title: 'Kinematics & Derivatives',
    items: [
      {
        id: 'item_text_1',
        type: 'text',
        content: `# 1. Instantaneous Velocity
The derivative defines instantaneous rate of change:
$$v(t) = \\lim_{\\Delta t \\to 0} \\frac{x(t + \\Delta t) - x(t)}{\\Delta t} = \\frac{dx}{dt}$$
- [x] Limit definition reviewed
- [ ] Complete practice problems for tangent slopes`
      },
      {
        id: 'item_plot_1',
        type: 'plot',
        formula: 'sin(x) * exp(-0.15 * x)',
        xMin: -5,
        xMax: 15
      },
      {
        id: 'item_table_1',
        type: 'table',
        data: [
          ['Time t (s)', 'Position x (m)', 'Velocity v (m/s)'],
          ['0.0', '0.00', '10.0'],
          ['1.0', '8.50', '7.0'],
          ['2.0', '14.00', '4.0']
        ]
      }
    ]
  });

  // Container 2: Lecture Slides (PDF Printout)
  doc.addBlock({
    id: 'note_slides_2',
    type: 'note_container',
    x: 680,
    y: 60,
    width: 520,
    title: 'Lecture Slides & Materials',
    items: [
      {
        id: 'item_text_2',
        type: 'text',
        content: `### Reference Materials
Switch to **📱 iPad Ink** mode to draw annotations and diagrams directly over these slides.`
      },
      {
        id: 'item_pdf_1',
        type: 'pdf',
        title: 'Kinematics_Lecture_Week1.pdf',
        totalPages: 2
      }
    ]
  });

  return doc;
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

      // Determine if the user is actively pinching to zoom in or out
      const isPinchZooming = scaleFactor && scaleFactor > 0 && Math.abs(scaleFactor - 1.0) > 0.003;
      if (isPinchZooming) {
        // Boost pinch delta for responsive touchscreen/tablet zooming (natural OneNote / iPad parity)
        const delta = scaleFactor - 1.0;
        const boostedFactor = 1.0 + delta * 2.2;
        state.viewport.zoomAt(originX, originY, Math.max(0.6, Math.min(1.6, boostedFactor)));
      } else if (panDelta && (Math.abs(panDelta.dx) > 0.5 || Math.abs(panDelta.dy) > 0.5)) {
        // Two fingers gliding together without pinching: smooth scroll / pan
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

// --- Kinetic Inertial Momentum Panning ---

let panVelocity = { vx: 0, vy: 0 };
let lastPanSampleTime = 0;
let lastPanSamplePos = { x: 0, y: 0 };
let momentumAnimFrame = null;

function trackPanMove(clientX, clientY) {
  const now = performance.now();
  const dt = Math.max(1, now - lastPanSampleTime);
  if (dt < 120) {
    const instVx = ((clientX - lastPanSamplePos.x) / dt) * 16;
    const instVy = ((clientY - lastPanSamplePos.y) / dt) * 16;
    panVelocity.vx = panVelocity.vx * 0.35 + instVx * 0.65;
    panVelocity.vy = panVelocity.vy * 0.35 + instVy * 0.65;
  }
  lastPanSampleTime = now;
  lastPanSamplePos = { x: clientX, y: clientY };
}

function startMomentumPan() {
  if (momentumAnimFrame) cancelAnimationFrame(momentumAnimFrame);

  // If the user stopped moving before lifting their finger/mouse, don't fling
  if (performance.now() - lastPanSampleTime > 80) {
    panVelocity = { vx: 0, vy: 0 };
    return;
  }

  const speed = Math.hypot(panVelocity.vx, panVelocity.vy);
  if (speed < 0.8) {
    panVelocity = { vx: 0, vy: 0 };
    return;
  }

  const maxSpeed = 40;
  if (speed > maxSpeed) {
    panVelocity.vx = (panVelocity.vx / speed) * maxSpeed;
    panVelocity.vy = (panVelocity.vy / speed) * maxSpeed;
  }

  function momentumStep() {
    // Silky natural friction (OneNote / iPadOS style)
    panVelocity.vx *= 0.935;
    panVelocity.vy *= 0.935;

    state.viewport.pan(panVelocity.vx, panVelocity.vy);
    updateWorldTransform();

    if (Math.hypot(panVelocity.vx, panVelocity.vy) > 0.15) {
      momentumAnimFrame = requestAnimationFrame(momentumStep);
    } else {
      momentumAnimFrame = null;
      panVelocity = { vx: 0, vy: 0 };
      debouncedSave(600);
    }
  }

  momentumAnimFrame = requestAnimationFrame(momentumStep);
}

function stopMomentum() {
  if (momentumAnimFrame) {
    cancelAnimationFrame(momentumAnimFrame);
    momentumAnimFrame = null;
  }
  panVelocity = { vx: 0, vy: 0 };
}

// --- Canvas Boundary Clamping & Dynamic Spatial Extension ---
function getCanvasContentBounds() {
  let maxX = 2600; // comfortable multi-column initial width
  let maxY = 1800; // comfortable initial height
  if (state.doc && state.doc.blocks) {
    for (const b of state.doc.blocks) {
      const right = (b.x || 0) + (b.width || 520);
      const bottom = (b.y || 0) + (b.height || 400);
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
  }
  return {
    width: maxX + 800, // Generous 800px breathing room
    height: maxY + 800
  };
}

function clampViewportBounds() {
  const bounds = getCanvasContentBounds();
  const containerW = container.offsetWidth || window.innerWidth;

  // Fixed left boundary at margin x = 40 (cannot pan past left origin)
  // Right boundary limit so right edge doesn't pan past bounds.width
  const minX = Math.min(40, containerW - bounds.width * state.viewport.zoom);
  state.viewport.x = Math.max(minX, Math.min(40, state.viewport.x));

  // Top boundary margin anchored at y = 40 (cannot pan into void above canvas origin)
  // Downward vertical scrolling is 100% endless and unrestricted like a real continuous notebook!
  state.viewport.y = Math.min(40, state.viewport.y);
}

function updateScrollbars() {
  const sbH = document.getElementById('canvas-scrollbar-h');
  const sbV = document.getElementById('canvas-scrollbar-v');
  const thumbH = document.getElementById('canvas-scroll-thumb-h');
  const thumbV = document.getElementById('canvas-scroll-thumb-v');
  if (!sbH || !sbV || !thumbH || !thumbV) return;

  const bounds = getCanvasContentBounds();
  const containerW = container.offsetWidth || window.innerWidth;
  const containerH = container.offsetHeight || window.innerHeight;

  // Horizontal scrollbar
  const trackW = sbH.offsetWidth || 200;
  const visibleW = containerW / state.viewport.zoom;
  const thumbW = Math.max(30, Math.min(trackW, Math.round((visibleW / bounds.width) * trackW)));
  thumbH.style.width = `${thumbW}px`;

  const maxScrollX = Math.max(1, bounds.width * state.viewport.zoom - containerW + 40);
  const currentScrollX = Math.max(0, 40 - state.viewport.x);
  const scrollRatioX = Math.min(1, Math.max(0, currentScrollX / maxScrollX));
  thumbH.style.left = `${Math.round(scrollRatioX * (trackW - thumbW))}px`;

  // Vertical scrollbar: dynamic total space based on lowest content or current scroll position
  const currentWorldBottom = (containerH - state.viewport.y) / state.viewport.zoom;
  const totalWorldH = Math.max(bounds.height, currentWorldBottom + 600);
  const trackH = sbV.offsetHeight || 200;
  const visibleH = containerH / state.viewport.zoom;
  const thumbHHeight = Math.max(30, Math.min(trackH, Math.round((visibleH / totalWorldH) * trackH)));
  thumbV.style.height = `${thumbHHeight}px`;

  const maxScrollY = Math.max(1, totalWorldH * state.viewport.zoom - containerH + 40);
  const currentScrollY = Math.max(0, 40 - state.viewport.y);
  const scrollRatioY = Math.min(1, Math.max(0, currentScrollY / maxScrollY));
  thumbV.style.top = `${Math.round(scrollRatioY * (trackH - thumbHHeight))}px`;
}

let lastRenderedZoom = -1;
function updateWorldTransform() {
  clampViewportBounds();
  world.style.transform = `translate3d(${state.viewport.x}px, ${state.viewport.y}px, 0px) scale(${state.viewport.zoom})`;
  
  const currentZoomPercent = Math.round(state.viewport.zoom * 100);
  if (currentZoomPercent !== lastRenderedZoom) {
    lastRenderedZoom = currentZoomPercent;
    zoomIndicator.textContent = currentZoomPercent + '%';
  }

  updateScrollbars();
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

// --- Universal Note Containers Rendering ---

function renderBlocks() {
  blocksLayer.innerHTML = '';
  if (!state.doc) return;

  const blocks = state.doc.blocks || [];
  blocks.forEach(block => {
    // Normalization: Ensure container format
    if (block.type !== 'note_container') {
      block.type = 'note_container';
      if (!block.items) {
        block.items = [{ id: 'sub_' + block.id, type: block.type || 'text', ...block }];
      }
    }

    const el = document.createElement('div');
    const isSelected = state.selectedBlockIds.has(block.id);
    el.className = `universal-note-container ${isSelected ? 'selected' : ''}`;
    el.id = block.id;
    el.style.left = `${block.x}px`;
    el.style.top = `${block.y}px`;
    el.style.width = `${block.width || 560}px`;
    if (block.height && typeof block.height === 'number' && block.height > 0) {
      el.style.minHeight = `${block.height}px`;
    } else {
      el.style.minHeight = '';
    }

    el.addEventListener('mousedown', (e) => {
      if (state.mode === 'ipad') return;
      state.activeContainerId = block.id;
      if (!state.selectedBlockIds.has(block.id) && !e.shiftKey) {
        state.selectedBlockIds.clear();
        state.selectedBlockIds.add(block.id);
        document.querySelectorAll('.universal-note-container').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        updateSelectionStatus();
      }
    });

    // Drag-and-Drop Docking Support (docking images from canvas into this note)
    el.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/notes-dock-img')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drop-target-active');
      }
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drop-target-active');
      }
    });

    el.addEventListener('drop', (e) => {
      el.classList.remove('drop-target-active');
      const dockDataRaw = e.dataTransfer ? e.dataTransfer.getData('application/notes-dock-img') : null;
      if (dockDataRaw) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const dockData = JSON.parse(dockDataRaw);
          const sourceBlock = (state.doc.blocks || []).find(b => b.id === dockData.blockId);
          if (sourceBlock && sourceBlock.id !== block.id) {
            const imgItem = (sourceBlock.items || []).find(it => it.id === dockData.itemId) || {
              src: dockData.src,
              caption: dockData.caption,
              width: dockData.width
            };
            dockImageIntoContainer(imgItem, sourceBlock, block);
          }
        } catch (err) {
          console.warn('Dock drop failed:', err);
        }
      }
    });

    // 8-Point Resize Handles
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(dir => {
      const h = document.createElement('div');
      h.className = `resize-handle handle-${dir}`;
      h.dataset.dir = dir;
      attachResizeHandle(h, block, el, dir);
      el.appendChild(h);
    });

    // Container Header with Quick Tools
    const header = document.createElement('div');
    header.className = 'note-container-header';
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="block-handle-dots" style="cursor:grab; font-weight:bold; letter-spacing:2px; color:#94a3b8;">:::</span>
        <span style="font-weight: 600; color: #475569;">${block.title || 'NOTE'}</span>
      </div>
      <div class="note-container-tools">
        <button class="mini-tool-btn btn-add-sub-text" title="Add Text Section">+ Text</button>
        <button class="mini-tool-btn btn-add-sub-sketch" title="Insert Handwriting Canvas into Note">✍ Sketch</button>
        <button class="mini-tool-btn btn-add-sub-media" title="Insert Media/Image from Computer">🖼 Media</button>
        <button class="mini-tool-btn btn-add-sub-pdf" title="Insert PDF document from Computer">📑 PDF</button>
        <button class="mini-tool-btn btn-add-sub-tbl" title="Insert Table">⊞ Table</button>
        <button class="mini-tool-btn btn-add-sub-plot" title="Insert Math Plot">📈 Plot</button>
        <button class="block-delete-btn" title="Delete entire Note container" style="margin-left:4px; font-size:14px; font-weight:bold; color:#94a3b8; background:none; border:none; cursor:pointer;">&times;</button>
      </div>
    `;

    // Header Tool Handlers
    header.querySelector('.btn-add-sub-text').addEventListener('click', (e) => {
      e.stopPropagation();
      const newItem = { id: 'item_' + Date.now(), type: 'text', content: '' };
      block.items.push(newItem);
      state.focusItemId = newItem.id;
      saveActivePageDocument();
      renderAll();
    });

    header.querySelector('.btn-add-sub-sketch').addEventListener('click', (e) => {
      e.stopPropagation();
      block.items.push({
        id: 'item_sketch_' + Date.now(),
        type: 'sketch',
        height: 260,
        strokes: []
      });
      saveActivePageDocument();
      renderAll();
      showToast('✍ Added Handwriting Canvas to Note');
    });

    header.querySelector('.btn-add-sub-media').addEventListener('click', (e) => {
      e.stopPropagation();
      state.activeContainerId = block.id;
      mediaFileInput.click();
    });

    header.querySelector('.btn-add-sub-pdf').addEventListener('click', (e) => {
      e.stopPropagation();
      state.activeContainerId = block.id;
      pdfFileInput.click();
    });

    header.querySelector('.btn-add-sub-tbl').addEventListener('click', (e) => {
      e.stopPropagation();
      block.items.push({
        id: 'item_' + Date.now(),
        type: 'table',
        data: [
          ['Col 1', 'Col 2', 'Col 3'],
          ['Val 1', 'Val 2', 'Val 3']
        ]
      });
      saveActivePageDocument();
      renderAll();
      showToast('⊞ Added Table to Note');
    });

    header.querySelector('.btn-add-sub-plot').addEventListener('click', (e) => {
      e.stopPropagation();
      block.items.push({
        id: 'item_' + Date.now(),
        type: 'plot',
        formula: 'cos(x)',
        xMin: -10,
        xMax: 10
      });
      saveActivePageDocument();
      renderAll();
      showToast('📈 Added Math Plot to Note');
    });

    header.querySelector('.block-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      state.history.execute(new RemoveBlockCommand(state.doc, block.id));
      state.selectedBlockIds.delete(block.id);
      saveActivePageDocument();
      renderAll();
    });

    makeDraggable(el, header, block);
    el.appendChild(header);

    // Container Body with Mixed Media Items
    const body = document.createElement('div');
    body.className = 'note-container-body';

    // Click on empty space inside body to type/focus at the bottom
    body.addEventListener('click', (e) => {
      if (state.mode === 'ipad') return;
      if (e.target === body) {
        if (!block.items) block.items = [];
        const lastItem = block.items[block.items.length - 1];
        if (lastItem && lastItem.type === 'text') {
          const textEls = body.querySelectorAll('.note-item-text');
          const lastTextEl = textEls[textEls.length - 1];
          if (lastTextEl) {
            lastTextEl.click();
            const range = document.createRange();
            const sel = window.getSelection();
            if (sel) {
              range.selectNodeContents(lastTextEl);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        } else {
          const newItem = {
            id: 'item_' + Date.now(),
            type: 'text',
            content: ''
          };
          block.items.push(newItem);
          state.focusItemId = newItem.id;
          saveActivePageDocument();
          renderAll();
        }
      }
    });

    (block.items || []).forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'note-item';
      itemEl.dataset.itemId = item.id || `item_${index}`;

      // Delete single item button
      const delItemBtn = document.createElement('button');
      delItemBtn.className = 'note-item-delete';
      delItemBtn.title = 'Remove item';
      delItemBtn.innerHTML = '&times;';
      delItemBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        block.items.splice(index, 1);
        saveActivePageDocument();
        renderAll();
      });
      itemEl.appendChild(delItemBtn);

      switch (item.type) {
        case 'text':
          renderTextItem(itemEl, item, header, block);
          break;
        case 'image':
        case 'media':
          renderMediaItem(itemEl, item, block);
          break;
        case 'table':
          renderTableItem(itemEl, item, block);
          break;
        case 'plot':
          renderPlotItem(itemEl, item, block);
          break;
        case 'pdf':
        case 'pdf_printout':
          renderPDFItem(itemEl, item);
          break;
        case 'sketch':
        case 'inbox_canvas':
          renderSketchItem(itemEl, item, block);
          break;
        default:
          renderTextItem(itemEl, item, header, block);
          break;
      }

      body.appendChild(itemEl);
    });

    el.appendChild(body);
    blocksLayer.appendChild(el);

    if (el.offsetHeight > 0) {
      block.actualHeight = el.offsetHeight;
    }
  });
}

// Helper to permanently vault external images offline in IndexedDB
async function vaultExternalImage(src) {
  if (!src) return src;
  if (src.startsWith('data:image/')) {
    const assetId = 'asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await state.vault.storeAsset(assetId, src).catch(() => {});
    return src;
  }
  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    return src;
  }

  try {
    const resp = await fetch(src, { mode: 'cors' });
    if (!resp.ok) throw new Error('Fetch failed');
    const blob = await resp.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const assetId = 'asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await state.vault.storeAsset(assetId, dataUrl).catch(() => {});
    return dataUrl;
  } catch (err) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        tempImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = tempImg.naturalWidth || 400;
            canvas.height = tempImg.naturalHeight || 300;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (cErr) {
            reject(cErr);
          }
        };
        tempImg.onerror = reject;
        tempImg.src = src;
      });
      const assetId = 'asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await state.vault.storeAsset(assetId, dataUrl).catch(() => {});
      return dataUrl;
    } catch (_) {
      return src;
    }
  }
}

async function vaultImagesInTextItem(textItem, textDiv) {
  if (!textItem || !textItem.content) return;
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const matches = [...textItem.content.matchAll(imgRegex)];
  if (matches.length === 0) return;

  let changed = false;
  const urlMap = new Map();
  for (const m of matches) {
    const fullMatch = m[0];
    const rawAlt = m[1];
    const webUrl = m[2];
    try {
      const offlineDataUrl = await vaultExternalImage(webUrl);
      if (offlineDataUrl && offlineDataUrl !== webUrl) {
        textItem.content = textItem.content.replace(fullMatch, `![${rawAlt}](${offlineDataUrl})`);
        urlMap.set(webUrl, offlineDataUrl);
        changed = true;
      }
    } catch (e) {
      console.warn('Could not vault image:', webUrl, e);
    }
  }

  if (changed) {
    saveActivePageDocument();
    if (textDiv) {
      const imgs = textDiv.querySelectorAll('img.note-embedded-image');
      imgs.forEach(img => {
        if (urlMap.has(img.src)) {
          img.src = urlMap.get(img.src);
        } else {
          for (const [origUrl, dataUrl] of urlMap.entries()) {
            if (img.src.includes(origUrl) || origUrl.includes(img.src)) {
              img.src = dataUrl;
              break;
            }
          }
        }
      });
    }
    showToast('💾 Images permanently saved to local offline vault');
  }
}

// 1. Mixed Text & LaTeX Item with Interactive Image Controls & Text Wrapping
function renderTextItem(parentEl, item, headerEl, containerBlock) {
  const textDiv = document.createElement('div');
  textDiv.className = 'note-item-text';
  textDiv.setAttribute('data-placeholder', 'Type note here...');
  textDiv.contentEditable = 'true';

  const serializeTextContent = (el) => {
    if (!el) return '';
    // If it's plain text without tags or images, return clean text
    if (!el.innerHTML.includes('<') && !el.querySelector('img')) {
      return el.innerText || el.textContent || '';
    }
    // Retain clean rich HTML, stripping temporary floating toolbars
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(t => t.remove());
    clone.querySelectorAll('.selected-image').forEach(c => c.classList.remove('selected-image'));
    return clone.innerHTML;
  };

  // Binds floating toolbar and corner resize handle to embedded images
  function bindEmbeddedImageControls() {
    const containers = textDiv.querySelectorAll('.note-image-container');
    containers.forEach(imgContainer => {
      imgContainer.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(el => el.remove());

      imgContainer.addEventListener('click', (e) => {
        if (e.target.closest('.embedded-img-toolbar') || e.target.classList.contains('embedded-img-resize-handle')) {
          return;
        }
        e.stopPropagation();

        textDiv.querySelectorAll('.note-image-container.selected-image').forEach(c => {
          if (c !== imgContainer) {
            c.classList.remove('selected-image');
            c.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(el => el.remove());
          }
        });

        imgContainer.classList.add('selected-image');

        if (!imgContainer.querySelector('.embedded-img-toolbar')) {
          const rawWrap = imgContainer.getAttribute('data-wrap') || 'center';
          const toolbar = document.createElement('div');
          toolbar.className = 'embedded-img-toolbar';
          toolbar.contentEditable = 'false';
          toolbar.innerHTML = `
            <button class="img-tool-btn ${rawWrap === 'left' ? 'active' : ''}" data-action="wrap-left" title="Wrap text around left side of image">⬅️ Left</button>
            <button class="img-tool-btn ${rawWrap === 'center' ? 'active' : ''}" data-action="wrap-center" title="Center image between text blocks">⏸️ Center</button>
            <button class="img-tool-btn ${rawWrap === 'right' ? 'active' : ''}" data-action="wrap-right" title="Wrap text around right side of image">➡️ Right</button>
            <div class="img-tool-divider"></div>
            <button class="img-tool-btn btn-popout" data-action="pop-out" title="Take image out of box and place on canvas as independent card">🪟 Pop Out</button>
            <button class="img-tool-btn btn-danger" data-action="delete" title="Remove image">🗑️</button>
          `;

          toolbar.addEventListener('click', (btnEvt) => {
            btnEvt.stopPropagation();
            btnEvt.preventDefault();
            const btn = btnEvt.target.closest('button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');

            if (action === 'wrap-left') {
              imgContainer.setAttribute('data-wrap', 'left');
              imgContainer.classList.remove('wrap-center', 'wrap-right');
              imgContainer.classList.add('wrap-left');
              toolbar.querySelectorAll('.img-tool-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              item.content = serializeTextContent(textDiv);
              saveActivePageDocument();
            } else if (action === 'wrap-center') {
              imgContainer.setAttribute('data-wrap', 'center');
              imgContainer.classList.remove('wrap-left', 'wrap-right');
              imgContainer.classList.add('wrap-center');
              toolbar.querySelectorAll('.img-tool-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              item.content = serializeTextContent(textDiv);
              saveActivePageDocument();
            } else if (action === 'wrap-right') {
              imgContainer.setAttribute('data-wrap', 'right');
              imgContainer.classList.remove('wrap-left', 'wrap-center');
              imgContainer.classList.add('wrap-right');
              toolbar.querySelectorAll('.img-tool-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              item.content = serializeTextContent(textDiv);
              saveActivePageDocument();
            } else if (action === 'delete') {
              imgContainer.remove();
              item.content = serializeTextContent(textDiv);
              saveActivePageDocument();
              showToast('🗑️ Image removed');
            } else if (action === 'pop-out') {
              const imgEl = imgContainer.querySelector('img');
              const src = imgContainer.getAttribute('data-src') || (imgEl ? imgEl.src : '');
              const alt = imgContainer.getAttribute('data-alt') || (imgEl ? imgEl.alt : 'Detached Image');
              const width = imgContainer.offsetWidth || 400;

              imgContainer.remove();
              item.content = serializeTextContent(textDiv);
              saveActivePageDocument();

              const newNote = {
                id: 'block_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                type: 'note_container',
                x: (containerBlock ? containerBlock.x : 100) + (containerBlock ? (containerBlock.width || 520) : 520) + 40,
                y: containerBlock ? containerBlock.y : 100,
                width: Math.min(Math.max(width, 320), 720),
                title: alt || 'Detached Image',
                items: [{
                  id: 'item_img_' + Date.now(),
                  type: 'image',
                  src: src,
                  caption: alt || 'Detached Image',
                  width: width
                }]
              };
              state.history.execute(new AddBlockCommand(state.doc, newNote));
              saveActivePageDocument();
              renderAll();
              showToast('🪟 Detached image as an independent canvas unit');
            }
          });

          imgContainer.appendChild(toolbar);

          // Corner resize handle
          const handle = document.createElement('div');
          handle.className = 'embedded-img-resize-handle';
          handle.contentEditable = 'false';
          handle.title = 'Drag to resize image';

          handle.addEventListener('mousedown', (hEvt) => {
            hEvt.stopPropagation();
            hEvt.preventDefault();
            const startX = hEvt.clientX;
            const startWidth = imgContainer.offsetWidth;
            const maxAllowedWidth = textDiv.offsetWidth || 500;

            const onMouseMove = (moveEvt) => {
              const dx = (moveEvt.clientX - startX) / state.viewport.zoom;
              const newWidth = Math.max(100, Math.min(maxAllowedWidth, Math.round(startWidth + dx)));
              imgContainer.style.width = `${newWidth}px`;
              imgContainer.setAttribute('data-width', `${newWidth}px`);
            };

            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
              item.content = serializeTextContent(textDiv);
              saveActivePageDocument();
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          });

          imgContainer.appendChild(handle);
        }
      });
    });
  }

  const renderVisual = () => {
    const content = item.content || '';
    if (content.includes('<p') || content.includes('<h1') || content.includes('<h2') || content.includes('<h3') || content.includes('<h4') || content.includes('<div') || content.includes('<ul') || content.includes('<ol') || content.includes('<strong') || content.includes('<b>')) {
      textDiv.innerHTML = content;
    } else {
      textDiv.innerHTML = MarkdownLatexParser.renderToHtml(content);
    }
    bindEmbeddedImageControls();
  };

  // Initially render visual view
  renderVisual();

  // Deselect active images on outside click
  textDiv.addEventListener('click', (e) => {
    if (!e.target.closest('.note-image-container')) {
      textDiv.querySelectorAll('.note-image-container.selected-image').forEach(c => {
        c.classList.remove('selected-image');
        c.querySelectorAll('.embedded-img-toolbar, .embedded-img-resize-handle').forEach(el => el.remove());
      });
    }
  });

  const syncToItem = () => {
    if (!textDiv._dirty) return;
    textDiv._dirty = false;
    item.content = serializeTextContent(textDiv);
  };
  textDiv._syncContent = syncToItem;

  // Live in-place typing: 0ms keystroke latency (no recursive serialization on every keypress)
  textDiv.addEventListener('input', () => {
    textDiv._dirty = true;
    const hasText = (textDiv.innerText || textDiv.textContent || '').trim().length > 0;
    const hasMedia = textDiv.querySelector('img, .note-image-container, canvas, table') !== null;
    if (!hasText && !hasMedia && containerBlock) {
      if (containerBlock.height) {
        delete containerBlock.height;
      }
      const parentContainer = textDiv.closest('.universal-note-container');
      if (parentContainer) {
        parentContainer.style.minHeight = '';
      }
    }
    debouncedSave(800);
  });

  // Smart Notion/OneNote shortcuts (# + space, ## + space, - + space, etc.)
  textDiv.addEventListener('keydown', (e) => {
    if (isRawCodeMode) return;
    if (e.key === ' ' || e.code === 'Space') {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
        const node = sel.anchorNode;
        const textBeforeCursor = node.nodeValue.substring(0, sel.anchorOffset).trim();

        let formatCommand = null;
        let formatArg = null;
        if (textBeforeCursor === '#') {
          formatCommand = 'formatBlock';
          formatArg = '<h1>';
        } else if (textBeforeCursor === '##') {
          formatCommand = 'formatBlock';
          formatArg = '<h2>';
        } else if (textBeforeCursor === '###') {
          formatCommand = 'formatBlock';
          formatArg = '<h3>';
        } else if (textBeforeCursor === '-' || textBeforeCursor === '*') {
          formatCommand = 'insertUnorderedList';
        } else if (textBeforeCursor === '1.' || textBeforeCursor === '1)') {
          formatCommand = 'insertOrderedList';
        }

        if (formatCommand) {
          e.preventDefault();
          node.nodeValue = node.nodeValue.substring(sel.anchorOffset);
          if (formatCommand === 'formatBlock') {
            document.execCommand('formatBlock', false, formatArg);
          } else {
            document.execCommand(formatCommand, false, null);
          }
          textDiv._dirty = true;
          debouncedSave(800);
        }
      }
    }
  });

  // Interactive Checklists in visual mode
  textDiv.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
      const checkbox = e.target;
      const label = checkbox.closest('label');
      const labelText = label ? label.textContent.trim() : '';
      if (labelText) {
        const oldPrefix = checkbox.checked ? '- [ ] ' : '- [x] ';
        const newPrefix = checkbox.checked ? '- [x] ' : '- [ ] ';
        if (item.content && item.content.includes(oldPrefix + labelText)) {
          item.content = item.content.replace(oldPrefix + labelText, newPrefix + labelText);
        }
      }
      textDiv._dirty = true;
      saveActivePageDocument();
    }
  });

  // Rich Paste Handling: Direct WYSIWYG transfer matching MS Word architecture
  textDiv.addEventListener('paste', (e) => {
    e.stopPropagation();
    const htmlData = e.clipboardData?.getData('text/html');
    const plainText = e.clipboardData?.getData('text/plain');
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(it => it.type.startsWith('image/'));

    // 1. Direct Image Paste from Clipboard (Screenshots, Copied Image Files)
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = async (loadEvt) => {
          const dataUrl = loadEvt.target.result;
          await vaultExternalImage(dataUrl);

          const renderedHtml = MarkdownLatexParser.renderToHtml(`![Pasted Image](${dataUrl})`);
          document.execCommand('insertHTML', false, renderedHtml);
          item.content = serializeTextContent(textDiv);
          bindEmbeddedImageControls();
          saveActivePageDocument();
        };
        reader.readAsDataURL(file);
        return;
      }
    }

    // 2. Rich Text & Mixed HTML Paste from Web / Docs / MS Word
    if (htmlData && htmlData.trim()) {
      e.preventDefault();
      const cleanHtml = MarkdownLatexParser.sanitizeRichHtml(htmlData);
      document.execCommand('insertHTML', false, cleanHtml);
      item.content = serializeTextContent(textDiv);
      bindEmbeddedImageControls();
      saveActivePageDocument();
      // Asynchronously vault external web images in background
      vaultImagesInTextItem(item, textDiv);
      return;
    }

    // 3. Plain Text fallback
    if (plainText) {
      e.preventDefault();
      document.execCommand('insertText', false, plainText);
      item.content = serializeTextContent(textDiv);
      saveActivePageDocument();
      return;
    }
  });

  textDiv.addEventListener('blur', () => {
    syncToItem();
    saveActivePageDocument();
  });

  parentEl.appendChild(textDiv);

  if (state.focusItemId === item.id) {
    state.focusItemId = null;
    setTimeout(() => {
      textDiv.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      if (sel) {
        range.selectNodeContents(textDiv);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 20);
  }
}

// Helper to dock a standalone canvas image card into a target note container
function dockImageIntoContainer(imageItem, sourceBlock, targetContainer) {
  if (!targetContainer.items) targetContainer.items = [];
  let textItem = targetContainer.items.find(it => it.type === 'text' || !it.type);
  if (!textItem) {
    textItem = { id: 'item_text_' + Date.now(), type: 'text', content: '' };
    targetContainer.items.push(textItem);
  }

  const src = imageItem.src || imageItem.url;
  const caption = imageItem.caption || 'Docked Image';
  const widthAttr = imageItem.width ? `|width=${imageItem.width}px` : '';
  const markdownImg = `\n\n![${caption}${widthAttr}](${src})\n`;
  textItem.content = (textItem.content || '').trim() + markdownImg;

  if (sourceBlock) {
    if ((sourceBlock.items || []).length <= 1) {
      const idx = (state.doc.blocks || []).indexOf(sourceBlock);
      if (idx !== -1) {
        state.doc.blocks.splice(idx, 1);
      }
    } else {
      const itIdx = sourceBlock.items.indexOf(imageItem);
      if (itIdx !== -1) sourceBlock.items.splice(itIdx, 1);
    }
  }

  state.activeContainerId = targetContainer.id;
  state.selectedBlockIds.clear();
  state.selectedBlockIds.add(targetContainer.id);

  saveActivePageDocument();
  renderAll();
  showToast('📥 Image docked into note box');
}

// 2. Mixed Media / Local Image Item with Freeform Resizing & Cropping
function renderMediaItem(parentEl, item, containerBlock) {
  const mediaDiv = document.createElement('div');
  mediaDiv.className = 'note-item-media';

  const wrapper = document.createElement('div');
  wrapper.className = 'media-wrapper';
  if (item.width) {
    wrapper.style.width = typeof item.width === 'number' ? `${item.width}px` : item.width;
  }

  // Floating media toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'media-toolbar';
  toolbar.innerHTML = `
    <button class="media-tool-btn btn-dock" title="Dock this image back into a note box">📥 Dock</button>
    <button class="media-tool-btn btn-crop" title="Crop image">✂ Crop</button>
    ${item.originalSrc ? '<button class="media-tool-btn btn-reset-crop" title="Restore original uncropped image">↺ Reset</button>' : ''}
  `;

  // Dock button click
  const dockBtn = toolbar.querySelector('.btn-dock');
  if (dockBtn) {
    dockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const otherContainers = (state.doc.blocks || []).filter(b => b.id !== (containerBlock ? containerBlock.id : ''));
      if (otherContainers.length === 0) {
        showToast('ℹ️ Create or click another note box first to dock this image into');
        return;
      }
      let targetContainer = otherContainers.find(b => b.id === state.activeContainerId);
      if (!targetContainer) {
        let minDist = Infinity;
        for (const b of otherContainers) {
          const dist = Math.hypot((b.x || 0) - ((containerBlock ? containerBlock.x : 0) || 0), (b.y || 0) - ((containerBlock ? containerBlock.y : 0) || 0));
          if (dist < minDist) {
            minDist = dist;
            targetContainer = b;
          }
        }
      }
      if (targetContainer) {
        dockImageIntoContainer(item, containerBlock, targetContainer);
      }
    });
  }

  // Drag-and-drop docking support
  wrapper.draggable = true;
  wrapper.title = 'Drag onto any note box to dock it in!';
  wrapper.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('application/notes-dock-img', JSON.stringify({
      blockId: containerBlock ? containerBlock.id : null,
      itemId: item.id,
      src: item.src || item.url,
      caption: item.caption || 'Docked Image',
      width: item.width || 320
    }));
    e.dataTransfer.effectAllowed = 'move';
  });

  const img = document.createElement('img');
  img.src = item.src || item.url;
  img.alt = item.caption || 'Image';
  img.draggable = false;

  // Corner resize handle for freeform resizing
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'media-resize-handle';
  resizeHandle.title = 'Drag to resize image freely';

  resizeHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = wrapper.offsetWidth;
    const containerWidth = parentEl.offsetWidth || 500;

    const onMouseMove = (moveEvt) => {
      const dx = (moveEvt.clientX - startX) / state.viewport.zoom;
      const newWidth = Math.max(80, Math.min(containerWidth, Math.round(startWidth + dx)));
      wrapper.style.width = `${newWidth}px`;
      item.width = newWidth;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      saveActivePageDocument();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  toolbar.querySelector('.btn-crop').addEventListener('click', (e) => {
    e.stopPropagation();
    openImageCropper(item, () => {
      saveActivePageDocument();
      renderAll();
    });
  });

  if (item.originalSrc) {
    const resetBtn = toolbar.querySelector('.btn-reset-crop');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.src = item.originalSrc;
        delete item.originalSrc;
        saveActivePageDocument();
        renderAll();
        showToast('↺ Restored original image');
      });
    }
  }

  wrapper.appendChild(toolbar);
  wrapper.appendChild(img);
  wrapper.appendChild(resizeHandle);
  mediaDiv.appendChild(wrapper);

  if (item.caption) {
    const cap = document.createElement('div');
    cap.className = 'note-item-media-caption';
    cap.textContent = item.caption;
    mediaDiv.appendChild(cap);
  }

  parentEl.appendChild(mediaDiv);
}

// Built-in Interactive Image Cropper
function openImageCropper(item, onDone) {
  const backdrop = document.createElement('div');
  backdrop.className = 'crop-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'crop-modal';

  modal.innerHTML = `
    <div class="crop-modal-header">
      <span>✂ Crop Image</span>
      <button class="mini-btn btn-close-crop" style="font-size:18px; line-height:1; cursor:pointer;">&times;</button>
    </div>
    <div class="crop-modal-body">
      <div class="crop-stage">
        <img id="crop-source-img" src="${item.src || item.url}" alt="Crop Target" crossorigin="anonymous">
        <div id="crop-box-element" class="crop-box">
          <div class="crop-handle tl" data-handle="tl"></div>
          <div class="crop-handle tr" data-handle="tr"></div>
          <div class="crop-handle bl" data-handle="bl"></div>
          <div class="crop-handle br" data-handle="br"></div>
        </div>
      </div>
    </div>
    <div class="crop-modal-footer">
      <button class="btn btn-sm btn-reset-box">Full Size</button>
      <button class="btn btn-sm btn-cancel-crop">Cancel</button>
      <button class="btn btn-sm btn-accent btn-apply-crop">✓ Apply Crop</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const img = modal.querySelector('#crop-source-img');
  const cropBox = modal.querySelector('#crop-box-element');

  let cropState = { x: 0, y: 0, w: 100, h: 100 };

  const updateBoxDom = () => {
    cropBox.style.left = `${cropState.x}px`;
    cropBox.style.top = `${cropState.y}px`;
    cropBox.style.width = `${cropState.w}px`;
    cropBox.style.height = `${cropState.h}px`;
  };

  const initBox = () => {
    requestAnimationFrame(() => {
      const rect = img.getBoundingClientRect();
      const dispW = rect.width || img.offsetWidth || img.naturalWidth || 300;
      const dispH = rect.height || img.offsetHeight || img.naturalHeight || 200;
      const margin = Math.round(Math.min(dispW, dispH) * 0.1);
      cropState = {
        x: margin,
        y: margin,
        w: Math.max(40, dispW - margin * 2),
        h: Math.max(40, dispH - margin * 2)
      };
      updateBoxDom();
    });
  };

  if (img.complete && img.naturalWidth > 0) {
    initBox();
  } else {
    img.onload = initBox;
  }

  // Move Crop Box
  let isMoving = false;
  let moveStart = { x: 0, y: 0 };
  let startCrop = { x: 0, y: 0, w: 0, h: 0 };

  cropBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-handle')) return;
    e.stopPropagation();
    e.preventDefault();
    isMoving = true;
    moveStart = { x: e.clientX, y: e.clientY };
    startCrop = { ...cropState };

    const onMouseMove = (me) => {
      if (!isMoving) return;
      const dx = me.clientX - moveStart.x;
      const dy = me.clientY - moveStart.y;
      const dispW = img.offsetWidth;
      const dispH = img.offsetHeight;

      cropState.x = Math.max(0, Math.min(dispW - cropState.w, startCrop.x + dx));
      cropState.y = Math.max(0, Math.min(dispH - cropState.h, startCrop.y + dy));
      updateBoxDom();
    };

    const onMouseUp = () => {
      isMoving = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Resize handles
  modal.querySelectorAll('.crop-handle').forEach(h => {
    h.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const dir = h.dataset.handle;
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = { ...cropState };
      const dispW = img.offsetWidth;
      const dispH = img.offsetHeight;

      const onMouseMove = (me) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        if (dir === 'br') {
          cropState.w = Math.max(30, Math.min(dispW - orig.x, orig.w + dx));
          cropState.h = Math.max(30, Math.min(dispH - orig.y, orig.h + dy));
        } else if (dir === 'bl') {
          const newW = Math.max(30, Math.min(orig.x + orig.w, orig.w - dx));
          cropState.x = orig.x + (orig.w - newW);
          cropState.w = newW;
          cropState.h = Math.max(30, Math.min(dispH - orig.y, orig.h + dy));
        } else if (dir === 'tr') {
          cropState.w = Math.max(30, Math.min(dispW - orig.x, orig.w + dx));
          const newH = Math.max(30, Math.min(orig.y + orig.h, orig.h - dy));
          cropState.y = orig.y + (orig.h - newH);
          cropState.h = newH;
        } else if (dir === 'tl') {
          const newW = Math.max(30, Math.min(orig.x + orig.w, orig.w - dx));
          const newH = Math.max(30, Math.min(orig.y + orig.h, orig.h - dy));
          cropState.x = orig.x + (orig.w - newW);
          cropState.y = orig.y + (orig.h - newH);
          cropState.w = newW;
          cropState.h = newH;
        }
        updateBoxDom();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  });

  // Buttons
  modal.querySelector('.btn-reset-box').addEventListener('click', () => {
    cropState = { x: 0, y: 0, w: img.offsetWidth, h: img.offsetHeight };
    updateBoxDom();
  });

  const closeCrop = () => backdrop.remove();
  modal.querySelector('.btn-close-crop').addEventListener('click', closeCrop);
  modal.querySelector('.btn-cancel-crop').addEventListener('click', closeCrop);

  modal.querySelector('.btn-apply-crop').addEventListener('click', () => {
    try {
      const rect = img.getBoundingClientRect();
      const dispW = rect.width || img.offsetWidth || img.naturalWidth || 300;
      const dispH = rect.height || img.offsetHeight || img.naturalHeight || 200;

      const natW = img.naturalWidth || dispW;
      const natH = img.naturalHeight || dispH;

      const scaleX = dispW > 0 ? (natW / dispW) : 1;
      const scaleY = dispH > 0 ? (natH / dispH) : 1;

      let naturalX = Math.max(0, Math.min(natW - 1, Math.round(cropState.x * scaleX)));
      let naturalY = Math.max(0, Math.min(natH - 1, Math.round(cropState.y * scaleY)));
      let naturalW = Math.max(1, Math.min(natW - naturalX, Math.round(cropState.w * scaleX)));
      let naturalH = Math.max(1, Math.min(natH - naturalY, Math.round(cropState.h * scaleY)));

      const canvas = document.createElement('canvas');
      canvas.width = naturalW;
      canvas.height = naturalH;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, naturalX, naturalY, naturalW, naturalH, 0, 0, naturalW, naturalH);

      const croppedData = canvas.toDataURL('image/png');
      if (!item.originalSrc) {
        item.originalSrc = item.src || item.url;
      }
      item.src = croppedData;
      delete item.url;

      closeCrop();
      onDone();
      showToast('✂ Image cropped successfully');
    } catch (err) {
      console.error('Crop error:', err);
      closeCrop();
      showToast('⚠️ Crop notice: ' + (err.message || 'Unable to export canvas'));
    }
  });
}

// 3. Mixed Table Item
function renderTableItem(parentEl, item, containerBlock) {
  const tableDiv = document.createElement('div');
  tableDiv.style.overflowX = 'auto';

  const rows = item.data || [
    ['Col 1', 'Col 2', 'Col 3'],
    ['Val 1', 'Val 2', 'Val 3']
  ];

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '4px';
  controls.style.marginBottom = '6px';
  controls.innerHTML = `
    <button class="tbl-btn-row mini-tool-btn">+ Row</button>
    <button class="tbl-btn-col mini-tool-btn">+ Column</button>
  `;

  controls.querySelector('.tbl-btn-row').addEventListener('click', (e) => {
    e.stopPropagation();
    const cols = rows[0] ? rows[0].length : 3;
    rows.push(new Array(cols).fill(''));
    item.data = rows;
    saveActivePageDocument();
    renderAll();
  });

  controls.querySelector('.tbl-btn-col').addEventListener('click', (e) => {
    e.stopPropagation();
    rows.forEach((r, idx) => r.push(idx === 0 ? `Header ${r.length + 1}` : ''));
    item.data = rows;
    saveActivePageDocument();
    renderAll();
  });

  tableDiv.appendChild(controls);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  rows.forEach((row, rIdx) => {
    const tr = document.createElement('tr');
    row.forEach((cell, cIdx) => {
      const td = document.createElement(rIdx === 0 ? 'th' : 'td');
      td.contentEditable = 'true';
      td.textContent = cell;
      td.style.border = '1px solid #cbd5e1';
      td.style.padding = '6px 10px';
      td.style.background = rIdx === 0 ? '#f8fafc' : '#ffffff';
      td.style.fontWeight = rIdx === 0 ? '600' : 'normal';

      td.addEventListener('input', () => {
        rows[rIdx][cIdx] = td.textContent;
        item.data = rows;
        saveActivePageDocument();
      });
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  tableDiv.appendChild(table);
  parentEl.appendChild(tableDiv);
}

// 4. Mixed Math Function Plot Item
function renderPlotItem(parentEl, item, containerBlock) {
  const plotDiv = document.createElement('div');
  plotDiv.style.border = '1px solid #e2e8f0';
  plotDiv.style.borderRadius = '6px';
  plotDiv.style.overflow = 'hidden';

  const formula = item.formula || 'sin(x)';

  plotDiv.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; padding:6px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <span style="font-size:13px; font-weight:700; color:#475569;">y =</span>
      <input type="text" class="plot-input" value="${formula}" style="flex:1; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-family:monospace; font-size:13px;">
      <button class="mini-tool-btn btn-plot-run" style="background:#4f46e5; color:#fff; border:none; padding:4px 10px;">Plot</button>
    </div>
    <canvas class="plot-canvas" width="480" height="220" style="width:100%; height:220px; display:block; background:#fff;"></canvas>
  `;

  const input = plotDiv.querySelector('.plot-input');
  const btn = plotDiv.querySelector('.btn-plot-run');
  const canvas = plotDiv.querySelector('.plot-canvas');

  const plotAction = () => {
    item.formula = input.value;
    drawPlot(canvas, item.formula, item.xMin ?? -10, item.xMax ?? 10);
    saveActivePageDocument();
  };

  btn.addEventListener('click', plotAction);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') plotAction(); });

  parentEl.appendChild(plotDiv);
  setTimeout(() => drawPlot(canvas, formula, item.xMin ?? -10, item.xMax ?? 10), 10);
}

function drawPlot(canvas, expr, xMin = -10, xMax = 10) {
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);

  const points = FunctionPlotter.generatePlotPoints(expr, xMin, xMax, 300);
  const validY = points.filter(p => p.y !== null).map(p => p.y);
  const yMin = validY.length ? Math.min(-2, Math.min(...validY)) : -5;
  const yMax = validY.length ? Math.max(2, Math.max(...validY)) : 5;

  const toScreenX = (x) => ((x - xMin) / (xMax - xMin)) * w;
  const toScreenY = (y) => h - ((y - yMin) / (yMax - yMin)) * h;

  // Grid
  g.strokeStyle = '#f1f5f9';
  g.lineWidth = 1;
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x += 2) {
    g.beginPath(); g.moveTo(toScreenX(x), 0); g.lineTo(toScreenX(x), h); g.stroke();
  }

  // Axes
  g.strokeStyle = '#94a3b8';
  g.lineWidth = 1.5;
  if (yMin <= 0 && yMax >= 0) {
    const y0 = toScreenY(0);
    g.beginPath(); g.moveTo(0, y0); g.lineTo(w, y0); g.stroke();
  }
  if (xMin <= 0 && xMax >= 0) {
    const x0 = toScreenX(0);
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, h); g.stroke();
  }

  // Curve
  g.strokeStyle = '#4f46e5';
  g.lineWidth = 2.5;
  g.beginPath();
  let started = false;
  points.forEach(p => {
    if (p.y === null) {
      started = false;
    } else {
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      if (!started) {
        g.moveTo(sx, sy);
        started = true;
      } else {
        g.lineTo(sx, sy);
      }
    }
  });
  g.stroke();
}

// PDF Document Cache: In-memory parsed documents so binaries are parsed once without memory leaks
const pdfDocCache = new Map();

// 5. Mixed PDF Printout Item (OneNote Slide Printout with Natural Sizing & High-DPI Vector Crispness)
function renderPDFItem(parentEl, item) {
  // Purge any legacy bloated base64 pages from localStorage to prevent QuotaExceededError
  if (item.pages) {
    delete item.pages;
  }

  const pdfCard = document.createElement('div');
  pdfCard.className = 'pdf-printout-card';

  const header = document.createElement('div');
  header.className = 'pdf-printout-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="font-weight:600; color:#1e293b;">📄 ${item.title || 'PDF Document'}</span>
      <span class="badge" style="font-size:10px;">${item.totalPages ? `${item.totalPages} Page${item.totalPages > 1 ? 's' : ''}` : 'Loading...'}</span>
    </div>
    <div style="display:flex; align-items:center; gap:6px;">
      ${item.dataUrl ? `<a href="${item.dataUrl}" download="${item.title || 'Document.pdf'}" class="mini-tool-btn" style="text-decoration:none; color:#2563eb;" title="Download or open original PDF file">💾 Original PDF</a>` : ''}
    </div>
  `;
  pdfCard.appendChild(header);

  const pagesContainer = document.createElement('div');
  pagesContainer.className = 'pdf-pages-container';

  if (!item.dataUrl) {
    // Check if large PDF dataUrl is cached in IndexedDB
    getAssetIDB(item.id).then(cachedUrl => {
      if (cachedUrl) {
        item.dataUrl = cachedUrl;
        renderPDFItem(parentEl, item);
      }
    }).catch(() => {});

    pagesContainer.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #475569; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📑</div>
        <div style="font-weight: 600; margin-bottom: 4px; color: #1e293b;">${item.title || 'Sample Document'}</div>
        <div style="font-size: 0.8rem; color: #64748b; max-width: 320px; margin: 0 auto;">
          To view and annotate an actual PDF, click <b>📑 PDF</b> in the toolbar above and select any PDF from your computer or iPad.
        </div>
      </div>
    `;
    pdfCard.appendChild(pagesContainer);
    parentEl.appendChild(pdfCard);
    return;
  }

  pagesContainer.innerHTML = `<div class="pdf-loading"><div>⏳ Rendering PDF pages at natural resolution...</div></div>`;
  pdfCard.appendChild(pagesContainer);
  parentEl.appendChild(pdfCard);

  // Render via PDF.js on demand
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    try {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      } catch (_) {}

      const docKey = item.id || (item.dataUrl ? item.dataUrl.slice(0, 100) : 'default_pdf');
      let docPromise = pdfDocCache.get(docKey);

      if (!docPromise) {
        const base64 = item.dataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        docPromise = window.pdfjsLib.getDocument({ data: bytes }).promise.catch(async () => {
          // Fallback if cross-origin Web Worker fails on Mobile Safari
          return window.pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
        });
        pdfDocCache.set(docKey, docPromise);
      }

      docPromise.then(async (pdf) => {
        item.totalPages = pdf.numPages;
        const badgeEl = header.querySelector('.badge');
        if (badgeEl) badgeEl.textContent = `${pdf.numPages} Page${pdf.numPages > 1 ? 's' : ''}`;
        pagesContainer.innerHTML = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const slideCard = document.createElement('div');
          slideCard.className = 'pdf-slide-card';

          const slideHeader = document.createElement('div');
          slideHeader.className = 'pdf-slide-header';
          slideHeader.textContent = `Page ${pageNum} of ${pdf.numPages}`;
          slideCard.appendChild(slideHeader);

          const canvasWrapper = document.createElement('div');
          canvasWrapper.className = 'pdf-canvas-wrapper';

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          canvasWrapper.appendChild(canvas);
          slideCard.appendChild(canvasWrapper);
          pagesContainer.appendChild(slideCard);

          try {
            const page = await pdf.getPage(pageNum);
            const unscaledVp = page.getViewport({ scale: 1.0 });

            // Preserve natural page aspect ratio (e.g. A4 / Letter)
            canvasWrapper.style.aspectRatio = `${unscaledVp.width} / ${unscaledVp.height}`;

            // High-DPI Vector Scale: dynamically scales with devicePixelRatio & zoom so PDF never pixelates
            const dpr = window.devicePixelRatio || 1;
            const targetScale = Math.max(2.5, Math.min(4.0, dpr * Math.max(1, state.viewport.zoom * 1.2)));
            const viewport = page.getViewport({ scale: targetScale });

            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            canvas.style.width = '100%';
            canvas.style.height = 'auto';

            await page.render({
              canvasContext: canvas.getContext('2d'),
              viewport: viewport
            }).promise;
          } catch (pageErr) {
            console.error(`Error rendering page ${pageNum}:`, pageErr);
            canvasWrapper.innerHTML = `<div class="pdf-error">Page ${pageNum} failed to render.</div>`;
          }
        }
      }).catch(err => {
        console.error('PDF.js render error:', err);
        pdfDocCache.delete(docKey);
        pagesContainer.innerHTML = `
          <div class="pdf-error">Failed to load PDF document: ${err.message || 'Unknown error'}</div>
        `;
      });
    } catch (err) {
      console.error('PDF setup error:', err);
      pagesContainer.innerHTML = `
        <div class="pdf-error">Error setting up PDF: ${err.message}</div>
      `;
    }
  } else {
    pagesContainer.innerHTML = `
      <div class="pdf-error">PDF.js library not available.</div>
    `;
  }
}

// 6. Mixed In-Box Handwriting Canvas Item (Contained with Defined Regions & Local Resizing)
function renderSketchItem(parentEl, item, containerBlock) {
  const sketchCard = document.createElement('div');
  sketchCard.className = 'note-item-sketch-card';

  const defaultHeight = typeof item.height === 'number' && item.height >= 100 ? item.height : 260;
  item.height = defaultHeight;
  if (!Array.isArray(item.strokes)) {
    item.strokes = [];
  }

  // Header with quick controls
  const header = document.createElement('div');
  header.className = 'note-sketch-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px;">
      <span style="font-size:12px; font-weight:600; color:#475569;">✍ Handwriting Canvas</span>
      <span class="badge" style="font-size:10px;">${item.strokes.length} Stroke${item.strokes.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px;">
      <button class="mini-tool-btn btn-sketch-clear" title="Clear all strokes in this canvas">🗑 Clear</button>
    </div>
  `;
  sketchCard.appendChild(header);

  // Canvas Stage Wrapper with fixed boundaries
  const stage = document.createElement('div');
  stage.className = 'note-sketch-stage';
  stage.style.height = `${item.height}px`;

  // SVG Layer for permanent crisp vector stroke display
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'note-sketch-svg');
  stage.appendChild(svg);

  // Active interaction canvas for in-progress drawing / erasing
  const canvas = document.createElement('canvas');
  canvas.className = 'note-sketch-canvas';
  stage.appendChild(canvas);

  // Bottom edge height resize handle
  const resizeBar = document.createElement('div');
  resizeBar.className = 'note-sketch-resize-bar';
  resizeBar.title = 'Drag down or up to resize handwriting canvas height';
  resizeBar.innerHTML = `<div class="resize-grip-line"></div>`;

  sketchCard.appendChild(stage);
  sketchCard.appendChild(resizeBar);
  parentEl.appendChild(sketchCard);

  // Render SVG strokes
  const renderStrokesToSvg = () => {
    svg.innerHTML = '';
    item.strokes.forEach(stroke => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', StrokeRenderer.pointsToSvgPath(stroke.points));
      path.setAttribute('stroke', stroke.color || '#0f172a');
      path.setAttribute('stroke-width', stroke.width || 3);
      path.setAttribute('fill', stroke.shapeType === ShapeType.CIRCLE || stroke.shapeType === ShapeType.RECTANGLE || stroke.shapeType === ShapeType.TRIANGLE ? 'rgba(99, 102, 241, 0.05)' : 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    });

    const badge = header.querySelector('.badge');
    if (badge) {
      badge.textContent = `${item.strokes.length} Stroke${item.strokes.length !== 1 ? 's' : ''}`;
    }
  };

  renderStrokesToSvg();

  // Resize Canvas buffer to match stage width/height
  const updateCanvasDimensions = () => {
    const rect = stage.getBoundingClientRect();
    const w = Math.round(rect.width || stage.offsetWidth || 400);
    const h = item.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  requestAnimationFrame(updateCanvasDimensions);

  // Clear button handler
  header.querySelector('.btn-sketch-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.strokes.length === 0) return;
    item.strokes = [];
    renderStrokesToSvg();
    saveActivePageDocument();
    showToast('🗑 Cleared handwriting canvas');
  });

  // Local drawing & erasing interaction inside this box
  let isLocalDrawing = false;
  let isLocalErasing = false;
  let localDrawStartTime = 0;
  let localPoints = [];
  const localCtx = canvas.getContext('2d');

  const applyLocalEraser = (lx, ly) => {
    const radius = state.eraserSize || 24;
    if (state.eraserMode === 'full') {
      const res = EraserEngine.eraseFullStrokes(item.strokes, lx, ly, radius);
      if (res.removedStrokes.length > 0) {
        item.strokes = res.remainingStrokes;
        renderStrokesToSvg();
      }
    } else {
      const res = EraserEngine.erasePartialStrokes(item.strokes, lx, ly, radius);
      if (res.modified) {
        item.strokes = res.updatedStrokes;
        renderStrokesToSvg();
      }
    }
  };

  const drawLocalEraserCursor = (lx, ly) => {
    localCtx.clearRect(0, 0, canvas.width, canvas.height);
    localCtx.save();
    localCtx.beginPath();
    localCtx.arc(lx, ly, state.eraserSize || 24, 0, Math.PI * 2);
    localCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    localCtx.lineWidth = 1.5;
    localCtx.stroke();
    localCtx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    localCtx.fill();
    localCtx.restore();
  };

  const onLocalPointerDown = (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    try {
      if (canvas.setPointerCapture && e.pointerId !== undefined) {
        canvas.setPointerCapture(e.pointerId);
      }
    } catch (_) {}
    updateCanvasDimensions();

    const rect = canvas.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    if (state.inkTool === 'eraser') {
      isLocalErasing = true;
      applyLocalEraser(lx, ly);
      drawLocalEraserCursor(lx, ly);
      return;
    }

    isLocalDrawing = true;
    localDrawStartTime = Date.now();
    const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.6;
    localPoints = [{ x: lx, y: ly, time: Date.now(), pressure }];

    localCtx.strokeStyle = state.inkColor || '#0f172a';
    localCtx.lineWidth = state.inkWidth || 3;
    localCtx.lineCap = 'round';
    localCtx.lineJoin = 'round';
    localCtx.beginPath();
    localCtx.moveTo(lx, ly);
  };

  const onLocalPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    if (state.inkTool === 'eraser') {
      drawLocalEraserCursor(lx, ly);
      if (isLocalErasing) {
        applyLocalEraser(lx, ly);
      }
      return;
    }

    if (!isLocalDrawing) return;
    const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.6;
    localPoints.push({ x: lx, y: ly, time: Date.now(), pressure });
    localCtx.lineTo(lx, ly);
    localCtx.stroke();
  };

  const finishLocalInteraction = (e) => {
    if (e && e.pointerId !== undefined) {
      try {
        if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    }

    if (isLocalErasing) {
      isLocalErasing = false;
      localCtx.clearRect(0, 0, canvas.width, canvas.height);
      saveActivePageDocument();
      return;
    }

    if (!isLocalDrawing) return;
    isLocalDrawing = false;
    localCtx.clearRect(0, 0, canvas.width, canvas.height);

    if (localPoints.length > 2) {
      const holdDuration = Date.now() - localDrawStartTime;
      const shapeResult = ShapeDetector.detectShape(localPoints, holdDuration);

      let finalPoints = localPoints;
      let shapeType = ShapeType.NONE;

      if (shapeResult.detected) {
        shapeType = shapeResult.type;
        if (shapeResult.type === ShapeType.LINE) {
          finalPoints = [shapeResult.geometry.start, shapeResult.geometry.end];
          showToast('📐 Snapped to Straight Line');
        } else if (shapeResult.type === ShapeType.CIRCLE) {
          const { cx, cy, radius } = shapeResult.geometry;
          finalPoints = [];
          for (let i = 0; i <= 36; i++) {
            const a = (i / 36) * 2 * Math.PI;
            finalPoints.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
          }
          showToast('⭕ Snapped to Circle');
        } else if (shapeResult.type === ShapeType.RECTANGLE) {
          const { x, y, width, height } = shapeResult.geometry;
          finalPoints = [
            { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }
          ];
          showToast('▭ Snapped to Rectangle');
        } else if (shapeResult.type === ShapeType.TRIANGLE) {
          const { p1, p2, p3 } = shapeResult.geometry;
          finalPoints = [p1, p2, p3, p1];
          showToast('▲ Snapped to Triangle');
        }
      } else {
        finalPoints = StrokeRenderer.smoothPoints(localPoints);
      }

      item.strokes.push({
        id: 'stroke_' + Math.random().toString(36).substr(2, 9),
        color: state.inkColor || '#0f172a',
        width: state.inkWidth || 3,
        points: finalPoints,
        shapeType
      });

      renderStrokesToSvg();
      saveActivePageDocument();
    }
    localPoints = [];
  };

  canvas.addEventListener('pointerdown', onLocalPointerDown);
  canvas.addEventListener('pointermove', onLocalPointerMove);
  canvas.addEventListener('pointerup', finishLocalInteraction);
  canvas.addEventListener('pointercancel', finishLocalInteraction);
  canvas.addEventListener('mousedown', onLocalPointerDown);
  canvas.addEventListener('mousemove', onLocalPointerMove);
  canvas.addEventListener('mouseup', finishLocalInteraction);

  // Resizing the height of the handwriting canvas via bottom drag bar
  const onResizePointerDown = (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    try {
      if (resizeBar.setPointerCapture && e.pointerId !== undefined) {
        resizeBar.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    const startY = e.clientY;
    const origHeight = item.height;

    const onMove = (me) => {
      const dy = (me.clientY - startY) / state.viewport.zoom;
      const newHeight = Math.max(120, Math.min(1200, Math.round(origHeight + dy)));
      item.height = newHeight;
      stage.style.height = `${newHeight}px`;
      canvas.height = newHeight;
    };

    const onUp = (ue) => {
      try {
        if (ue && ue.pointerId !== undefined && resizeBar.hasPointerCapture && resizeBar.hasPointerCapture(ue.pointerId)) {
          resizeBar.releasePointerCapture(ue.pointerId);
        }
      } catch (_) {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      saveActivePageDocument();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  resizeBar.addEventListener('pointerdown', onResizePointerDown);
  resizeBar.addEventListener('mousedown', onResizePointerDown);

}

// --- 8-Point Bounding Box Resizing ---

function attachResizeHandle(handleEl, block, blockEl, dir) {
  const isVertical = dir.includes('n') || dir.includes('s');

  // Double click on boundary resets height back to auto-fit content
  handleEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.preventDefault();
    delete block.height;
    blockEl.style.minHeight = '';
    saveActivePageDocument();
    showToast('↕ Reset height to content');
  });

  const onPointerDown = (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    try {
      if (handleEl.setPointerCapture && e.pointerId !== undefined) {
        handleEl.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    const startX = e.clientX;
    const startY = e.clientY;
    const currentHeight = blockEl.offsetHeight;
    const origBox = {
      x: block.x,
      y: block.y,
      width: block.width || blockEl.offsetWidth,
      height: (typeof block.height === 'number' && block.height > 0) ? Math.max(block.height, currentHeight) : currentHeight
    };

    const onPointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / state.viewport.zoom;
      const dy = (moveEvent.clientY - startY) / state.viewport.zoom;

      const newBox = ResizeHandleEngine.applyResize(dir, origBox, dx, dy, 260, 80);
      block.x = Math.round(newBox.x);
      block.y = Math.round(newBox.y);
      block.width = Math.round(newBox.width);

      blockEl.style.left = `${block.x}px`;
      blockEl.style.top = `${block.y}px`;
      blockEl.style.width = `${block.width}px`;

      // Only lock height if the user is resizing vertically (n, s, or corners)
      if (isVertical) {
        block.height = Math.round(newBox.height);
        blockEl.style.minHeight = `${block.height}px`;
      }
    };

    const onPointerUp = (upEvent) => {
      try {
        if (upEvent && upEvent.pointerId !== undefined && handleEl.hasPointerCapture && handleEl.hasPointerCapture(upEvent.pointerId)) {
          handleEl.releasePointerCapture(upEvent.pointerId);
        }
      } catch (_) {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      saveActivePageDocument();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  };

  handleEl.addEventListener('pointerdown', onPointerDown);
  handleEl.addEventListener('mousedown', onPointerDown);
}

// Dragging Universal Note Containers
function makeDraggable(el, handle, block) {
  const onPointerDown = (e) => {
    if (state.mode === 'ipad') return;
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    try {
      if (handle.setPointerCapture && e.pointerId !== undefined) {
        handle.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    state.activeContainerId = block.id;

    if (!e.shiftKey && !state.selectedBlockIds.has(block.id)) {
      state.selectedBlockIds.clear();
      state.selectedBlockIds.add(block.id);
    } else if (e.shiftKey) {
      if (state.selectedBlockIds.has(block.id)) {
        state.selectedBlockIds.delete(block.id);
      } else {
        state.selectedBlockIds.add(block.id);
      }
    }
    renderAll();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPositions = new Map();

    state.selectedBlockIds.forEach(id => {
      const b = state.doc.getBlock(id);
      if (b) initialPositions.set(id, { x: b.x, y: b.y });
    });

    const onPointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / state.viewport.zoom;
      const dy = (moveEvent.clientY - startY) / state.viewport.zoom;

      initialPositions.forEach((pos, id) => {
        const targetBlock = state.doc.getBlock(id);
        const targetEl = document.getElementById(id);
        if (targetBlock && targetEl) {
          targetBlock.x = Math.round(pos.x + dx);
          targetBlock.y = Math.round(pos.y + dy);
          targetEl.style.left = `${targetBlock.x}px`;
          targetEl.style.top = `${targetBlock.y}px`;
        }
      });
    };

    const onPointerUp = (upEvent) => {
      try {
        if (upEvent && upEvent.pointerId !== undefined && handle.hasPointerCapture && handle.hasPointerCapture(upEvent.pointerId)) {
          handle.releasePointerCapture(upEvent.pointerId);
        }
      } catch (_) {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      debouncedSave(600);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('mousedown', onPointerDown);
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

let isSpaceDown = false;
let lastMoveTime = 0;
let lastMovePoint = { x: 0, y: 0 };

function setupCanvasInteractions() {
  // 1. Natural Wheel & Touchpad Zoom / Pan with 60-120 FPS requestAnimationFrame coalescing
  let pendingWheelPanX = 0;
  let pendingWheelPanY = 0;
  let pendingWheelZoomFactor = 1.0;
  let pendingWheelCursorX = 0;
  let pendingWheelCursorY = 0;
  let hasPendingWheelZoom = false;
  let hasPendingWheelPan = false;
  let wheelRafId = null;
  let wheelSaveTimer = null;

  function flushWheelTransform() {
    wheelRafId = null;
    if (hasPendingWheelZoom) {
      state.viewport.zoomAt(pendingWheelCursorX, pendingWheelCursorY, pendingWheelZoomFactor);
      pendingWheelZoomFactor = 1.0;
      hasPendingWheelZoom = false;
    }
    if (hasPendingWheelPan) {
      state.viewport.pan(pendingWheelPanX, pendingWheelPanY);
      pendingWheelPanX = 0;
      pendingWheelPanY = 0;
      hasPendingWheelPan = false;
    }
    updateWorldTransform();
  }

  function scheduleWheelTransform() {
    if (!wheelRafId) {
      wheelRafId = requestAnimationFrame(flushWheelTransform);
    }
    if (wheelSaveTimer) clearTimeout(wheelSaveTimer);
    wheelSaveTimer = setTimeout(() => {
      saveActivePageDocument();
    }, 1000);
  }

  container.addEventListener('wheel', (e) => {
    // In Ink Mode: strictly block all navigation gestures!
    if (state.mode === 'ipad') {
      e.preventDefault();
      return;
    }

    // Zoom handling: Ctrl/Meta key or touchpad pinch
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Continuous exponential zoom scaling (smooth on both precision touchpads and notched wheels)
      const zoomSensitivity = e.deltaMode === 1 ? 0.04 : 0.0065;
      const factor = Math.min(1.38, Math.max(0.72, Math.exp(-e.deltaY * zoomSensitivity)));

      pendingWheelZoomFactor *= factor;
      pendingWheelCursorX = cursorX;
      pendingWheelCursorY = cursorY;
      hasPendingWheelZoom = true;
      scheduleWheelTransform();
      return;
    }

    // Shift + Wheel: Horizontal Pan
    if (e.shiftKey) {
      e.preventDefault();
      const panSpeed = e.deltaMode === 1 ? 24 : 1.0;
      pendingWheelPanX += -e.deltaY * panSpeed;
      hasPendingWheelPan = true;
      scheduleWheelTransform();
      return;
    }

    // Normal 2D Scroll / Pan:
    // Check if the cursor is over an internal scrollable element (e.g. PDF multi-page container, textarea)
    const scrollEl = e.target.closest ? e.target.closest('.pdf-pages-container, .note-container-body, textarea') : null;
    if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight) {
      const atTop = scrollEl.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = Math.ceil(scrollEl.scrollTop + scrollEl.clientHeight) >= scrollEl.scrollHeight && e.deltaY > 0;
      if (!atTop && !atBottom) {
        return; // Allow native internal scroll
      }
    }

    e.preventDefault();
    const panSpeed = e.deltaMode === 1 ? 24 : 1.0;
    pendingWheelPanX += -e.deltaX * panSpeed;
    pendingWheelPanY += -e.deltaY * panSpeed;
    hasPendingWheelPan = true;
    scheduleWheelTransform();
  }, { passive: false });

  // Suppress browser default page scrolling during multi-touch gestures on container
  container.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length >= 2 && e.cancelable) {
      e.preventDefault();
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length >= 2 && e.cancelable) {
      e.preventDefault();
    }
  }, { passive: false });

  // Helper to identify clicks on interactive UI vs canvas background
  const isInteractiveTarget = (target) => {
    if (!target || !target.closest) return false;
    return target.closest('.universal-note-container, button, select, input, .ribbon-cluster, #app-sidebar, #status-bar, #top-bar, a');
  };

  // 2. Pointer Down on Container (Navigate Mode & Background)
  container.addEventListener('pointerdown', (e) => {
    if (state.mode === 'ipad') return;
    stopMomentum();
    lastPanSampleTime = performance.now();
    lastPanSamplePos = { x: e.clientX, y: e.clientY };
    panVelocity = { vx: 0, vy: 0 };

    // Touch on touchscreen Windows devices (Surface Pro, 2-in-1 laptops)
    if (e.pointerType === 'touch') {
      state.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Two or more fingers: Multi-touch pinch zoom & pan
      if (state.activeTouches.size >= 2) {
        state.isPanning = false;
        return;
      }

      // Single finger touch on empty canvas: Pan the canvas smoothly!
      if (!isInteractiveTarget(e.target)) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
        state.selectedBlockIds.clear();
        state.activeContainerId = null;
        renderAll();
        try { container.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }
      return;
    }

    // Mouse Buttons:
    // Middle Mouse Button (Button 1) or Spacebar + Click: Always pan from anywhere!
    if (e.button === 1 || isSpaceDown) {
      e.preventDefault();
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY };
      container.style.cursor = 'grabbing';
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    // Right Mouse Button (Button 2): OneNote-style Right Click Drag to pan
    if (e.button === 2 && !isInteractiveTarget(e.target)) {
      e.preventDefault();
      state.wasRightClickPan = true;
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY };
      container.style.cursor = 'grabbing';
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    // Left Mouse Button (Button 0):
    if (e.button === 0 && !isInteractiveTarget(e.target)) {
      if (state.activeTool === 'select' && !isSpaceDown) {
        // Select Tool: Marquee drag across canvas to select blocks
        state.isMarquee = true;
        const rect = container.getBoundingClientRect();
        state.marqueeStart = state.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        marqueeBox.style.left = `${state.marqueeStart.x}px`;
        marqueeBox.style.top = `${state.marqueeStart.y}px`;
        marqueeBox.style.width = '0px';
        marqueeBox.style.height = '0px';
        marqueeBox.classList.remove('hidden');
        if (!e.shiftKey) {
          state.selectedBlockIds.clear();
          state.activeContainerId = null;
          updateSelectionStatus();
          document.querySelectorAll('.universal-note-container, .canvas-block').forEach(c => c.classList.remove('selected'));
        }
      } else {
        // Hand / Pan Tool (or Spacebar held): Pan the canvas freely
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      }
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });

  // 3. Pointer Move on Container (Windows Mode)
  window.addEventListener('pointermove', (e) => {
    if (state.mode === 'ipad') return;

    if (e.pointerType === 'touch') {
      state.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.activeTouches.size >= 2) {
        const touches = Array.from(state.activeTouches.values());
        state.touchRecognizer.processTwoFingerMove(touches[0], touches[1]);
        return;
      }
    }

    if (state.isPanning) {
      trackPanMove(e.clientX, e.clientY);
      const dx = e.clientX - state.panStart.x;
      const dy = e.clientY - state.panStart.y;
      state.panStart = { x: e.clientX, y: e.clientY };
      state.viewport.pan(dx, dy);
      updateWorldTransform();
    } else if (state.isMarquee) {
      const rect = container.getBoundingClientRect();
      const curWorld = state.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      const minX = Math.min(state.marqueeStart.x, curWorld.x);
      const minY = Math.min(state.marqueeStart.y, curWorld.y);
      const w = Math.abs(curWorld.x - state.marqueeStart.x);
      const h = Math.abs(curWorld.y - state.marqueeStart.y);

      marqueeBox.style.left = `${minX}px`;
      marqueeBox.style.top = `${minY}px`;
      marqueeBox.style.width = `${w}px`;
      marqueeBox.style.height = `${h}px`;

      state.selectedBlockIds.clear();
      state.doc.blocks.forEach(block => {
        if (FrustumCuller.intersects(FrustumCuller.getBlockBounds(block), { minX, minY, maxX: minX + w, maxY: minY + h })) {
          state.selectedBlockIds.add(block.id);
        }
      });
      updateSelectionStatus();
    }
  });

  // 4. Pointer Up on Container (Windows Mode)
  window.addEventListener('pointerup', (e) => {
    if (state.mode === 'ipad') return;

    if (e && e.pointerId !== undefined) {
      try {
        if (container.hasPointerCapture && container.hasPointerCapture(e.pointerId)) {
          container.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    }

    if (e && e.pointerType === 'touch') {
      state.activeTouches.delete(e.pointerId);
      if (state.activeTouches.size < 2) {
        state.touchRecognizer.resetPinch();
      }
      if (!state.isPanning) {
        state.touchRecognizer.processTap(e.clientX, e.clientY);
      }
    }

    if (state.isPanning) {
      state.isPanning = false;
      container.style.cursor = isSpaceDown ? 'grab' : (state.activeTool === 'hand' ? 'grab' : 'default');
      startMomentumPan();
    }

    if (state.isMarquee) {
      state.isMarquee = false;
      marqueeBox.classList.add('hidden');
      document.querySelectorAll('.universal-note-container').forEach(c => {
        c.classList.toggle('selected', state.selectedBlockIds.has(c.id));
      });
      updateSelectionStatus();
    }
  });

  // Keyboard listeners for navigation (OneNote / Freeform parity)
  window.addEventListener('keydown', (e) => {
    const isEditing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;

    // Spacebar temporary grab/pan
    if (e.code === 'Space' && !isEditing) {
      if (!isSpaceDown) {
        isSpaceDown = true;
        if (!state.isPanning) container.style.cursor = 'grab';
      }
      return;
    }

    if (isEditing) return;

    // Ctrl+0 or Meta+0: Reset View to 100%
    if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0')) {
      e.preventDefault();
      animateViewport(40, 40, 1.0);
      showToast('Reset View to 100%');
      return;
    }

    // Shift+1: Fit all content in view
    if (e.shiftKey && (e.key === '!' || e.code === 'Digit1')) {
      e.preventDefault();
      fitAllContent(true);
      showToast('🔍 Framed All Content in View');
      return;
    }

    // Ctrl + Plus / Equals: Zoom in
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      const cx = container.clientWidth / 2;
      const cy = container.clientHeight / 2;
      const worldBefore = state.viewport.screenToWorld(cx, cy);
      const targetZoom = Math.min(4.0, state.viewport.zoom * 1.25);
      const targetX = cx - worldBefore.x * targetZoom;
      const targetY = cy - worldBefore.y * targetZoom;
      animateViewport(targetX, targetY, targetZoom, 180);
      return;
    }

    // Ctrl + Minus: Zoom out
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      const cx = container.clientWidth / 2;
      const cy = container.clientHeight / 2;
      const worldBefore = state.viewport.screenToWorld(cx, cy);
      const targetZoom = Math.max(0.2, state.viewport.zoom * 0.8);
      const targetX = cx - worldBefore.x * targetZoom;
      const targetY = cy - worldBefore.y * targetZoom;
      animateViewport(targetX, targetY, targetZoom, 180);
      return;
    }

    // Arrow keys: Pan canvas
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.viewport.pan(0, 60);
      updateWorldTransform();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.viewport.pan(0, -60);
      updateWorldTransform();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      state.viewport.pan(60, 0);
      updateWorldTransform();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      state.viewport.pan(-60, 0);
      updateWorldTransform();
      return;
    }

    // 'V' for Select tool, 'H' for Hand tool (in Windows mode)
    if (state.mode === 'windows' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.code === 'KeyV') {
        const selectBtn = document.getElementById('btn-tool-select');
        selectBtn?.click();
      } else if (e.code === 'KeyH') {
        const handBtn = document.getElementById('btn-tool-hand');
        handBtn?.click();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpaceDown = false;
      if (!state.isPanning) {
        container.style.cursor = state.activeTool === 'hand' ? 'grab' : 'default';
      }
    }
  });

  // Prevent right-click context menu when right-click pan was used
  container.addEventListener('contextmenu', (e) => {
    if (state.wasRightClickPan) {
      e.preventDefault();
      state.wasRightClickPan = false;
    }
  });

  // Double Click on empty canvas to create a new Note Container
  container.addEventListener('dblclick', (e) => {
    if (!isInteractiveTarget(e.target)) {
      const rect = container.getBoundingClientRect();
      const worldPos = state.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const newContainer = createNewNoteContainer(worldPos.x, worldPos.y);
      state.history.execute(new AddBlockCommand(state.doc, newContainer));
      state.selectedBlockIds.clear();
      state.selectedBlockIds.add(newContainer.id);
      state.activeContainerId = newContainer.id;
      saveActivePageDocument();
      renderAll();
      showToast('📝 Created Note Box');
    }
  });

  // iPad Inking & Eraser Engine Interactions
  const applyEraserAtScreen = (clientX, clientY) => {
    if (!state.doc || !state.doc.globalAnnotations || state.doc.globalAnnotations.length === 0) return;
    const rect = activeDrawCanvas.getBoundingClientRect();
    const screenPos = { x: clientX - rect.left, y: clientY - rect.top };
    const worldPos = state.viewport.screenToWorld(screenPos.x, screenPos.y);
    const worldRadius = (state.eraserSize || 24) / state.viewport.zoom;

    if (state.eraserMode === 'full') {
      const res = EraserEngine.eraseFullStrokes(state.doc.globalAnnotations, worldPos.x, worldPos.y, worldRadius);
      if (res.removedStrokes.length > 0) {
        state.doc.globalAnnotations = res.remainingStrokes;
        renderGlobalAnnotations();
      }
    } else {
      const res = EraserEngine.erasePartialStrokes(state.doc.globalAnnotations, worldPos.x, worldPos.y, worldRadius);
      if (res.modified) {
        state.doc.globalAnnotations = res.updatedStrokes;
        renderGlobalAnnotations();
      }
    }
  };

  const drawEraserIndicator = (clientX, clientY) => {
    const rect = activeDrawCanvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    clearActiveDrawCanvas();
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, state.eraserSize || 24, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();
    ctx.restore();
  };

  const finishEraserDrag = () => {
    if (state.isErasing) {
      state.isErasing = false;
      if (state.eraserStartStrokes && state.doc) {
        const prev = state.eraserStartStrokes;
        const curr = state.doc.globalAnnotations || [];
        if (prev.length !== curr.length || JSON.stringify(prev) !== JSON.stringify(curr)) {
          state.history.execute(new EraseStrokesCommand(state.doc, prev, curr));
          saveActivePageDocument();
          renderGlobalAnnotations();
        }
      }
      state.eraserStartStrokes = null;
    }
  };

  // State variables for finger navigation in iPad Mode
  let isFingerPanning = false;
  let lastFingerPanPos = null;

  // iPad Active Drawing Canvas Pointer Handlers (Apple Pencil + Finger Navigation + Palm Rejection)
  const onDrawCanvasPointerDown = (e) => {
    if (state.mode !== 'ipad') return;

    if (e.pointerType === 'pen') {
      lastPenTouchTime = Date.now();
    }

    // A. Apple Pencil (or pen stylus / primary mouse drawing): Inking, Highlighting & Erasing
    const isInkToolActive = state.inkTool === 'pen' || state.inkTool === 'highlighter';
    if (e.pointerType === 'pen' || (e.pointerType === 'mouse' && isInkToolActive && !e.shiftKey && e.button === 0)) {
      if (e.cancelable) e.preventDefault();

      if (state.inkTool === 'eraser' || (e.pointerType === 'pen' && e.buttons === 32)) {
        state.isErasing = true;
        state.eraserStartStrokes = JSON.parse(JSON.stringify(state.doc.globalAnnotations || []));
        applyEraserAtScreen(e.clientX, e.clientY);
        drawEraserIndicator(e.clientX, e.clientY);
        return;
      }

      state.isDrawing = true;
      state.drawStartTime = Date.now();
      state.lastDrawMoveTime = Date.now();
      state.lastDrawMovePos = { x: e.clientX, y: e.clientY };
      state.currentStrokePoints = [];

      const rect = activeDrawCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldPos = state.viewport.screenToWorld(sx, sy);

      worldPos.time = Date.now();
      worldPos.pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.5;
      state.currentStrokePoints.push(worldPos);

      liveStrokePoints = [{ x: sx, y: sy, pressure: worldPos.pressure }];
      lastMidPoint = { x: sx, y: sy };
      const currentZoom = state.viewport.zoom || 1.0;
      const isHighlighter = state.inkTool === 'highlighter';

      if (isHighlighter) {
        liveStrokeWidth = Math.max(12, (state.inkWidth * 3 * currentZoom) * (0.8 + worldPos.pressure * 0.4));
        const hlColor = state.inkColor === '#0f172a' ? '#facc15' : state.inkColor;
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = hlColor;
        ctx.fillStyle = hlColor;
      } else {
        liveStrokeWidth = Math.max(0.5, (state.inkWidth * currentZoom) * (0.6 + worldPos.pressure * 0.8));
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = state.inkColor;
        ctx.fillStyle = state.inkColor;
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw initial smooth dab for tap
      const initRadius = Math.max(0.5, liveStrokeWidth / 2);
      ctx.beginPath();
      ctx.arc(sx, sy, initRadius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // B. Touch (Finger/Palm): In Ink Mode, touch navigation is completely disabled.
    // Palms and fingers resting on the screen are 100% ignored, allowing pure Apple Pencil inking!
    if (e.pointerType === 'touch') {
      if (e.cancelable) e.preventDefault();
      return;
    }

    // C. Mouse on activeDrawCanvas (Eraser or pan)
    if (state.inkTool === 'eraser') {
      state.isErasing = true;
      state.eraserStartStrokes = JSON.parse(JSON.stringify(state.doc.globalAnnotations || []));
      applyEraserAtScreen(e.clientX, e.clientY);
      drawEraserIndicator(e.clientX, e.clientY);
    } else if (e.button === 1 || e.shiftKey) {
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY };
    }
  }

  function onDrawCanvasPointerMove(e) {
    if (state.mode !== 'ipad') return;

    if (e.pointerType === 'pen') {
      lastPenTouchTime = Date.now();
    }

    // A. Apple Pencil / Pen drawing or erasing with high-frequency 240Hz coalesced events
    if (e.pointerType === 'pen' || (e.pointerType === 'mouse' && state.isDrawing)) {
      if (e.cancelable) e.preventDefault();
      if (state.inkTool === 'eraser' || state.isErasing) {
        drawEraserIndicator(e.clientX, e.clientY);
        if (state.isErasing) {
          applyEraserAtScreen(e.clientX, e.clientY);
        }
        return;
      }

      if (!state.isDrawing) return;

      let events = [e];
      if (typeof e.getCoalescedEvents === 'function') {
        const coalesced = e.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          events = coalesced;
        }
      }
      const rect = activeDrawCanvas.getBoundingClientRect();
      const isHighlighter = state.inkTool === 'highlighter';

      for (const subEvt of events) {
        const sx = subEvt.clientX - rect.left;
        const sy = subEvt.clientY - rect.top;
        const worldPos = state.viewport.screenToWorld(sx, sy);

        worldPos.time = Date.now();
        worldPos.pressure = (subEvt.pressure && subEvt.pressure > 0) ? subEvt.pressure : 0.5;
        state.currentStrokePoints.push(worldPos);

        const dMove = Math.hypot(sx - (state.lastDrawMovePos?.x || sx), sy - (state.lastDrawMovePos?.y || sy));
        if (dMove > 5) {
          state.lastDrawMoveTime = Date.now();
          state.lastDrawMovePos = { x: sx, y: sy };
        }

        const prevPt = liveStrokePoints[liveStrokePoints.length - 1];
        const newPt = { x: sx, y: sy, pressure: worldPos.pressure };
        liveStrokePoints.push(newPt);

        if (!lastMidPoint && prevPt) {
          lastMidPoint = { x: (prevPt.x + newPt.x) / 2, y: (prevPt.y + newPt.y) / 2 };
        }

        if (prevPt && lastMidPoint) {
          const newMid = {
            x: (prevPt.x + newPt.x) / 2,
            y: (prevPt.y + newPt.y) / 2
          };

          const currentZoom = state.viewport.zoom || 1.0;
          if (isHighlighter) {
            const targetWidth = Math.max(12, (state.inkWidth * 3 * currentZoom) * (0.8 + worldPos.pressure * 0.4));
            liveStrokeWidth = liveStrokeWidth * 0.7 + targetWidth * 0.3;
            const hlColor = state.inkColor === '#0f172a' ? '#facc15' : state.inkColor;
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = hlColor;
          } else {
            const targetWidth = Math.max(0.5, (state.inkWidth * currentZoom) * (0.6 + worldPos.pressure * 0.8));
            liveStrokeWidth = liveStrokeWidth * 0.65 + targetWidth * 0.35;
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = state.inkColor;
          }

          ctx.lineWidth = liveStrokeWidth;
          ctx.beginPath();
          ctx.moveTo(lastMidPoint.x, lastMidPoint.y);
          ctx.quadraticCurveTo(prevPt.x, prevPt.y, newMid.x, newMid.y);
          ctx.stroke();

          lastMidPoint = newMid;
        }
      }
      return;
    }

    // B. Touch (Finger/Palm): In Ink Mode, touch events are completely ignored
    if (e.pointerType === 'touch') {
      if (e.cancelable) e.preventDefault();
      return;
    }

    // C. Mouse eraser indicator or mouse panning
    if (state.inkTool === 'eraser') {
      drawEraserIndicator(e.clientX, e.clientY);
      if (state.isErasing) {
        applyEraserAtScreen(e.clientX, e.clientY);
      }
    } else if (state.isPanning) {
      trackPanMove(e.clientX, e.clientY);
      const dx = e.clientX - state.panStart.x;
      const dy = e.clientY - state.panStart.y;
      state.panStart = { x: e.clientX, y: e.clientY };
      state.viewport.pan(dx, dy);
      updateWorldTransform();
    }
  }

  function onDrawCanvasPointerUp(e) {
    if (state.mode !== 'ipad') return;

    if (e && e.cancelable) {
      e.preventDefault();
    }

    if (e && e.pointerType === 'touch') {
      return;
    }

    if (state.isPanning) {
      state.isPanning = false;
      startMomentumPan();
    }

    if (state.inkTool === 'eraser' || state.isErasing) {
      finishEraserDrag();
      return;
    }

    if (!state.isDrawing) return;
    state.isDrawing = false;
    clearActiveDrawCanvas();
    ctx.globalAlpha = 1.0;
    liveStrokePoints = [];
    lastMidPoint = null;

    const points = state.currentStrokePoints;
    if (points && points.length >= 1) {
      const endPauseDuration = Date.now() - (state.lastDrawMoveTime || Date.now());
      const shapeResult = (points.length >= 6 && endPauseDuration >= 600)
        ? ShapeDetector.detectShape(points, endPauseDuration)
        : { detected: false, type: ShapeType.NONE };

      let finalPoints = points;
      let shapeType = ShapeType.NONE;

      if (shapeResult.detected) {
        shapeType = shapeResult.type;
        if (shapeResult.type === ShapeType.LINE) {
          finalPoints = [shapeResult.geometry.start, shapeResult.geometry.end];
          showToast('📐 Snapped to Straight Line');
        } else if (shapeResult.type === ShapeType.CIRCLE) {
          const { cx, cy, radius } = shapeResult.geometry;
          finalPoints = [];
          for (let i = 0; i <= 36; i++) {
            const a = (i / 36) * 2 * Math.PI;
            finalPoints.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
          }
          showToast('⭕ Snapped to Circle');
        } else if (shapeResult.type === ShapeType.RECTANGLE) {
          const { x, y, width, height } = shapeResult.geometry;
          finalPoints = [
            { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }
          ];
          showToast('▭ Snapped to Rectangle');
        } else if (shapeResult.type === ShapeType.TRIANGLE) {
          const { p1, p2, p3 } = shapeResult.geometry;
          finalPoints = [p1, p2, p3, p1];
          showToast('▲ Snapped to Triangle');
        }
      } else if (points.length === 1) {
        // Single tap dot for 'i' / period: preserve single point coordinate
        finalPoints = [{ x: points[0].x, y: points[0].y, pressure: points[0].pressure || 0.5, time: points[0].time || Date.now() }];
      } else {
        // Natural handwriting fidelity: use sampled points directly with Bézier spline interpolation
        finalPoints = points;
      }

      // Accurate world-space stroke width calculation
      const currentZoom = state.viewport.zoom || 1.0;
      const isHighlighter = state.inkTool === 'highlighter';
      const pointPressure = points[0]?.pressure || 0.5;
      const calculatedDotWidth = state.inkWidth * (0.6 + pointPressure * 0.8);
      const worldWidth = isHighlighter
        ? Math.max(12, Math.round(((state.inkWidth * 3 * currentZoom) / currentZoom) * 100) / 100)
        : Math.max(0.5, (liveStrokeWidth ? (liveStrokeWidth / currentZoom) : calculatedDotWidth));

      const strokeColor = isHighlighter
        ? (state.inkColor === '#0f172a' ? '#facc15' : state.inkColor)
        : state.inkColor;

      const stroke = {
        id: 'stroke_' + Math.random().toString(36).substr(2, 9),
        color: strokeColor,
        width: Math.round(worldWidth * 100) / 100,
        points: finalPoints,
        shapeType,
        tool: isHighlighter ? 'highlighter' : 'pen',
        opacity: isHighlighter ? 0.45 : 1.0
      };

      state.history.execute(new AddStrokeCommand(state.doc, stroke));
      appendStrokeToSvg(stroke);
      debouncedSave(600);
    }
    state.currentStrokePoints = [];
  }

  // Instant Touch Memory Cleanup & Infallible Event Attachment
  const cleanupAllTouches = (e) => {
    if (!e || !e.touches || e.touches.length === 0) {
      state.activeTouches.clear();
      isFingerPanning = false;
      lastFingerPanPos = null;
      state.touchRecognizer?.resetPinch();
    }
  };

  // Suppress iOS Safari 300ms gesture-disambiguation delay on drawing canvas
  const blockTouchGestureDelay = (e) => {
    if (state.mode === 'ipad' && e.cancelable) {
      e.preventDefault();
    }
  };
  activeDrawCanvas.addEventListener('touchstart', blockTouchGestureDelay, { passive: false });
  activeDrawCanvas.addEventListener('touchmove', blockTouchGestureDelay, { passive: false });
  activeDrawCanvas.addEventListener('touchend', blockTouchGestureDelay, { passive: false });
  activeDrawCanvas.addEventListener('touchcancel', blockTouchGestureDelay, { passive: false });

  activeDrawCanvas.addEventListener('pointerdown', onDrawCanvasPointerDown);
  window.addEventListener('pointerdown', (e) => {
    if (state.mode === 'ipad' && e.pointerType === 'pen' && !state.isDrawing) {
      onDrawCanvasPointerDown(e);
    }
  });
  window.addEventListener('pointermove', onDrawCanvasPointerMove);
  window.addEventListener('pointerup', onDrawCanvasPointerUp);
  window.addEventListener('pointercancel', (e) => {
    if (e && e.pointerType === 'touch') {
      if (e.pointerId) state.activeTouches.delete(e.pointerId);
      if (state.activeTouches.size === 0) cleanupAllTouches(e);
      return;
    }
    onDrawCanvasPointerUp(e);
  });
  window.addEventListener('touchend', cleanupAllTouches, { passive: true });
  window.addEventListener('touchcancel', cleanupAllTouches, { passive: true });

  document.addEventListener('selectionchange', () => {
    if (state.mode === 'ipad') {
      const sel = window.getSelection ? window.getSelection() : null;
      if (sel && sel.removeAllRanges && sel.rangeCount > 0) {
        sel.removeAllRanges();
      }
    }
  });

  activeDrawCanvas.addEventListener('mouseleave', () => {
    if (state.inkTool === 'eraser') {
      ctx.clearRect(0, 0, activeDrawCanvas.width, activeDrawCanvas.height);
      finishEraserDrag();
    }
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

// --- Unified Container Actions ---
function actionAddNote() {
  const center = state.viewport.screenToWorld(container.clientWidth / 2, container.clientHeight / 2);
  const newNote = createNewNoteContainer(center.x - 290, center.y - 120);
  state.history.execute(new AddBlockCommand(state.doc, newNote));
  state.selectedBlockIds.clear();
  state.selectedBlockIds.add(newNote.id);
  state.activeContainerId = newNote.id;
  saveActivePageDocument();
  renderAll();
  showToast('📝 Created Universal Note Box');
}

function actionBrowseMedia() {
  if (mediaFileInput) {
    mediaFileInput.value = '';
    mediaFileInput.click();
  }
}

function actionBrowsePdf() {
  if (pdfFileInput) {
    pdfFileInput.value = '';
    pdfFileInput.click();
  }
}

function actionInsertTable() {
  const target = getOrCreateActiveContainer();
  target.items.push({
    id: 'item_tbl_' + Date.now(),
    type: 'table',
    data: [
      ['Parameter', 'Initial', 'Final'],
      ['Position x', '0.00 m', '15.4 m'],
      ['Velocity v', '0.00 m/s', '8.2 m/s']
    ]
  });
  saveActivePageDocument();
  renderAll();
  showToast('⊞ Added Table to Note');
}

function actionInsertPlot() {
  const target = getOrCreateActiveContainer();
  target.items.push({
    id: 'item_plot_' + Date.now(),
    type: 'plot',
    formula: 'cos(x)',
    xMin: -10,
    xMax: 10
  });
  saveActivePageDocument();
  renderAll();
  showToast('📈 Added Math Plot to Note');
}

function actionInsertSketch() {
  const target = getOrCreateActiveContainer();
  target.items.push({
    id: 'item_sketch_' + Date.now(),
    type: 'sketch',
    height: 260,
    strokes: []
  });
  saveActivePageDocument();
  renderAll();
  showToast('✍ Added Handwriting Canvas to Note');
}

function actionInsertMath() {
  const target = getOrCreateActiveContainer();
  target.items.push({
    id: 'item_math_' + Date.now(),
    type: 'text',
    content: '$$\\int_{a}^{b} f(x) dx = F(b) - F(a)$$\nLinear approximation: $f(x) \\approx f(a) + f\'(a)(x - a)$'
  });
  saveActivePageDocument();
  renderAll();
  showToast('$fx Added LaTeX Equation to Note');
}

// --- File Pickers, Ribbon & Layout Controls ---

function setupRibbonControls() {
  // Select Tool vs Hand Tool Toggle
  const btnSelect = document.getElementById('btn-tool-select');
  const btnHand = document.getElementById('btn-tool-hand');
  if (btnSelect && btnHand) {
    btnSelect.addEventListener('click', () => {
      state.activeTool = 'select';
      btnSelect.classList.add('active');
      btnHand.classList.remove('active');
      container.style.cursor = 'default';
      showToast('↖ Select Tool: Click to select, drag to marquee');
    });
    btnHand.addEventListener('click', () => {
      state.activeTool = 'hand';
      btnHand.classList.add('active');
      btnSelect.classList.remove('active');
      container.style.cursor = 'grab';
      showToast('✋ Hand Tool: Drag canvas to pan freely');
    });
  }

  // Prevent focus theft on format buttons so contentEditable stays active
  const fmtButtons = [
    'ribbon-bold', 'ribbon-italic', 'ribbon-underline', 'ribbon-strike',
    'ribbon-highlight', 'ribbon-bullet', 'ribbon-num', 'ribbon-task',
    'ribbon-align-left', 'ribbon-align-center', 'ribbon-align-right'
  ];
  fmtButtons.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('mousedown', (e) => e.preventDefault());
  });

  // Typography buttons
  document.getElementById('ribbon-bold')?.addEventListener('click', () => {
    document.execCommand('bold');
    syncRibbonActiveStates();
  });
  document.getElementById('ribbon-italic')?.addEventListener('click', () => {
    document.execCommand('italic');
    syncRibbonActiveStates();
  });
  document.getElementById('ribbon-underline')?.addEventListener('click', () => {
    document.execCommand('underline');
    syncRibbonActiveStates();
  });
  document.getElementById('ribbon-strike')?.addEventListener('click', () => {
    document.execCommand('strikeThrough');
    syncRibbonActiveStates();
  });
  document.getElementById('ribbon-highlight')?.addEventListener('click', () => {
    document.execCommand('hiliteColor', false, '#fef08a');
    syncRibbonActiveStates();
  });
  document.getElementById('ribbon-color')?.addEventListener('input', (e) => {
    document.execCommand('foreColor', false, e.target.value);
  });

  // Alignment buttons
  document.getElementById('ribbon-align-left')?.addEventListener('click', () => {
    document.execCommand('justifyLeft');
  });
  document.getElementById('ribbon-align-center')?.addEventListener('click', () => {
    document.execCommand('justifyCenter');
  });
  document.getElementById('ribbon-align-right')?.addEventListener('click', () => {
    document.execCommand('justifyRight');
  });

  // Lists & Checkboxes
  document.getElementById('ribbon-bullet')?.addEventListener('click', () => {
    document.execCommand('insertUnorderedList');
  });
  document.getElementById('ribbon-num')?.addEventListener('click', () => {
    document.execCommand('insertOrderedList');
  });
  document.getElementById('ribbon-task')?.addEventListener('click', () => {
    document.execCommand('insertHTML', false, '<label class="checklist-item"><input type="checkbox"> &nbsp;</label>');
  });

  // Font Family, Font Size, Heading Style
  document.getElementById('ribbon-font')?.addEventListener('change', (e) => {
    document.execCommand('fontName', false, e.target.value);
  });
  document.getElementById('ribbon-font-size')?.addEventListener('change', (e) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const span = document.createElement('span');
      span.style.fontSize = e.target.value;
      const range = sel.getRangeAt(0);
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
  });
  document.getElementById('ribbon-heading')?.addEventListener('change', (e) => {
    document.execCommand('formatBlock', false, `<${e.target.value}>`);
  });

  // Live Ribbon Active State Synchronization (like MS Word Home Tab)
  function syncRibbonActiveStates() {
    const boldBtn = document.getElementById('ribbon-bold');
    const italicBtn = document.getElementById('ribbon-italic');
    const underBtn = document.getElementById('ribbon-underline');
    const strikeBtn = document.getElementById('ribbon-strike');
    const headingSelect = document.getElementById('ribbon-heading');

    try {
      if (boldBtn) boldBtn.classList.toggle('active', document.queryCommandState('bold'));
      if (italicBtn) italicBtn.classList.toggle('active', document.queryCommandState('italic'));
      if (underBtn) underBtn.classList.toggle('active', document.queryCommandState('underline'));
      if (strikeBtn) strikeBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));
    } catch (_) {}

    // Check heading level
    const sel = window.getSelection();
    if (sel && sel.anchorNode && headingSelect) {
      const parentBlock = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
      const hTag = parentBlock?.closest('h1, h2, h3, p');
      if (hTag) {
        headingSelect.value = hTag.tagName.toLowerCase();
      }
    }
  }

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const nodeEl = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
      if (nodeEl && nodeEl.closest('.note-item-text')) {
        document.getElementById('ribbon-bar')?.classList.add('text-formatting-active');
        syncRibbonActiveStates();
      }
    }
  });

  // Setup draggable scrollbars, auto-scrolling, and Word ribbon tabs
  setupScrollbarDragging();
  setupEdgeAutoScroll();
  setupRibbonTabs();

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (state.history.canUndo()) {
      state.history.undo();
      saveActivePageDocument();
      renderAll();
      showToast('↺ Undone');
    }
  });

  document.getElementById('btn-redo')?.addEventListener('click', () => {
    if (state.history.canRedo()) {
      state.history.redo();
      saveActivePageDocument();
      renderAll();
      showToast('↻ Redone');
    }
  });

  // Ribbon (Layout A) Actions
  document.getElementById('btn-add-note')?.addEventListener('click', actionAddNote);
  document.getElementById('btn-browse-media')?.addEventListener('click', actionBrowseMedia);
  document.getElementById('btn-browse-pdf')?.addEventListener('click', actionBrowsePdf);
  document.getElementById('btn-insert-sketch')?.addEventListener('click', actionInsertSketch);
  document.getElementById('btn-insert-table')?.addEventListener('click', actionInsertTable);
  document.getElementById('btn-insert-plot')?.addEventListener('click', actionInsertPlot);
  document.getElementById('btn-add-math')?.addEventListener('click', actionInsertMath);

  // Floating Capsule (Layout B) Actions
  document.getElementById('cap-note')?.addEventListener('click', actionAddNote);
  document.getElementById('cap-sketch')?.addEventListener('click', actionInsertSketch);
  document.getElementById('cap-media')?.addEventListener('click', actionBrowseMedia);
  document.getElementById('cap-pdf')?.addEventListener('click', actionBrowsePdf);
  document.getElementById('cap-table')?.addEventListener('click', actionInsertTable);
  document.getElementById('cap-plot')?.addEventListener('click', actionInsertPlot);
  document.getElementById('cap-math')?.addEventListener('click', actionInsertMath);

  // Floating Palette (Layout C) Actions
  document.getElementById('pal-select')?.addEventListener('click', () => {
    document.querySelectorAll('.pal-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pal-select')?.classList.add('active');
    state.activeTool = 'select';
    showToast('↖ Select & Pan tool active');
  });
  document.getElementById('pal-note')?.addEventListener('click', () => {
    actionAddNote();
    document.querySelectorAll('.pal-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('pal-select')?.classList.add('active');
  });
  document.getElementById('pal-sketch')?.addEventListener('click', actionInsertSketch);
  document.getElementById('pal-media')?.addEventListener('click', actionBrowseMedia);
  document.getElementById('pal-pdf')?.addEventListener('click', actionBrowsePdf);
  document.getElementById('pal-table')?.addEventListener('click', actionInsertTable);
  document.getElementById('pal-plot')?.addEventListener('click', actionInsertPlot);
  document.getElementById('pal-math')?.addEventListener('click', actionInsertMath);

  // Native Local Media File Input Handler
  mediaFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      showToast(`🖼 Loading media "${file.name}"...`);
      const reader = new FileReader();
      reader.onload = async (loadEvt) => {
        const dataUrl = loadEvt.target.result;
        const targetContainer = getOrCreateActiveContainer();
        const itemId = 'item_img_' + Date.now();
        targetContainer.items.push({
          id: itemId,
          type: 'image',
          src: dataUrl,
          caption: file.name
        });
        await saveAssetIDB(itemId, dataUrl);
        saveActivePageDocument();
        renderAll();
        showToast(`🖼 Added media "${file.name}"`);
      };
      reader.readAsDataURL(file);
    }
    mediaFileInput.value = '';
  });

  // Native Local PDF File Input Handler (OneNote Slide Printout)
  pdfFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      showToast(`⏳ Loading PDF "${file.name}"...`);
      const reader = new FileReader();
      reader.onload = async (loadEvt) => {
        const dataUrl = loadEvt.target.result;
        const targetContainer = getOrCreateActiveContainer();
        if ((targetContainer.width || 540) < 780) {
          targetContainer.width = 780;
        }
        const itemId = 'item_pdf_' + Date.now();
        targetContainer.items.push({
          id: itemId,
          type: 'pdf',
          title: file.name,
          dataUrl: dataUrl,
          totalPages: 1
        });
        await saveAssetIDB(itemId, dataUrl);
        saveActivePageDocument();
        renderAll();
        showToast(`📑 Loaded PDF "${file.name}" (OneNote Printout)`);
      };
      reader.readAsDataURL(file);
    }
    pdfFileInput.value = '';
  });
}

// --- Keyboard Shortcuts, Clipboard Paste & Drag-and-Drop ---

function setupKeyboardAndClipboard() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        if (state.history.canRedo()) {
          state.history.redo();
          saveActivePageDocument();
          renderAll();
          showToast('↻ Redone');
        }
      } else {
        if (state.history.canUndo()) {
          state.history.undo();
          saveActivePageDocument();
          renderAll();
          showToast('↺ Undone');
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      if (state.history.canRedo()) {
        state.history.redo();
        saveActivePageDocument();
        renderAll();
        showToast('↻ Redone');
      }
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.code === 'KeyV') {
        const btnSelect = document.getElementById('btn-tool-select');
        if (btnSelect) btnSelect.click();
      } else if (e.code === 'KeyH') {
        const btnHand = document.getElementById('btn-tool-hand');
        if (btnHand) btnHand.click();
      } else if (e.code === 'KeyM') {
        const toggleBtn = document.getElementById('btn-toggle-minimap');
        if (toggleBtn) toggleBtn.click();
      }
    }

    // Shift + 1 or Ctrl/Cmd + 0: Zoom to Fit All Content
    if ((e.shiftKey && (e.code === 'Digit1' || e.key === '!')) || ((e.ctrlKey || e.metaKey) && e.code === 'Digit0')) {
      e.preventDefault();
      fitAllContent(true);
      showToast('🔍 Framed All Content in View');
    }
  });

  // Paste Image from Clipboard (Ctrl+V)
  window.addEventListener('paste', (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              const target = getOrCreateActiveContainer();
              target.items.push({
                id: 'item_img_' + Date.now(),
                type: 'image',
                src: loadEvt.target.result,
                caption: 'Pasted Screenshot'
              });
              saveActivePageDocument();
              renderAll();
              showToast('📋 Pasted image from clipboard');
            };
            reader.readAsDataURL(file);
          }
        }
      }
    }
  });

  // Drag & Drop from File Explorer
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const rect = container.getBoundingClientRect();
      const dropWorld = state.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          const newNote = createNewNoteContainer(dropWorld.x - 200, dropWorld.y - 100, file.name);
          newNote.items = [{
            id: 'item_img_' + Date.now(),
            type: 'image',
            src: loadEvt.target.result,
            caption: file.name
          }];
          state.history.execute(new AddBlockCommand(state.doc, newNote));
          saveActivePageDocument();
          renderAll();
          showToast(`🖼 Dropped image "${file.name}"`);
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.pdf')) {
        const newNote = createNewNoteContainer(dropWorld.x - 200, dropWorld.y - 100, file.name);
        newNote.items = [{
          id: 'item_pdf_' + Date.now(),
          type: 'pdf',
          title: file.name,
          totalPages: 3
        }];
        state.history.execute(new AddBlockCommand(state.doc, newNote));
        saveActivePageDocument();
        renderAll();
        showToast(`📑 Dropped PDF "${file.name}"`);
      }
    }
  });

  // Reset View, Fit All & Zoom Controls
  const zoomPill = document.getElementById('btn-zoom-pill');
  const zoomFlyout = document.getElementById('zoom-flyout');

  if (zoomPill && zoomFlyout) {
    zoomPill.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.mode === 'ipad') return; // Strict ink lock
      zoomFlyout.classList.toggle('hidden');
    });

    window.addEventListener('click', (e) => {
      if (!zoomFlyout.contains(e.target) && e.target !== zoomPill) {
        zoomFlyout.classList.add('hidden');
      }
    });
  }

  document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
    fitAllContent(true);
    zoomFlyout?.classList.add('hidden');
    showToast('🔍 Framed All Content in View (Shift+1)');
  });
  document.getElementById('btn-reset-view')?.addEventListener('click', () => {
    animateViewport(40, 40, 1.0);
    zoomFlyout?.classList.add('hidden');
    showToast('Reset View to 100%');
  });
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const worldBefore = state.viewport.screenToWorld(cx, cy);
    const targetZoom = Math.min(4.0, state.viewport.zoom * 1.25);
    const targetX = cx - worldBefore.x * targetZoom;
    const targetY = cy - worldBefore.y * targetZoom;
    animateViewport(targetX, targetY, targetZoom, 200);
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const worldBefore = state.viewport.screenToWorld(cx, cy);
    const targetZoom = Math.max(0.2, state.viewport.zoom * 0.8);
    const targetX = cx - worldBefore.x * targetZoom;
    const targetY = cy - worldBefore.y * targetZoom;
    animateViewport(targetX, targetY, targetZoom, 200);
  });
  zoomIndicator?.addEventListener('dblclick', () => {
    fitAllContent(true);
  });
}

// --- Sidebar Controls ---



// --- Layout, Floating Puck & Inking Palette are now managed by src/ui/ modules ---



// --- Setup Draggable Position Scrollbars (Canvas Trackers) ---
function setupScrollbarDragging() {
  const sbH = document.getElementById('canvas-scrollbar-h');
  const sbV = document.getElementById('canvas-scrollbar-v');
  const thumbH = document.getElementById('canvas-scroll-thumb-h');
  const thumbV = document.getElementById('canvas-scroll-thumb-v');
  if (!sbH || !sbV || !thumbH || !thumbV) return;

  // Prevent canvas from stealing pointer events on scrollbars
  [sbH, sbV].forEach(el => {
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('mousedown', (e) => e.stopPropagation());
  });

  // Track click to jump
  sbH.addEventListener('pointerdown', (e) => {
    if (sbH.classList.contains('locked') || e.target === thumbH) return;
    const rect = sbH.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const bounds = getCanvasContentBounds();
    const containerW = container.offsetWidth || window.innerWidth;
    const maxScrollX = Math.max(1, bounds.width * state.viewport.zoom - containerW + 40);
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    state.viewport.x = 40 - ratio * maxScrollX;
    updateWorldTransform();
    debouncedSave(800);
  });

  sbV.addEventListener('pointerdown', (e) => {
    if (sbV.classList.contains('locked') || e.target === thumbV) return;
    const rect = sbV.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const bounds = getCanvasContentBounds();
    const containerH = container.offsetHeight || window.innerHeight;
    const currentWorldBottom = (containerH - state.viewport.y) / state.viewport.zoom;
    const totalWorldH = Math.max(bounds.height, currentWorldBottom + 600);
    const maxScrollY = Math.max(1, totalWorldH * state.viewport.zoom - containerH + 40);
    const ratio = Math.max(0, Math.min(1, clickY / rect.height));
    state.viewport.y = 40 - ratio * maxScrollY;
    updateWorldTransform();
    debouncedSave(800);
  });

  // Horizontal thumb drag with PointerCapture
  thumbH.addEventListener('pointerdown', (e) => {
    if (sbH.classList.contains('locked')) return;
    e.stopPropagation();
    e.preventDefault();
    thumbH.setPointerCapture(e.pointerId);
    thumbH.classList.add('active');

    const startX = e.clientX;
    const initialThumbLeft = thumbH.offsetLeft;
    const trackW = sbH.offsetWidth;
    const thumbW = thumbH.offsetWidth;
    const bounds = getCanvasContentBounds();
    const containerW = container.offsetWidth || window.innerWidth;
    const maxScrollX = Math.max(1, bounds.width * state.viewport.zoom - containerW + 40);

    const onPointerMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const newLeft = Math.max(0, Math.min(trackW - thumbW, initialThumbLeft + dx));
      const ratio = newLeft / Math.max(1, trackW - thumbW);
      state.viewport.x = 40 - ratio * maxScrollX;
      updateWorldTransform();
    };

    const onPointerUp = (upEvt) => {
      thumbH.classList.remove('active');
      try { thumbH.releasePointerCapture(upEvt.pointerId); } catch (_) {}
      thumbH.removeEventListener('pointermove', onPointerMove);
      thumbH.removeEventListener('pointerup', onPointerUp);
      thumbH.removeEventListener('pointercancel', onPointerUp);
      debouncedSave(800);
    };

    thumbH.addEventListener('pointermove', onPointerMove);
    thumbH.addEventListener('pointerup', onPointerUp);
    thumbH.addEventListener('pointercancel', onPointerUp);
  });

  // Vertical thumb drag with PointerCapture
  thumbV.addEventListener('pointerdown', (e) => {
    if (sbV.classList.contains('locked')) return;
    e.stopPropagation();
    e.preventDefault();
    thumbV.setPointerCapture(e.pointerId);
    thumbV.classList.add('active');

    const startY = e.clientY;
    const initialThumbTop = thumbV.offsetTop;
    const trackH = sbV.offsetHeight;
    const thumbHHeight = thumbV.offsetHeight;
    const bounds = getCanvasContentBounds();
    const containerH = container.offsetHeight || window.innerHeight;
    const currentWorldBottom = (containerH - state.viewport.y) / state.viewport.zoom;
    const totalWorldH = Math.max(bounds.height, currentWorldBottom + 600);
    const maxScrollY = Math.max(1, totalWorldH * state.viewport.zoom - containerH + 40);

    const onPointerMove = (moveEvt) => {
      const dy = moveEvt.clientY - startY;
      const newTop = Math.max(0, Math.min(trackH - thumbHHeight, initialThumbTop + dy));
      const ratio = newTop / Math.max(1, trackH - thumbHHeight);
      state.viewport.y = 40 - ratio * maxScrollY;
      updateWorldTransform();
    };

    const onPointerUp = (upEvt) => {
      thumbV.classList.remove('active');
      try { thumbV.releasePointerCapture(upEvt.pointerId); } catch (_) {}
      thumbV.removeEventListener('pointermove', onPointerMove);
      thumbV.removeEventListener('pointerup', onPointerUp);
      thumbV.removeEventListener('pointercancel', onPointerUp);
      debouncedSave(800);
    };

    thumbV.addEventListener('pointermove', onPointerMove);
    thumbV.addEventListener('pointerup', onPointerUp);
    thumbV.addEventListener('pointercancel', onPointerUp);
  });
}

// --- Smooth Auto-Scroll During Text Selection or Dragging Near Viewport Edges ---
let autoScrollFrame = null;
let autoScrollVelocity = { vx: 0, vy: 0 };

function stepAutoScroll() {
  if (autoScrollVelocity.vx !== 0 || autoScrollVelocity.vy !== 0) {
    state.viewport.pan(autoScrollVelocity.vx, autoScrollVelocity.vy);
    updateWorldTransform();
    autoScrollFrame = requestAnimationFrame(stepAutoScroll);
  } else {
    autoScrollFrame = null;
  }
}

function setupEdgeAutoScroll() {
  window.addEventListener('pointermove', (e) => {
    if (document.body.getAttribute('data-mode') === 'ipad') {
      autoScrollVelocity = { vx: 0, vy: 0 };
      return;
    }

    if (e.buttons !== 1) {
      autoScrollVelocity = { vx: 0, vy: 0 };
      return;
    }

    const rect = container.getBoundingClientRect();
    const edgeMargin = 60;
    const maxSpeed = 16;

    let vx = 0;
    let vy = 0;

    if (e.clientX > rect.right - edgeMargin) {
      const p = Math.min(edgeMargin, e.clientX - (rect.right - edgeMargin));
      vx = -Math.round((p / edgeMargin) * maxSpeed);
    } else if (e.clientX < rect.left + edgeMargin) {
      const p = Math.min(edgeMargin, (rect.left + edgeMargin) - e.clientX);
      vx = Math.round((p / edgeMargin) * maxSpeed);
    }

    if (e.clientY > rect.bottom - edgeMargin) {
      const p = Math.min(edgeMargin, e.clientY - (rect.bottom - edgeMargin));
      vy = -Math.round((p / edgeMargin) * maxSpeed);
    } else if (e.clientY < rect.top + edgeMargin) {
      const p = Math.min(edgeMargin, (rect.top + edgeMargin) - e.clientY);
      vy = Math.round((p / edgeMargin) * maxSpeed);
    }

    autoScrollVelocity = { vx, vy };
    if ((vx !== 0 || vy !== 0) && !autoScrollFrame) {
      autoScrollFrame = requestAnimationFrame(stepAutoScroll);
    }
  }, { passive: true });

  window.addEventListener('pointerup', () => {
    autoScrollVelocity = { vx: 0, vy: 0 };
    if (autoScrollFrame) {
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
    }
  });
}

// --- Word Ribbon Tabs Controller (Home vs Insert) ---
function setupRibbonTabs() {
  const homeTabBtn = document.getElementById('tab-btn-home');
  const insertTabBtn = document.getElementById('tab-btn-insert');
  const ribbonBar = document.getElementById('ribbon-bar');
  const textGroup = document.getElementById('ribbon-text-group');
  const insertCluster = document.querySelector('.insert-cluster');

  const switchTab = (tab) => {
    if (ribbonBar) {
      ribbonBar.setAttribute('data-tab', tab);
    }
    if (tab === 'home') {
      homeTabBtn?.classList.add('active');
      insertTabBtn?.classList.remove('active');
      if (textGroup) textGroup.style.display = 'flex';
      if (insertCluster) insertCluster.style.display = 'none';
    } else {
      insertTabBtn?.classList.add('active');
      homeTabBtn?.classList.remove('active');
      if (textGroup) textGroup.style.display = 'none';
      if (insertCluster) insertCluster.style.display = 'flex';
    }
  };

  const onHomeClick = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    switchTab('home');
  };

  const onInsertClick = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    switchTab('insert');
  };

  homeTabBtn?.addEventListener('click', onHomeClick);
  homeTabBtn?.addEventListener('pointerdown', (e) => e?.stopPropagation());

  insertTabBtn?.addEventListener('click', onInsertClick);
  insertTabBtn?.addEventListener('pointerdown', (e) => e?.stopPropagation());

  // Auto-switch to Home (Text Formatting) tab when typing in notes
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.closest && e.target.closest('.note-item-text')) {
      switchTab('home');
    }
  });

  // Default view: Home tab
  switchTab('home');
}

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
