import { createContainerActions } from './container_actions.js';
import { setupRibbonTabs } from './ribbon_controller.js';
import { setupScrollbarDragging, setupEdgeAutoScroll } from '../canvas/scrollbar_controller.js';

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

  ['ribbon-color', 'ribbon-font', 'ribbon-font-size', 'ribbon-heading'].forEach(id => {
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
  // Interactive Smart Highlighter System
  let activeHighlightColor = '#fef08a';
  let isHighlightMode = false;
  const highlightBtn = document.getElementById('ribbon-highlight');
  const highlightBar = document.getElementById('ribbon-highlight-bar');
  const highlightDropBtn = document.getElementById('ribbon-highlight-dropdown-btn');
  const highlightPalette = document.getElementById('highlighter-palette');

  function applyHighlight(color) {
    restoreTextSelection();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      if (color === 'transparent') {
        document.execCommand('removeFormat');
      } else {
        document.execCommand('hiliteColor', false, color);
      }
      syncRibbonActiveStates();
      captureTextSelection();
      return true;
    }
    return false;
  }

  highlightBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const applied = applyHighlight(activeHighlightColor);
    if (!applied) {
      isHighlightMode = !isHighlightMode;
      highlightBtn.classList.toggle('active', isHighlightMode);
      if (typeof showToast === 'function') {
        showToast(isHighlightMode ? '🖍️ Highlight Tool Active: Drag over text to highlight' : 'Highlight Tool Inactive');
      }
    }
  });

  highlightDropBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!highlightPalette) return;
    fontColorPalette?.classList.add('hidden');
    const isHidden = highlightPalette.classList.contains('hidden');
    if (isHidden) {
      const wrapper = highlightDropBtn.closest('#highlighter-picker-wrapper') || highlightDropBtn;
      const rect = wrapper.getBoundingClientRect();
      highlightPalette.style.top = `${rect.bottom + 6}px`;
      highlightPalette.style.left = `${Math.max(10, rect.left - 10)}px`;
      highlightPalette.classList.remove('hidden');
    } else {
      highlightPalette.classList.add('hidden');
    }
  });

  highlightPalette?.querySelectorAll('.hl-swatch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.getAttribute('data-color') || '#fef08a';
      activeHighlightColor = col;
      if (highlightBar) {
        highlightBar.style.backgroundColor = col === 'transparent' ? '#cbd5e1' : col;
        highlightBar.style.boxShadow = col === 'transparent' ? 'none' : `0 1px 5px ${col}88`;
      }
      highlightPalette.querySelectorAll('.hl-swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      highlightPalette.classList.add('hidden');
      applyHighlight(col);
    });
  });

  const fontColorBtn = document.getElementById('ribbon-font-color-btn');
  const fontColorDropBtn = document.getElementById('ribbon-font-color-dropdown-btn');
  const fontColorPalette = document.getElementById('font-color-palette');
  const ribbonColorBar = document.getElementById('ribbon-color-bar');
  const ribbonColorInput = document.getElementById('ribbon-color');
  let activeFontColor = '#0f172a';

  function applyFontColor(color) {
    restoreTextSelection();
    document.execCommand('foreColor', false, color);
    captureTextSelection();
  }

  fontColorBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    applyFontColor(activeFontColor);
  });

  fontColorDropBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!fontColorPalette) return;
    highlightPalette?.classList.add('hidden');
    const isHidden = fontColorPalette.classList.contains('hidden');
    if (isHidden) {
      const wrapper = fontColorDropBtn.closest('.font-color-picker-wrapper') || fontColorDropBtn;
      const rect = wrapper.getBoundingClientRect();
      fontColorPalette.style.top = `${rect.bottom + 6}px`;
      fontColorPalette.style.left = `${Math.max(10, rect.left - 10)}px`;
      fontColorPalette.classList.remove('hidden');
    } else {
      fontColorPalette.classList.add('hidden');
    }
  });

  const resetDefaultBtn = document.getElementById('fc-reset-default');
  resetDefaultBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const defCol = isDark ? '#f1f5f9' : '#18181b';
    activeFontColor = defCol;
    if (ribbonColorBar) {
      ribbonColorBar.style.backgroundColor = defCol;
      ribbonColorBar.style.boxShadow = 'none';
    }
    fontColorPalette?.querySelectorAll('.fc-swatch').forEach(s => s.classList.remove('active'));
    applyFontColor(defCol);
  });

  fontColorPalette?.querySelectorAll('.fc-swatch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.getAttribute('data-color') || '#18181b';
      activeFontColor = col;
      if (ribbonColorBar) {
        ribbonColorBar.style.backgroundColor = col;
        ribbonColorBar.style.boxShadow = `0 1px 5px ${col}88`;
      }
      fontColorPalette.querySelectorAll('.fc-swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      applyFontColor(col);
    });
  });

  ribbonColorInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    activeFontColor = val;
    if (ribbonColorBar) {
      ribbonColorBar.style.backgroundColor = val;
      ribbonColorBar.style.boxShadow = `0 1px 5px ${val}66`;
    }
    fontColorPalette?.querySelectorAll('.fc-swatch').forEach(s => s.classList.remove('active'));
    applyFontColor(val);
  });

  const dismissPalettes = (e) => {
    if (!e.target.closest('#highlighter-palette') && !e.target.closest('#ribbon-highlight-dropdown-btn')) {
      highlightPalette?.classList.add('hidden');
    }
    if (!e.target.closest('#font-color-palette') && !e.target.closest('#ribbon-font-color-dropdown-btn')) {
      fontColorPalette?.classList.add('hidden');
    }
  };
  document.addEventListener('pointerdown', dismissPalettes);
  document.addEventListener('click', dismissPalettes);

  document.addEventListener('selectionchange', () => {
    if (isHighlightMode) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).commonAncestorContainer;
        const textBlock = (node.nodeType === 1 ? node : node.parentElement)?.closest('.note-item-text');
        if (textBlock) applyHighlight(activeHighlightColor);
      }
    }
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

  // Font Family, Font Size, Heading Style (Master Switch 2: Frozen Ground)
  const lockScrolls = (fn) => {
    const sx = window.scrollX, sy = window.scrollY, rb = document.getElementById('ribbon-bar'), rx = rb?.scrollLeft || 0;
    fn();
    if (window.scrollX !== sx || window.scrollY !== sy) window.scrollTo(sx, sy);
    if (rb && rb.scrollLeft !== rx) rb.scrollLeft = rx;
  };

  document.getElementById('ribbon-font')?.addEventListener('change', (e) => {
    const val = e.target.value;
    lockScrolls(() => {
      restoreTextSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0), span = document.createElement('span');
        span.style.fontFamily = val;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        const nr = document.createRange();
        nr.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(nr);
      } else {
        document.execCommand('fontName', false, val);
      }
      captureTextSelection();
    });
    e.target.blur();
  });

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

