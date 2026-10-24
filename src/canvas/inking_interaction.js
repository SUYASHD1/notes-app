// iPad Apple Pencil Inking, Pressure Modulation, Eraser & Palm Rejection Interaction
import { EraserEngine } from './eraser_engine.js';
import { EraseStrokesCommand } from '../core/history.js';
import { finalizeStroke } from './stroke_creator.js';

/**
 * Initializes fluid Apple Pencil inking, pressure tapering, eraser engine, and touch suppression.
 */
export function setupInkingInteractions(options) {
  const {
    state,
    activeDrawCanvas,
    ctx,
    clearActiveDrawCanvas,
    renderGlobalAnnotations,
    appendStrokeToSvg,
    saveActivePageDocument,
    debouncedSave,
    showToast
  } = options;

  let lastPenTouchTime = 0;
  let liveStrokePoints = [];
  let lastMidPoint = null;
  let liveStrokeWidth = 3;

  // Eraser Engine Interactions
  const applyEraserAtScreen = (clientX, clientY) => {
    if (!state.doc || !state.doc.globalAnnotations || state.doc.globalAnnotations.length === 0) return;
    const rect = activeDrawCanvas.getBoundingClientRect();
    const screenPos = { x: clientX - rect.left, y: clientY - rect.top };
    const worldPos = state.viewport.screenToWorld(screenPos.x, screenPos.y);
    const worldRadius = (state.eraserSize || 24) / state.viewport.zoom;

    if (state.eraserMode === 'full') {
      const res = EraserEngine.eraseFullStrokes(state.doc.globalAnnotations, worldPos.x, worldPos.y, worldRadius);
      if (res.removedStrokes.length > 0) {
        state.doc.globalAnnotations = res.remainingStrokes;
        renderGlobalAnnotations();
      }
    } else {
      const res = EraserEngine.erasePartialStrokes(state.doc.globalAnnotations, worldPos.x, worldPos.y, worldRadius);
      if (res.modified) {
        state.doc.globalAnnotations = res.updatedStrokes;
        renderGlobalAnnotations();
      }
    }
  };

  const drawEraserIndicator = (clientX, clientY) => {
    const rect = activeDrawCanvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    clearActiveDrawCanvas();
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, state.eraserSize || 24, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();
    ctx.restore();
  };

  const finishEraserDrag = () => {
    if (state.isErasing) {
      state.isErasing = false;
      if (state.eraserStartStrokes && state.doc) {
        const prev = state.eraserStartStrokes;
        const curr = state.doc.globalAnnotations || [];
        if (prev.length !== curr.length || JSON.stringify(prev) !== JSON.stringify(curr)) {
          state.history.execute(new EraseStrokesCommand(state.doc, prev, curr));
          saveActivePageDocument();
          renderGlobalAnnotations();
        }
      }
      state.eraserStartStrokes = null;
    }
  };

  // State variables for finger navigation in iPad Mode
  let isFingerPanning = false;
  let lastFingerPanPos = null;

  // Active Drawing Canvas Pointer Handlers (Apple Pencil + Finger Navigation + Palm Rejection)
  const onDrawCanvasPointerDown = (e) => {
    if (state.mode !== 'ipad') return;

    if (e.pointerType === 'pen') {
      lastPenTouchTime = Date.now();
    }

    const isInkToolActive = state.inkTool === 'pen' || state.inkTool === 'highlighter';
    if (e.pointerType === 'pen' || (e.pointerType === 'mouse' && isInkToolActive && !e.shiftKey && e.button === 0)) {
      if (e.cancelable) e.preventDefault();

      if (state.inkTool === 'eraser' || (e.pointerType === 'pen' && e.buttons === 32)) {
        state.isErasing = true;
        state.eraserStartStrokes = JSON.parse(JSON.stringify(state.doc.globalAnnotations || []));
        applyEraserAtScreen(e.clientX, e.clientY);
        drawEraserIndicator(e.clientX, e.clientY);
        return;
      }

      state.isDrawing = true;
      state.drawStartTime = Date.now();
      state.lastDrawMoveTime = Date.now();
      state.lastDrawMovePos = { x: e.clientX, y: e.clientY };
      state.currentStrokePoints = [];

      const rect = activeDrawCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldPos = state.viewport.screenToWorld(sx, sy);

      worldPos.time = Date.now();
      worldPos.pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.5;
      state.currentStrokePoints.push(worldPos);

      liveStrokePoints = [{ x: sx, y: sy, pressure: worldPos.pressure }];
      lastMidPoint = { x: sx, y: sy };
      const currentZoom = state.viewport.zoom || 1.0;
      const isHighlighter = state.inkTool === 'highlighter';

      if (isHighlighter) {
        liveStrokeWidth = Math.max(12, (state.inkWidth * 3 * currentZoom) * (0.8 + worldPos.pressure * 0.4));
        const hlColor = state.inkColor === '#0f172a' ? '#facc15' : state.inkColor;
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = hlColor;
        ctx.fillStyle = hlColor;
      } else {
        liveStrokeWidth = Math.max(0.5, (state.inkWidth * currentZoom) * (0.6 + worldPos.pressure * 0.8));
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = state.inkColor;
        ctx.fillStyle = state.inkColor;
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const initRadius = Math.max(0.5, liveStrokeWidth / 2);
      ctx.beginPath();
      ctx.arc(sx, sy, initRadius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (e.pointerType === 'touch') {
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (e.pointerType === 'mouse') {
      if (state.inkTool === 'eraser') {
        state.isErasing = true;
        state.eraserStartStrokes = JSON.parse(JSON.stringify(state.doc.globalAnnotations || []));
        applyEraserAtScreen(e.clientX, e.clientY);
        drawEraserIndicator(e.clientX, e.clientY);
      }
    }
  };

  const onDrawCanvasPointerMove = (e) => {
    if (state.mode !== 'ipad') return;

    if (state.isErasing) {
      applyEraserAtScreen(e.clientX, e.clientY);
      drawEraserIndicator(e.clientX, e.clientY);
      return;
    }

    const isInkToolActive = state.inkTool === 'pen' || state.inkTool === 'highlighter';
    if (state.isDrawing && (e.pointerType === 'pen' || (e.pointerType === 'mouse' && isInkToolActive))) {
      if (e.cancelable) e.preventDefault();

      const rect = activeDrawCanvas.getBoundingClientRect();
      const rawEvents = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];
      const now = Date.now();

      state.lastDrawMoveTime = now;
      state.lastDrawMovePos = { x: e.clientX, y: e.clientY };

      for (let i = 0; i < rawEvents.length; i++) {
        const ev = rawEvents[i];
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
        const worldPos = state.viewport.screenToWorld(sx, sy);
        worldPos.time = now;
        worldPos.pressure = (ev.pressure && ev.pressure > 0) ? ev.pressure : 0.5;

        state.currentStrokePoints.push(worldPos);
        liveStrokePoints.push({ x: sx, y: sy, pressure: worldPos.pressure });

        if (liveStrokePoints.length >= 3) {
          const p0 = liveStrokePoints[liveStrokePoints.length - 3];
          const p1 = liveStrokePoints[liveStrokePoints.length - 2];
          const p2 = liveStrokePoints[liveStrokePoints.length - 1];

          const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
          const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

          const currentZoom = state.viewport.zoom || 1.0;
          const isHighlighter = state.inkTool === 'highlighter';

          if (isHighlighter) {
            ctx.lineWidth = Math.max(12, (state.inkWidth * 3 * currentZoom) * (0.8 + p1.pressure * 0.4));
          } else {
            ctx.lineWidth = Math.max(0.5, (state.inkWidth * currentZoom) * (0.6 + p1.pressure * 0.8));
          }

          ctx.beginPath();
          ctx.moveTo(mid1.x, mid1.y);
          ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
          ctx.stroke();

          lastMidPoint = mid2;
        } else if (liveStrokePoints.length === 2) {
          const p0 = liveStrokePoints[0];
          const p1 = liveStrokePoints[1];
          const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(mid.x, mid.y);
          ctx.stroke();
          lastMidPoint = mid;
        }
      }
      return;
    }

    if (e.pointerType === 'touch') {
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (e.pointerType === 'mouse' && state.inkTool === 'eraser' && !state.isDrawing) {
      drawEraserIndicator(e.clientX, e.clientY);
    }
  };

  const onDrawCanvasPointerUp = (e) => {
    if (state.mode !== 'ipad') return;

    if (state.isErasing) {
      finishEraserDrag();
      clearActiveDrawCanvas();
      return;
    }

    if (state.isDrawing) {
      state.isDrawing = false;
      clearActiveDrawCanvas();

      finalizeStroke({
        points: state.currentStrokePoints,
        drawStartTime: state.drawStartTime,
        lastDrawMoveTime: state.lastDrawMoveTime,
        liveStrokeWidth,
        state,
        appendStrokeToSvg,
        debouncedSave,
        showToast
      });
    }
    state.currentStrokePoints = [];
  };

  const cleanupAllTouches = (e) => {
    if (!e || !e.touches || e.touches.length === 0) {
      state.activeTouches.clear();
      isFingerPanning = false;
      lastFingerPanPos = null;
      state.touchRecognizer?.resetPinch();
    }
  };

  const blockTouchGestureDelay = (e) => {
    if (state.mode === 'ipad' && e.cancelable) {
      e.preventDefault();
    }
  };
  activeDrawCanvas.addEventListener('touchstart', blockTouchGestureDelay, { passive: false });
  activeDrawCanvas.addEventListener('touchmove', blockTouchGestureDelay, { passive: false });
  activeDrawCanvas.addEventListener('touchend', blockTouchGestureDelay, { passive: false });
  activeDrawCanvas.addEventListener('touchcancel', blockTouchGestureDelay, { passive: false });

  activeDrawCanvas.addEventListener('pointerdown', onDrawCanvasPointerDown);
  window.addEventListener('pointerdown', (e) => {
    if (state.mode === 'ipad' && e.pointerType === 'pen' && !state.isDrawing) {
      onDrawCanvasPointerDown(e);
    }
  });
  window.addEventListener('pointermove', onDrawCanvasPointerMove);
  window.addEventListener('pointerup', onDrawCanvasPointerUp);
  window.addEventListener('pointercancel', (e) => {
    if (e && e.pointerType === 'touch') {
      if (e.pointerId) state.activeTouches.delete(e.pointerId);
      if (state.activeTouches.size === 0) cleanupAllTouches(e);
      return;
    }
    onDrawCanvasPointerUp(e);
  });
  window.addEventListener('touchend', cleanupAllTouches, { passive: true });
  window.addEventListener('touchcancel', cleanupAllTouches, { passive: true });

  document.addEventListener('selectionchange', () => {
    if (state.mode === 'ipad') {
      const sel = window.getSelection ? window.getSelection() : null;
      if (sel && sel.removeAllRanges && sel.rangeCount > 0) {
        sel.removeAllRanges();
      }
    }
  });

  activeDrawCanvas.addEventListener('mouseleave', () => {
    if (state.inkTool === 'eraser') {
      ctx.clearRect(0, 0, activeDrawCanvas.width, activeDrawCanvas.height);
      finishEraserDrag();
    }
  });
}
