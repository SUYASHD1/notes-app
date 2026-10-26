// Keyboard Shortcuts, Clipboard Paste & Drag-and-Drop Controller
import { RemoveBlockCommand } from '../core/history.js';

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

  // Drag & Drop from File Explorer
  if (container) {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();

      // Check if dropped item was an in-note image dragged OUT of its container (Automatic Pop-Out)
      const inNoteImgRaw = e.dataTransfer ? e.dataTransfer.getData('application/notes-in-note-img') : null;
      if (inNoteImgRaw) {
        try {
          const imgData = JSON.parse(inNoteImgRaw);
          const rect = container.getBoundingClientRect();
          const dropWorld = state.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

          // Remove the image element from its source container
          if (imgData.sourceBlockId) {
            const sourceEl = document.getElementById(imgData.sourceBlockId);
            const sourceTextDiv = sourceEl ? sourceEl.querySelector('.note-item-text') : null;
            if (sourceTextDiv) {
              const draggedImg = sourceTextDiv.querySelector('.dragging-element') || sourceTextDiv.querySelector(`.note-image-container[data-src="${CSS.escape(imgData.src)}"]`);
              if (draggedImg) draggedImg.remove();
              if (typeof sourceTextDiv._syncContent === 'function') sourceTextDiv._syncContent();
            }
          }

          const newNote = createNewNoteContainer(Math.round(dropWorld.x - 180), Math.round(dropWorld.y - 120), imgData.alt || 'NOTE');
          newNote.width = Math.max(340, Math.min(600, imgData.width || 420));
          newNote.items = [{
            id: 'item_img_' + Date.now(),
            type: 'image',
            src: imgData.src,
            caption: imgData.alt || 'Popped Out Image',
            width: imgData.width || 380
          }];
          state.history.execute(new AddBlockCommand(state.doc, newNote));
          state.activeContainerId = newNote.id;
          state.selectedBlockIds?.clear();
          state.selectedBlockIds?.add(newNote.id);
          saveActivePageDocument();
          renderAll();
          showToast('🪟 Image popped out to canvas note');
          return;
        } catch (err) {
          console.warn('Pop-out drag failed:', err);
        }
      }

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
  }

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
    if (typeof fitAllContent === 'function') fitAllContent(true);
    zoomFlyout?.classList.add('hidden');
    showToast('🔍 Framed All Content in View (Shift+1)');
  });

  document.getElementById('btn-reset-view')?.addEventListener('click', () => {
    if (typeof animateViewport === 'function') animateViewport(40, 40, 1.0);
    zoomFlyout?.classList.add('hidden');
    showToast('Reset View to 100%');
  });

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    if (!container) return;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const worldBefore = state.viewport.screenToWorld(cx, cy);
    const targetZoom = Math.min(4.0, state.viewport.zoom * 1.25);
    const targetX = cx - worldBefore.x * targetZoom;
    const targetY = cy - worldBefore.y * targetZoom;
    if (typeof animateViewport === 'function') animateViewport(targetX, targetY, targetZoom, 200);
  });

  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    if (!container) return;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const worldBefore = state.viewport.screenToWorld(cx, cy);
    const targetZoom = Math.max(0.2, state.viewport.zoom * 0.8);
    const targetX = cx - worldBefore.x * targetZoom;
    const targetY = cy - worldBefore.y * targetZoom;
    if (typeof animateViewport === 'function') animateViewport(targetX, targetY, targetZoom, 200);
  });

  zoomIndicator?.addEventListener('dblclick', () => {
    if (typeof fitAllContent === 'function') fitAllContent(true);
  });
}
