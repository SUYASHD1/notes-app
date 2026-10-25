import { createContainerActions } from './container_actions.js';
import { setupRibbonTabs } from './ribbon_controller.js';
import { setupScrollbarDragging, setupEdgeAutoScroll } from '../canvas/scrollbar_controller.js';
import { setupTypographyPalettes } from './typography_palette_actions.js';

/**
 * Initializes formatting ribbon, typography controls, and media insertion buttons.
 */
export function setupRibbonControls(options) {
  const {
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
  } = options;

  let lastRenderedZoom = Math.round(state.viewport.zoom * 100);

  // --- Container Item Creation Actions ---
  const { actionAddNote, actionBrowseMedia, actionBrowsePdf, actionInsertTable, actionInsertPlot, actionInsertSketch, actionInsertMath } = createContainerActions(options);

  // Default tool is auto-select & pan
  state.activeTool = state.activeTool || 'select';

  // Persistent text selection keeper across dropdowns & color pickers
  let lastActiveRange = null;

  function captureTextSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const textBlock = (node.nodeType === 1 ? node : node.parentElement)?.closest('.note-item-text');
      if (textBlock) {
        lastActiveRange = range.cloneRange();
      }
    }
  }

  function restoreTextSelection() {
    if (lastActiveRange) {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(lastActiveRange);
      if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
        window.scrollTo(scrollX, scrollY);
      }
    }
  }

  document.addEventListener('selectionchange', captureTextSelection);
  document.addEventListener('pointerup', captureTextSelection);

  // Prevent focus theft so contentEditable stays active
  ['ribbon-bold', 'ribbon-italic', 'ribbon-underline', 'ribbon-strike', 'ribbon-highlight',
   'ribbon-bullet', 'ribbon-num', 'ribbon-task', 'ribbon-align-left', 'ribbon-align-center', 'ribbon-align-right'
  ].forEach(id => document.getElementById(id)?.addEventListener('mousedown', (e) => e.preventDefault()));

  ['ribbon-color', 'ribbon-font-size', 'ribbon-heading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', captureTextSelection);
      el.addEventListener('pointerdown', () => {
        captureTextSelection();
        const sx = window.scrollX, sy = window.scrollY, rb = document.getElementById('ribbon-bar'), rx = rb?.scrollLeft || 0;
        requestAnimationFrame(() => {
          if (window.scrollX !== sx || window.scrollY !== sy) window.scrollTo(sx, sy);
          if (rb && rb.scrollLeft !== rx) rb.scrollLeft = rx;
        });
      });
    }
  });

  // Typography buttons
  [['ribbon-bold', 'bold'], ['ribbon-italic', 'italic'], ['ribbon-underline', 'underline'], ['ribbon-strike', 'strikeThrough']].forEach(([id, cmd]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      restoreTextSelection();
      document.execCommand(cmd);
      syncRibbonActiveStates();
      captureTextSelection();
    });
  });
  // Live Ribbon Active State Synchronization (subtle blue glow for active commands)
  function syncRibbonActiveStates() {
    try {
      [
        ['ribbon-bold', 'bold'],
        ['ribbon-italic', 'italic'],
        ['ribbon-underline', 'underline'],
        ['ribbon-strike', 'strikeThrough'],
        ['ribbon-align-left', 'justifyLeft'],
        ['ribbon-align-center', 'justifyCenter'],
        ['ribbon-align-right', 'justifyRight'],
        ['ribbon-bullet', 'insertUnorderedList'],
        ['ribbon-num', 'insertOrderedList']
      ].forEach(([id, cmd]) => {
        document.getElementById(id)?.classList.toggle('active', !!document.queryCommandState(cmd));
      });
    } catch (_) {}

    const sel = window.getSelection();
    const headingSelect = document.getElementById('ribbon-heading');
    if (sel && sel.anchorNode && headingSelect) {
      const parentBlock = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
      const hTag = parentBlock?.closest('h1, h2, h3, p');
      if (hTag) headingSelect.value = hTag.tagName.toLowerCase();
    }
  }

  // Delegate Color, Highlighter, Canva Font Menu, and Spacing Popovers
  const { applyFontFamily, applyHighlight, applyFontColor, applySpacing } = setupTypographyPalettes({
    state,
    restoreTextSelection,
    captureTextSelection,
    syncRibbonActiveStates,
    showToast,
    saveActivePageDocument
  });

  // Alignment and List buttons
  const cmdMap = {
    'ribbon-align-left': 'justifyLeft',
    'ribbon-align-center': 'justifyCenter',
    'ribbon-align-right': 'justifyRight',
    'ribbon-bullet': 'insertUnorderedList',
    'ribbon-num': 'insertOrderedList'
  };
  Object.entries(cmdMap).forEach(([id, cmd]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      restoreTextSelection();
      document.execCommand(cmd);
      captureTextSelection();
    });
  });

  document.getElementById('ribbon-task')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('insertHTML', false, '<label class="checklist-item"><input type="checkbox"> &nbsp;</label>');
    captureTextSelection();
  });

  // Font Size and Heading Style (Master Switch 2: Frozen Ground)
  const lockScrolls = (fn) => {
    const sx = window.scrollX, sy = window.scrollY, rb = document.getElementById('ribbon-bar'), rx = rb?.scrollLeft || 0;
    fn();
    if (window.scrollX !== sx || window.scrollY !== sy) window.scrollTo(sx, sy);
    if (rb && rb.scrollLeft !== rx) rb.scrollLeft = rx;
  };

  document.getElementById('ribbon-font-size')?.addEventListener('change', (e) => {
    const val = e.target.value;
    lockScrolls(() => {
      restoreTextSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0), span = document.createElement('span');
        span.style.fontSize = val;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        const nr = document.createRange();
        nr.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
      captureTextSelection();
    });
    e.target.blur();
  });

  document.getElementById('ribbon-heading')?.addEventListener('change', (e) => {
    const val = e.target.value;
    lockScrolls(() => {
      restoreTextSelection();
      document.execCommand('formatBlock', false, `<${val}>`);
      captureTextSelection();
    });
    e.target.blur();
  });

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
  const onZoomSync = () => {
    const curZoom = Math.round(state.viewport.zoom * 100);
    if (curZoom !== lastRenderedZoom) {
      lastRenderedZoom = curZoom;
      if (zoomIndicator) zoomIndicator.textContent = `${curZoom}%`;
    }
  };
  setupScrollbarDragging({ state, container, world, onTransformChange: onZoomSync, onSave: () => debouncedSave(800) });
  setupEdgeAutoScroll({ state, container, world, onTransformChange: onZoomSync });
  setupRibbonTabs();

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (state.history.canUndo()) { state.history.undo(); saveActivePageDocument(); renderAll(); showToast('↺ Undone'); }
  });
  document.getElementById('btn-redo')?.addEventListener('click', () => {
    if (state.history.canRedo()) { state.history.redo(); saveActivePageDocument(); renderAll(); showToast('↻ Redone'); }
  });

  // Ribbon (Layout A) & Capsule (Layout B) Insert Action Bindings
  const insertMap = {
    note: actionAddNote, media: actionBrowseMedia, pdf: actionBrowsePdf,
    sketch: actionInsertSketch, table: actionInsertTable, plot: actionInsertPlot, math: actionInsertMath
  };
  ['btn-add-note', 'btn-browse-media', 'btn-browse-pdf', 'btn-insert-sketch', 'btn-insert-table', 'btn-insert-plot', 'btn-add-math'].forEach(id => {
    const key = id.replace('btn-add-', '').replace('btn-browse-', '').replace('btn-insert-', '');
    if (insertMap[key]) document.getElementById(id)?.addEventListener('click', insertMap[key]);
  });
  ['note', 'sketch', 'media', 'pdf', 'table', 'plot', 'math'].forEach(k => {
    document.getElementById(`cap-${k}`)?.addEventListener('click', insertMap[k]);
    if (k !== 'note') document.getElementById(`pal-${k}`)?.addEventListener('click', insertMap[k]);
  });

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
  return { actionAddNote, actionBrowseMedia, actionBrowsePdf, actionInsertTable, actionInsertPlot, actionInsertSketch, actionInsertMath };
}

