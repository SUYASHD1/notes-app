// Canvas Viewport Pan, Pointer & Marquee Selection Interaction
import { FrustumCuller } from './culler.js';
import { setupKineticPan } from './kinetic_pan.js';

/**
 * Initializes natural wheel, touchpad, mouse drag, momentum pan, and marquee selection.
 */
export function setupViewportInteractions(options) {
  const {
    state,
    container,
    marqueeBox,
    updateWorldTransform,
    updateSelectionStatus,
    renderAll,
    animateViewport,
    fitAllContent,
    createNewNoteContainer,
    AddBlockCommand,
    saveActivePageDocument,
    showToast
  } = options;

  let isSpaceDown = false;

  const { trackPanMove, startMomentumPan, stopMomentum } = setupKineticPan(options);

  const isInteractiveTarget = (target) => {
    if (!target || !target.closest) return false;
    return target.closest('.universal-note-container, button, select, input, .ribbon-cluster, #app-sidebar, #status-bar, #top-bar, a');
  };

  // Pointer Down on Container (Navigate Mode & Background)
  container.addEventListener('pointerdown', (e) => {
    if (state.mode === 'ipad') return;
    stopMomentum();

    if (e.pointerType === 'touch') {
      state.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (state.activeTouches.size >= 2) {
        state.isPanning = false;
        return;
      }

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

    if (e.button === 1 || isSpaceDown) {
      e.preventDefault();
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY };
      container.style.cursor = 'grabbing';
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    if (e.button === 2 && !isInteractiveTarget(e.target)) {
      e.preventDefault();
      state.wasRightClickPan = true;
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY };
      container.style.cursor = 'grabbing';
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    if (e.button === 0 && !isInteractiveTarget(e.target)) {
      if (state.activeTool === 'select' && !isSpaceDown) {
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
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      }
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });

  // Pointer Move on Container
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

  // Pointer Up on Container
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

  // Keyboard listeners for navigation
  window.addEventListener('keydown', (e) => {
    const isEditing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;

    if (e.code === 'Space' && !isEditing) {
      if (!isSpaceDown) {
        isSpaceDown = true;
        if (!state.isPanning) container.style.cursor = 'grab';
      }
      return;
    }

    if (isEditing) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0')) {
      e.preventDefault();
      animateViewport(40, 40, 1.0);
      showToast('Reset View to 100%');
      return;
    }

    if (e.shiftKey && (e.key === '!' || e.code === 'Digit1')) {
      e.preventDefault();
      fitAllContent(true);
      showToast('🔍 Framed All Content in View');
      return;
    }

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

    if (state.mode === 'windows' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.code === 'KeyV') {
        document.getElementById('btn-tool-select')?.click();
      } else if (e.code === 'KeyH') {
        document.getElementById('btn-tool-hand')?.click();
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

  container.addEventListener('contextmenu', (e) => {
    if (state.wasRightClickPan) {
      e.preventDefault();
      state.wasRightClickPan = false;
    }
  });

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

  return { stopMomentum };
}
