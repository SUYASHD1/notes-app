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
  const {
    actionAddNote,
    actionBrowseMedia,
    actionBrowsePdf,
    actionInsertTable,
    actionInsertPlot,
    actionInsertSketch,
    actionInsertMath
  } = createContainerActions(options);

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
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(lastActiveRange);
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
      el.addEventListener('pointerdown', captureTextSelection);
    }
  });

  // Typography buttons
  document.getElementById('ribbon-bold')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('bold');
    syncRibbonActiveStates();
    captureTextSelection();
  });
  document.getElementById('ribbon-italic')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('italic');
    syncRibbonActiveStates();
    captureTextSelection();
  });
  document.getElementById('ribbon-underline')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('underline');
    syncRibbonActiveStates();
    captureTextSelection();
  });
  document.getElementById('ribbon-strike')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('strikeThrough');
    syncRibbonActiveStates();
    captureTextSelection();
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

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#highlighter-palette') && !e.target.closest('#ribbon-highlight-dropdown-btn')) {
      highlightPalette?.classList.add('hidden');
    }
  });

  document.addEventListener('selectionchange', () => {
    if (isHighlightMode) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const textBlock = (node.nodeType === 1 ? node : node.parentElement)?.closest('.note-item-text');
        if (textBlock) {
          applyHighlight(activeHighlightColor);
        }
      }
    }
  });
  const ribbonColorInput = document.getElementById('ribbon-color');
  const ribbonColorBar = document.getElementById('ribbon-color-bar');
  ribbonColorInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (ribbonColorBar) {
      ribbonColorBar.style.backgroundColor = val;
      ribbonColorBar.style.boxShadow = `0 1px 5px ${val}66`;
    }
    restoreTextSelection();
    document.execCommand('foreColor', false, val);
    captureTextSelection();
  });

  // Alignment buttons
  document.getElementById('ribbon-align-left')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('justifyLeft');
    captureTextSelection();
  });
  document.getElementById('ribbon-align-center')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('justifyCenter');
    captureTextSelection();
  });
  document.getElementById('ribbon-align-right')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('justifyRight');
    captureTextSelection();
  });

  // Lists & Checkboxes
  document.getElementById('ribbon-bullet')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('insertUnorderedList');
    captureTextSelection();
  });
  document.getElementById('ribbon-num')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('insertOrderedList');
    captureTextSelection();
  });
  document.getElementById('ribbon-task')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('insertHTML', false, '<label class="checklist-item"><input type="checkbox"> &nbsp;</label>');
    captureTextSelection();
  });

  // Font Family, Font Size, Heading Style
  document.getElementById('ribbon-font')?.addEventListener('change', (e) => {
    restoreTextSelection();
    document.execCommand('fontName', false, e.target.value);
    captureTextSelection();
  });
  document.getElementById('ribbon-font-size')?.addEventListener('change', (e) => {
    restoreTextSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const span = document.createElement('span');
      span.style.fontSize = e.target.value;
      const range = sel.getRangeAt(0);
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    captureTextSelection();
  });
  document.getElementById('ribbon-heading')?.addEventListener('change', (e) => {
    restoreTextSelection();
    document.execCommand('formatBlock', false, `<${e.target.value}>`);
    captureTextSelection();
  });

  // Live Ribbon Active State Synchronization (like MS Word Home Tab)
  function syncRibbonActiveStates() {
    const boldBtn = document.getElementById('ribbon-bold');
    const italicBtn = document.getElementById('ribbon-italic');
    const underBtn = document.getElementById('ribbon-underline');
    const strikeBtn = document.getElementById('ribbon-strike');
    const alignLeftBtn = document.getElementById('ribbon-align-left');
    const alignCenterBtn = document.getElementById('ribbon-align-center');
    const alignRightBtn = document.getElementById('ribbon-align-right');
    const bulletBtn = document.getElementById('ribbon-bullet');
    const numBtn = document.getElementById('ribbon-num');
    const headingSelect = document.getElementById('ribbon-heading');

    try {
      if (boldBtn) boldBtn.classList.toggle('active', document.queryCommandState('bold'));
      if (italicBtn) italicBtn.classList.toggle('active', document.queryCommandState('italic'));
      if (underBtn) underBtn.classList.toggle('active', document.queryCommandState('underline'));
      if (strikeBtn) strikeBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));
      if (alignLeftBtn) alignLeftBtn.classList.toggle('active', document.queryCommandState('justifyLeft'));
      if (alignCenterBtn) alignCenterBtn.classList.toggle('active', document.queryCommandState('justifyCenter'));
      if (alignRightBtn) alignRightBtn.classList.toggle('active', document.queryCommandState('justifyRight'));
      if (bulletBtn) bulletBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
      if (numBtn) numBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'));
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
  setupScrollbarDragging({
    state,
    container,
    world,
    onTransformChange: () => {
      const currentZoomPercent = Math.round(state.viewport.zoom * 100);
      if (currentZoomPercent !== lastRenderedZoom) {
        lastRenderedZoom = currentZoomPercent;
        if (zoomIndicator) zoomIndicator.textContent = currentZoomPercent + '%';
      }
    },
    onSave: () => debouncedSave(800)
  });
  setupEdgeAutoScroll({
    state,
    container,
    world,
    onTransformChange: () => {
      const currentZoomPercent = Math.round(state.viewport.zoom * 100);
      if (currentZoomPercent !== lastRenderedZoom) {
        lastRenderedZoom = currentZoomPercent;
        if (zoomIndicator) zoomIndicator.textContent = currentZoomPercent + '%';
      }
    }
  });
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

  // Native Local Media File Input Handler
  if (mediaFileInput) {
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
  }

  // Native Local PDF File Input Handler (OneNote Slide Printout)
  if (pdfFileInput) {
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

  return { actionAddNote, actionBrowseMedia, actionBrowsePdf, actionInsertTable, actionInsertPlot, actionInsertSketch, actionInsertMath };
}
