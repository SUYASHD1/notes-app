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

  // Select Tool vs Hand Tool Toggle
  const btnSelect = document.getElementById('btn-tool-select');
  const btnHand = document.getElementById('btn-tool-hand');
  if (btnSelect && btnHand) {
    btnSelect.addEventListener('click', () => {
      state.activeTool = 'select';
      btnSelect.classList.add('active');
      btnHand.classList.remove('active');
      if (container) container.style.cursor = 'default';
      showToast('↖ Select Tool: Click to select, drag to marquee');
    });
    btnHand.addEventListener('click', () => {
      state.activeTool = 'hand';
      btnHand.classList.add('active');
      btnSelect.classList.remove('active');
      if (container) container.style.cursor = 'grab';
      showToast('✋ Hand Tool: Drag canvas to pan freely');
    });
  }

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
  document.getElementById('ribbon-highlight')?.addEventListener('click', () => {
    restoreTextSelection();
    document.execCommand('hiliteColor', false, '#fef08a');
    syncRibbonActiveStates();
    captureTextSelection();
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
