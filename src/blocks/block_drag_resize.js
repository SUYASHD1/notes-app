// Note Container Dragging, Multi-Selection Physics & 8-Point Bounding Box Resizing
import { ResizeHandleEngine } from './resize_handle.js';

export function attachResizeHandle(handleEl, block, blockEl, dir, deps = {}) {
  const isVertical = dir.includes('n') || dir.includes('s');
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const showToast = deps.showToast || window.showToast;
  const state = deps.state || window.state;

  // Double click on boundary resets height back to auto-fit content
  handleEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.preventDefault();
    delete block.height;
    blockEl.style.minHeight = '';
    if (saveActivePageDocument) saveActivePageDocument();
    if (showToast) showToast('↕ Reset height to content');
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
      const zoom = (state && state.viewport) ? state.viewport.zoom : 1;
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;

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
      if (saveActivePageDocument) saveActivePageDocument();
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

export function makeDraggable(el, handle, block, deps = {}) {
  const state = deps.state || window.state;
  const renderAll = deps.renderAll || window.renderAll;
  const debouncedSave = deps.debouncedSave || window.debouncedSave;
  const registerActiveDragCallback = deps.registerActiveDragCallback;
  const unregisterActiveDragCallback = deps.unregisterActiveDragCallback;

  const onPointerDown = (e) => {
    if (state && state.mode === 'ipad') return;
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    try {
      if (handle.setPointerCapture && e.pointerId !== undefined) {
        handle.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (state) {
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
    }
    if (renderAll) renderAll();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPositions = new Map();

    if (state && state.selectedBlockIds) {
      state.selectedBlockIds.forEach(id => {
        const b = state.doc.getBlock(id);
        if (b) initialPositions.set(id, { x: b.x, y: b.y });
      });
    }

    let accumulatedScrollDx = 0;
    let accumulatedScrollDy = 0;

    const updateBlockPositions = (screenDx, screenDy) => {
      initialPositions.forEach((pos, id) => {
        const targetBlock = state.doc.getBlock(id);
        const targetEl = document.getElementById(id);
        if (targetBlock && targetEl) {
          // Physical boundaries: cannot breach top or left margins into the void
          targetBlock.x = Math.max(40, Math.round(pos.x + screenDx + accumulatedScrollDx));
          targetBlock.y = Math.max(40, Math.round(pos.y + screenDy + accumulatedScrollDy));
          targetEl.style.left = `${targetBlock.x}px`;
          targetEl.style.top = `${targetBlock.y}px`;
        }
      });
    };

    let lastMoveClientX = startX;
    let lastMoveClientY = startY;

    // Register with edge auto-scroll so the box glides with the cursor when canvas pans
    if (registerActiveDragCallback) {
      registerActiveDragCallback((scrollDx, scrollDy) => {
        accumulatedScrollDx += scrollDx;
        accumulatedScrollDy += scrollDy;
        const zoom = (state && state.viewport) ? state.viewport.zoom : 1;
        const screenDx = (lastMoveClientX - startX) / zoom;
        const screenDy = (lastMoveClientY - startY) / zoom;
        updateBlockPositions(screenDx, screenDy);
      });
    }

    const onPointerMove = (moveEvent) => {
      lastMoveClientX = moveEvent.clientX;
      lastMoveClientY = moveEvent.clientY;
      const zoom = (state && state.viewport) ? state.viewport.zoom : 1;
      const screenDx = (moveEvent.clientX - startX) / zoom;
      const screenDy = (moveEvent.clientY - startY) / zoom;
      updateBlockPositions(screenDx, screenDy);
    };

    const onPointerUp = (upEvent) => {
      if (unregisterActiveDragCallback) {
        unregisterActiveDragCallback();
      }
      try {
        if (upEvent && upEvent.pointerId !== undefined && handle.hasPointerCapture && handle.hasPointerCapture(upEvent.pointerId)) {
          handle.releasePointerCapture(upEvent.pointerId);
        }
      } catch (_) {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      if (debouncedSave) debouncedSave(600);
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
