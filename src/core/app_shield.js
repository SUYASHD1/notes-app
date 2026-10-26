/**
 * Total App Shield: Neutralizes browser interference so the app runs as a true standalone desktop app.
 * - Blocks native browser context menu (right-click) across canvas, notes, and objects.
 * - Shuts down browser native undo/redo engine (beforeinput) to guarantee 200-step time machine.
 * - Banishes the text caret immediately when clicking images, cards, headers, or canvas.
 * - Prevents browser ghost-dragging.
 */

export function dismissTextCaret() {
  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      sel.removeAllRanges();
    }
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.isContentEditable) {
      document.activeElement.blur();
    }
  } catch (_) {}
}

export function setupAppShield(options = {}) {
  const {
    state,
    saveActivePageDocument,
    renderAll,
    showToast
  } = options;

  // 1. Total Right-Click Neutralization (Block browser context menu everywhere)
  window.addEventListener('contextmenu', (e) => {
    // Only allow native context menu if user is deliberately inside a standard text input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true });

  // 2. Total Shutdown of Browser Native Undo / Redo (`beforeinput`)
  window.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo') {
      e.preventDefault();
      e.stopPropagation();
      if (state?.history?.canUndo()) {
        state.history.undo();
        if (typeof saveActivePageDocument === 'function') saveActivePageDocument();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showToast === 'function') showToast('↺ Undone');
      }
      return;
    }
    if (e.inputType === 'historyRedo') {
      e.preventDefault();
      e.stopPropagation();
      if (state?.history?.canRedo()) {
        state.history.redo();
        if (typeof saveActivePageDocument === 'function') saveActivePageDocument();
        if (typeof renderAll === 'function') renderAll();
        if (typeof showToast === 'function') showToast('↻ Redone');
      }
      return;
    }
  }, { capture: true });

  // 3. Text Caret Banishment (Clicking outside text turns off typing mode)
  window.addEventListener('pointerdown', (e) => {
    const target = e.target;
    if (!target) return;

    // Check if clicked an object inside note (image, nested card, table)
    const isObject = target.closest?.('.note-image-container, .note-nested-card, .note-table-wrapper, .table-move-handle');
    // Check if clicked container chrome (header, dots handle, border, resize handle)
    const isContainerChrome = target.closest?.('.note-container-header, .block-handle-dots, .container-resize-handle, .block-drag-bar');
    // Check if clicked canvas background
    const isCanvasBg = target.id === 'canvas-container' || target.id === 'ink-canvas' || target.classList?.contains('canvas-background');

    if (isObject || isContainerChrome || isCanvasBg) {
      dismissTextCaret();
    }
  }, { capture: true });

  // 4. Zero Browser Ghost Dragging
  window.addEventListener('dragstart', (e) => {
    const target = e.target;
    // If dragging a raw image not handled by in-note drag
    if (target.tagName === 'IMG' && !target.closest('.note-image-container, .note-nested-card')) {
      e.preventDefault();
    }
  }, { capture: true });
}
