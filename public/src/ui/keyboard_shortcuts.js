// Keyboard Shortcuts, Clipboard Paste & Drag-and-Drop Controller

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
