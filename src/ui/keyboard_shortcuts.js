import { RemoveBlockCommand } from '../core/history.js';
import { setupZoomControls } from './zoom_controls.js';
import { setupCanvasDrop } from './canvas_drop_handler.js';

/**
 * Sets up global hotkeys, clipboard paste, file drag & drop, and zoom controls.
 */
export function setupKeyboardAndClipboard(options) {
  const {
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
  } = options;

  window.addEventListener('keydown', (e) => {
    // Universal Master Time-Machine Undo / Redo (Pre-empts browser contenteditable everywhere!)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        if (state.history?.canRedo()) {
          state.history.redo();
          saveActivePageDocument();
          renderAll();
          showToast('↻ Redone');
        }
      } else {
        if (state.history?.canUndo()) {
          state.history.undo();
          saveActivePageDocument();
          renderAll();
          showToast('↺ Undone');
        }
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      e.stopPropagation();
      if (state.history?.canRedo()) {
        state.history.redo();
        saveActivePageDocument();
        renderAll();
        showToast('↻ Redone');
      }
      return;
    }

    const getSelectedObject = () => {
      return document.querySelector('.selected-image, .selected-table, .selected-nested-card');
    };

    // --- Individual Object Shortcuts (Delete, Backspace, Ctrl+C, Ctrl+X, Ctrl+D) ---
    const activeObj = getSelectedObject();
    if (activeObj) {
      if (e.code === 'Delete' || e.code === 'Backspace' || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        const beforeSnap = state.history?.takeSnapshot(state.doc);
        const parentText = activeObj.closest('.note-item-text');
        activeObj.remove();
        if (parentText && typeof parentText._syncContent === 'function') {
          parentText._syncContent();
        }
        if (beforeSnap) state.history?.recordSnapshot(state.doc, beforeSnap);
        saveActivePageDocument();
        renderAll();
        showToast('🗑️ Item removed');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        state.clipboardItem = {
          html: activeObj.outerHTML,
          isImage: activeObj.classList.contains('note-image-container'),
          isCard: activeObj.classList.contains('note-nested-card'),
          isTable: activeObj.classList.contains('note-table-wrapper')
        };
        try {
          navigator.clipboard?.writeText(activeObj.outerHTML);
        } catch (_) {}
        showToast('📋 Item copied');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyX' || e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
        const beforeSnap = state.history?.takeSnapshot(state.doc);
        state.clipboardItem = {
          html: activeObj.outerHTML,
          isImage: activeObj.classList.contains('note-image-container'),
          isCard: activeObj.classList.contains('note-nested-card'),
          isTable: activeObj.classList.contains('note-table-wrapper')
        };
        try {
          navigator.clipboard?.writeText(activeObj.outerHTML);
        } catch (_) {}
        const parentText = activeObj.closest('.note-item-text');
        activeObj.remove();
        if (parentText && typeof parentText._syncContent === 'function') {
          parentText._syncContent();
        }
        if (beforeSnap) state.history?.recordSnapshot(state.doc, beforeSnap);
        saveActivePageDocument();
        renderAll();
        showToast('✂️ Item cut');
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyD' || e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        e.stopPropagation();
        const beforeSnap = state.history?.takeSnapshot(state.doc);
        const clone = activeObj.cloneNode(true);
        clone.classList.remove('selected-image', 'selected-nested-card', 'selected-table');
        activeObj.parentNode.insertBefore(clone, activeObj.nextSibling);
        const parentText = activeObj.closest('.note-item-text');
        if (parentText && typeof parentText._syncContent === 'function') {
          parentText._syncContent();
        }
        if (beforeSnap) state.history?.recordSnapshot(state.doc, beforeSnap);
        saveActivePageDocument();
        renderAll();
        showToast('📑 Item duplicated');
        return;
      }
    }

    // Ctrl+V: Paste individual item if clipboardItem exists
    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key === 'v' || e.key === 'V')) {
      if (state.clipboardItem) {
        const activeContainerEl = state.activeContainerId ? document.getElementById(state.activeContainerId) : null;
        const textDiv = activeContainerEl ? activeContainerEl.querySelector('.note-item-text') : null;
        if (textDiv) {
          e.preventDefault();
          e.stopPropagation();
          const beforeSnap = state.history?.takeSnapshot(state.doc);
          const temp = document.createElement('div');
          temp.innerHTML = state.clipboardItem.html;
          const pastedEl = temp.firstElementChild;
          if (pastedEl) {
            pastedEl.classList.remove('selected-image', 'selected-nested-card', 'selected-table');
            if (activeObj && activeObj.parentNode) {
              activeObj.parentNode.insertBefore(pastedEl, activeObj.nextSibling);
            } else {
              textDiv.appendChild(pastedEl);
            }
            if (typeof textDiv._syncContent === 'function') textDiv._syncContent();
            if (beforeSnap) state.history?.recordSnapshot(state.doc, beforeSnap);
            saveActivePageDocument();
            renderAll();
            showToast('📋 Item pasted');
            return;
          }
        }
      }
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    // Delete / Backspace: Remove selected note container
    if (e.code === 'Delete' || e.code === 'Backspace' || e.key === 'Delete' || e.key === 'Backspace') {
      const selectedIds = Array.from(state.selectedBlockIds || []);
      const activeId = state.activeContainerId;
      const idsToDelete = selectedIds.length > 0 ? selectedIds : (activeId ? [activeId] : []);

      if (idsToDelete.length > 0) {
        e.preventDefault();
        idsToDelete.forEach(id => {
          if (state.history) {
            state.history.execute(new RemoveBlockCommand(state.doc, id));
          } else {
            const idx = (state.doc.blocks || []).findIndex(b => b.id === id);
            if (idx !== -1) state.doc.blocks.splice(idx, 1);
          }
          state.selectedBlockIds?.delete(id);
        });
        if (state.activeContainerId && idsToDelete.includes(state.activeContainerId)) {
          state.activeContainerId = null;
        }
        saveActivePageDocument();
        renderAll();
        showToast('🗑️ Note removed (Ctrl+Z to undo)');
        return;
      }
    }

    // Escape: Clear block selection
    if (e.code === 'Escape' || e.key === 'Escape') {
      if (state.selectedBlockIds?.size > 0 || state.activeContainerId) {
        state.selectedBlockIds?.clear();
        state.activeContainerId = null;
        renderAll();
        return;
      }
    }

    // --- Container Clipboard Multiplexing (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D) ---
    const getTargetBlockIds = () => {
      const selected = Array.from(state.selectedBlockIds || []);
      if (selected.length > 0) return selected;
      if (state.activeContainerId) return [state.activeContainerId];
      return [];
    };

    const copySelectedBlocks = () => {
      const ids = getTargetBlockIds();
      if (ids.length === 0 || !state.doc) return false;
      const blocks = ids.map(id => state.doc.getBlock(id)).filter(Boolean);
      if (blocks.length === 0) return false;
      state.clipboardBlocks = JSON.parse(JSON.stringify(blocks));
      try {
        navigator.clipboard?.writeText(JSON.stringify({ type: 'notes-blocks-clip', blocks: state.clipboardBlocks }));
      } catch (_) {}
      showToast(`📋 Copied ${blocks.length} note${blocks.length > 1 ? 's' : ''}`);
      return true;
    };

    const cutSelectedBlocks = () => {
      if (copySelectedBlocks()) {
        const ids = getTargetBlockIds();
        ids.forEach(id => {
          if (state.history) {
            state.history.execute(new RemoveBlockCommand(state.doc, id));
          } else {
            const idx = (state.doc.blocks || []).findIndex(b => b.id === id);
            if (idx !== -1) state.doc.blocks.splice(idx, 1);
          }
          state.selectedBlockIds?.delete(id);
        });
        if (state.activeContainerId && ids.includes(state.activeContainerId)) {
          state.activeContainerId = null;
        }
        saveActivePageDocument();
        renderAll();
        showToast('✂️ Note cut (Ctrl+Z to undo)');
        return true;
      }
      return false;
    };

    const pasteClipboardBlocks = () => {
      if (!state.clipboardBlocks || state.clipboardBlocks.length === 0 || !state.doc) return false;
      state.selectedBlockIds?.clear();
      const newIds = [];
      state.clipboardBlocks.forEach(template => {
        const newId = 'block_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const cloned = JSON.parse(JSON.stringify(template));
        cloned.id = newId;
        cloned.x = (cloned.x || 40) + 30;
        cloned.y = (cloned.y || 40) + 30;
        if (cloned.items) {
          cloned.items.forEach((it, idx) => {
            it.id = 'item_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6);
          });
        }
        if (AddBlockCommand && state.history) {
          state.history.execute(new AddBlockCommand(state.doc, cloned));
        } else {
          state.doc.addBlock(cloned);
        }
        newIds.push(newId);
      });
      newIds.forEach(id => state.selectedBlockIds?.add(id));
      state.activeContainerId = newIds[newIds.length - 1];
      // Increment offset so repeated Ctrl+V creates a cascading cascade (+30, +60, +90)
      state.clipboardBlocks.forEach(b => {
        b.x = (b.x || 40) + 30;
        b.y = (b.y || 40) + 30;
      });
      saveActivePageDocument();
      renderAll();
      showToast(`📋 Pasted ${newIds.length} note${newIds.length > 1 ? 's' : ''}`);
      return true;
    };

    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.key === 'c' || e.key === 'C')) {
      if (getTargetBlockIds().length > 0) {
        e.preventDefault();
        copySelectedBlocks();
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyX' || e.key === 'x' || e.key === 'X')) {
      if (getTargetBlockIds().length > 0) {
        e.preventDefault();
        cutSelectedBlocks();
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key === 'v' || e.key === 'V')) {
      if (state.clipboardBlocks && state.clipboardBlocks.length > 0) {
        e.preventDefault();
        pasteClipboardBlocks();
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyD' || e.key === 'd' || e.key === 'D')) {
      if (getTargetBlockIds().length > 0) {
        e.preventDefault();
        if (copySelectedBlocks()) {
          pasteClipboardBlocks();
          showToast('📑 Note duplicated');
        }
        return;
      }
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
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
      if (typeof fitAllContent === 'function') fitAllContent(true);
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

  // Setup Canvas Drag & Drop and Pop-Out
  setupCanvasDrop({
    container,
    state,
    createNewNoteContainer,
    AddBlockCommand,
    saveActivePageDocument,
    renderAll,
    showToast
  });

  // Setup Canvas Zoom Flyout and Controls
  setupZoomControls({
    container,
    state,
    fitAllContent,
    animateViewport,
    showToast,
    zoomIndicator
  });
}
