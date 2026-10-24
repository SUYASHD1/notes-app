// In-Note Contained Handwriting Canvas Item with Vector SVG, Eraser & Auto-Shapes
import { StrokeRenderer } from '../canvas/stroke_renderer.js';
import { ShapeDetector } from '../canvas/shape_detector.js';
import { ShapeType } from '../core/types.js';
import { EraserEngine } from '../canvas/eraser_engine.js';

export function renderSketchItem(parentEl, item, containerBlock, deps = {}) {
  const state = deps.state || window.state;
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const showToast = deps.showToast || window.showToast;

  const sketchCard = document.createElement('div');
  sketchCard.className = 'note-item-sketch-card';

  const defaultHeight = typeof item.height === 'number' && item.height >= 100 ? item.height : 260;
  item.height = defaultHeight;
  if (!Array.isArray(item.strokes)) {
    item.strokes = [];
  }

  // Header with quick controls
  const header = document.createElement('div');
  header.className = 'note-sketch-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px;">
      <span style="font-size:12px; font-weight:600; color:#475569;">✍ Handwriting Canvas</span>
      <span class="badge" style="font-size:10px;">${item.strokes.length} Stroke${item.strokes.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px;">
      <button class="mini-tool-btn btn-sketch-clear" title="Clear all strokes in this canvas">🗑 Clear</button>
    </div>
  `;
  sketchCard.appendChild(header);

  // Canvas Stage Wrapper with fixed boundaries
  const stage = document.createElement('div');
  stage.className = 'note-sketch-stage';
  stage.style.height = `${item.height}px`;

  // SVG Layer for permanent crisp vector stroke display
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'note-sketch-svg');
  stage.appendChild(svg);

  // Active interaction canvas for in-progress drawing / erasing
  const canvas = document.createElement('canvas');
  canvas.className = 'note-sketch-canvas';
  stage.appendChild(canvas);

  // Bottom edge height resize handle
  const resizeBar = document.createElement('div');
  resizeBar.className = 'note-sketch-resize-bar';
  resizeBar.title = 'Drag down or up to resize handwriting canvas height';
  resizeBar.innerHTML = `<div class="resize-grip-line"></div>`;

  sketchCard.appendChild(stage);
  sketchCard.appendChild(resizeBar);
  parentEl.appendChild(sketchCard);

  // Render SVG strokes
  const renderStrokesToSvg = () => {
    svg.innerHTML = '';
    item.strokes.forEach(stroke => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', StrokeRenderer.pointsToSvgPath(stroke.points));
      path.setAttribute('stroke', stroke.color || '#0f172a');
      path.setAttribute('stroke-width', stroke.width || 3);
      path.setAttribute('fill', stroke.shapeType === ShapeType.CIRCLE || stroke.shapeType === ShapeType.RECTANGLE || stroke.shapeType === ShapeType.TRIANGLE ? 'rgba(99, 102, 241, 0.05)' : 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    });

    const badge = header.querySelector('.badge');
    if (badge) {
      badge.textContent = `${item.strokes.length} Stroke${item.strokes.length !== 1 ? 's' : ''}`;
    }
  };

  renderStrokesToSvg();

  // Resize Canvas buffer to match stage width/height
  const updateCanvasDimensions = () => {
    const rect = stage.getBoundingClientRect();
    const w = Math.round(rect.width || stage.offsetWidth || 400);
    const h = item.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  requestAnimationFrame(updateCanvasDimensions);

  // Clear button handler
  header.querySelector('.btn-sketch-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.strokes.length === 0) return;
    item.strokes = [];
    renderStrokesToSvg();
    if (saveActivePageDocument) saveActivePageDocument();
    if (showToast) showToast('🗑 Cleared handwriting canvas');
  });

  // Local drawing & erasing interaction inside this box
  let isLocalDrawing = false;
  let isLocalErasing = false;
  let localDrawStartTime = 0;
  let localPoints = [];
  const localCtx = canvas.getContext('2d');

  const applyLocalEraser = (lx, ly) => {
    const radius = state?.eraserSize || 24;
    if (state?.eraserMode === 'full') {
      const res = EraserEngine.eraseFullStrokes(item.strokes, lx, ly, radius);
      if (res.removedStrokes.length > 0) {
        item.strokes = res.remainingStrokes;
        renderStrokesToSvg();
      }
    } else {
      const res = EraserEngine.erasePartialStrokes(item.strokes, lx, ly, radius);
      if (res.modified) {
        item.strokes = res.updatedStrokes;
        renderStrokesToSvg();
      }
    }
  };

  const drawLocalEraserCursor = (lx, ly) => {
    localCtx.clearRect(0, 0, canvas.width, canvas.height);
    localCtx.save();
    localCtx.beginPath();
    localCtx.arc(lx, ly, state?.eraserSize || 24, 0, Math.PI * 2);
    localCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    localCtx.lineWidth = 1.5;
    localCtx.stroke();
    localCtx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    localCtx.fill();
    localCtx.restore();
  };

  const onLocalPointerDown = (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    try {
      if (canvas.setPointerCapture && e.pointerId !== undefined) {
        canvas.setPointerCapture(e.pointerId);
      }
    } catch (_) {}
    updateCanvasDimensions();

    const rect = canvas.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    if (state?.inkTool === 'eraser') {
      isLocalErasing = true;
      applyLocalEraser(lx, ly);
      drawLocalEraserCursor(lx, ly);
      return;
    }

    isLocalDrawing = true;
    localDrawStartTime = Date.now();
    const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.6;
    localPoints = [{ x: lx, y: ly, time: Date.now(), pressure }];

    localCtx.strokeStyle = state?.inkColor || '#0f172a';
    localCtx.lineWidth = state?.inkWidth || 3;
    localCtx.lineCap = 'round';
    localCtx.lineJoin = 'round';
    localCtx.beginPath();
    localCtx.moveTo(lx, ly);
  };

  const onLocalPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    if (state?.inkTool === 'eraser') {
      drawLocalEraserCursor(lx, ly);
      if (isLocalErasing) {
        applyLocalEraser(lx, ly);
      }
      return;
    }

    if (!isLocalDrawing) return;
    const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 0.6;
    localPoints.push({ x: lx, y: ly, time: Date.now(), pressure });
    localCtx.lineTo(lx, ly);
    localCtx.stroke();
  };

  const finishLocalInteraction = (e) => {
    if (e && e.pointerId !== undefined) {
      try {
        if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    }

    if (isLocalErasing) {
      isLocalErasing = false;
      localCtx.clearRect(0, 0, canvas.width, canvas.height);
      if (saveActivePageDocument) saveActivePageDocument();
      return;
    }

    if (!isLocalDrawing) return;
    isLocalDrawing = false;
    localCtx.clearRect(0, 0, canvas.width, canvas.height);

    if (localPoints.length > 2) {
      const holdDuration = Date.now() - localDrawStartTime;
      const shapeResult = ShapeDetector.detectShape(localPoints, holdDuration);

      let finalPoints = localPoints;
      let shapeType = ShapeType.NONE;

      if (shapeResult.detected) {
        shapeType = shapeResult.type;
        if (shapeResult.type === ShapeType.LINE) {
          finalPoints = [shapeResult.geometry.start, shapeResult.geometry.end];
          if (showToast) showToast('📐 Snapped to Straight Line');
        } else if (shapeResult.type === ShapeType.CIRCLE) {
          const { cx, cy, radius } = shapeResult.geometry;
          finalPoints = [];
          for (let i = 0; i <= 36; i++) {
            const a = (i / 36) * 2 * Math.PI;
            finalPoints.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
          }
          if (showToast) showToast('⭕ Snapped to Circle');
        } else if (shapeResult.type === ShapeType.RECTANGLE) {
          const { x, y, width, height } = shapeResult.geometry;
          finalPoints = [
            { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }
          ];
          if (showToast) showToast('▭ Snapped to Rectangle');
        } else if (shapeResult.type === ShapeType.TRIANGLE) {
          const { p1, p2, p3 } = shapeResult.geometry;
          finalPoints = [p1, p2, p3, p1];
          if (showToast) showToast('▲ Snapped to Triangle');
        }
      } else {
        finalPoints = StrokeRenderer.smoothPoints(localPoints);
      }

      item.strokes.push({
        id: 'stroke_' + Math.random().toString(36).substr(2, 9),
        color: state?.inkColor || '#0f172a',
        width: state?.inkWidth || 3,
        points: finalPoints,
        shapeType
      });

      renderStrokesToSvg();
      if (saveActivePageDocument) saveActivePageDocument();
    }
    localPoints = [];
  };

  canvas.addEventListener('pointerdown', onLocalPointerDown);
  canvas.addEventListener('pointermove', onLocalPointerMove);
  canvas.addEventListener('pointerup', finishLocalInteraction);
  canvas.addEventListener('pointercancel', finishLocalInteraction);
  canvas.addEventListener('mousedown', onLocalPointerDown);
  canvas.addEventListener('mousemove', onLocalPointerMove);
  canvas.addEventListener('mouseup', finishLocalInteraction);

  // Resizing the height of the handwriting canvas via bottom drag bar
  const onResizePointerDown = (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    try {
      if (resizeBar.setPointerCapture && e.pointerId !== undefined) {
        resizeBar.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    const startY = e.clientY;
    const origHeight = item.height;

    const onMove = (me) => {
      const zoom = state?.viewport ? state.viewport.zoom : 1;
      const dy = (me.clientY - startY) / zoom;
      const newHeight = Math.max(120, Math.min(1200, Math.round(origHeight + dy)));
      item.height = newHeight;
      stage.style.height = `${newHeight}px`;
      canvas.height = newHeight;
    };

    const onUp = (ue) => {
      try {
        if (ue && ue.pointerId !== undefined && resizeBar.hasPointerCapture && resizeBar.hasPointerCapture(ue.pointerId)) {
          resizeBar.releasePointerCapture(ue.pointerId);
        }
      } catch (_) {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (saveActivePageDocument) saveActivePageDocument();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  resizeBar.addEventListener('pointerdown', onResizePointerDown);
  resizeBar.addEventListener('mousedown', onResizePointerDown);
}
