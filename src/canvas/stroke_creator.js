import { ShapeDetector } from './shape_detector.js';
import { ShapeType } from '../core/types.js';
import { AddStrokeCommand } from '../core/history.js';


/**
 * Finalizes drawn inking stroke, checks shape snapping, and appends to document.
 */
export function finalizeStroke(options) {
  const {
    points,
    drawStartTime,
    lastDrawMoveTime,
    liveStrokeWidth,
    state,
    appendStrokeToSvg,
    debouncedSave,
    showToast
  } = options;

  if (!points || points.length === 0) return;

  const duration = Date.now() - drawStartTime;
  const pauseDuration = Date.now() - (lastDrawMoveTime || drawStartTime);
  const isEligibleForShapeSnap = duration >= 400 && pauseDuration >= 180;

  let shapeResult = null;
  if (isEligibleForShapeSnap && points.length >= 6) {
    shapeResult = ShapeDetector.detect(points);
  }

  let finalPoints = points;
  let shapeType = null;

  if (shapeResult && shapeResult.isShape) {
    shapeType = shapeResult.type;
    if (shapeResult.type === ShapeType.LINE) {
      const { x1, y1, x2, y2 } = shapeResult.geometry;
      finalPoints = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      showToast('📏 Snapped to Straight Line');
    } else if (shapeResult.type === ShapeType.CIRCLE) {
      const { cx, cy, r } = shapeResult.geometry;
      const circlePts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += Math.PI / 16) {
        circlePts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      finalPoints = circlePts;
      showToast('⭕ Snapped to Circle');
    } else if (shapeResult.type === ShapeType.RECTANGLE) {
      const { x, y, width, height } = shapeResult.geometry;
      finalPoints = [
        { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }
      ];
      showToast('▭ Snapped to Rectangle');
    } else if (shapeResult.type === ShapeType.TRIANGLE) {
      const { p1, p2, p3 } = shapeResult.geometry;
      finalPoints = [p1, p2, p3, p1];
      showToast('▲ Snapped to Triangle');
    }
  } else if (points.length === 1) {
    // Single tap dot for 'i' / period: preserve single point coordinate
    finalPoints = [{ x: points[0].x, y: points[0].y, pressure: points[0].pressure || 0.5, time: points[0].time || Date.now() }];
  } else {
    // Natural handwriting fidelity: use sampled points directly with Bézier spline interpolation
    finalPoints = points;
  }

  // Accurate world-space stroke width calculation
  const currentZoom = state.viewport.zoom || 1.0;
  const isHighlighter = state.inkTool === 'highlighter';
  const pointPressure = points[0]?.pressure || 0.5;
  const calculatedDotWidth = state.inkWidth * (0.6 + pointPressure * 0.8);
  const worldWidth = isHighlighter
    ? Math.max(12, Math.round(((state.inkWidth * 3 * currentZoom) / currentZoom) * 100) / 100)
    : Math.max(0.5, (liveStrokeWidth ? (liveStrokeWidth / currentZoom) : calculatedDotWidth));

  const strokeColor = isHighlighter
    ? (state.inkColor === '#0f172a' ? '#facc15' : state.inkColor)
    : state.inkColor;

  const stroke = {
    id: 'stroke_' + Math.random().toString(36).substr(2, 9),
    color: strokeColor,
    width: Math.round(worldWidth * 100) / 100,
    points: finalPoints,
    shapeType,
    tool: isHighlighter ? 'highlighter' : 'pen',
    opacity: isHighlighter ? 0.45 : 1.0
  };

  state.history.execute(new AddStrokeCommand(state.doc, stroke));
  appendStrokeToSvg(stroke);
  debouncedSave(600);
}
