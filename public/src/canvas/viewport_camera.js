// 2D Infinite Canvas Viewport Camera, Smooth Glide Animation & Fit-to-Content Controller
import { clampViewportBounds } from './viewport_bounds.js';
import { updateScrollbars } from './scrollbar_controller.js';

export function createViewportCamera({
  state,
  container,
  world,
  zoomIndicator,
  getStopMomentum = () => () => {},
  onTransformChanged = () => {}
}) {
  let viewportAnimFrame = null;
  let lastRenderedZoom = -1;

  function applyViewportClamping() {
    if (!container) return;
    clampViewportBounds({
      viewport: state.viewport,
      doc: state.doc,
      containerWidth: container.offsetWidth || window.innerWidth
    });
  }

  function refreshScrollbars() {
    updateScrollbars({ state, container });
  }

  function updateWorldTransform() {
    if (!world) return;
    applyViewportClamping();
    world.style.transform = `translate3d(${state.viewport.x}px, ${state.viewport.y}px, 0px) scale(${state.viewport.zoom})`;

    const currentZoomPercent = Math.round(state.viewport.zoom * 100);
    if (currentZoomPercent !== lastRenderedZoom) {
      lastRenderedZoom = currentZoomPercent;
      if (zoomIndicator) zoomIndicator.textContent = currentZoomPercent + '%';
    }

    refreshScrollbars();
    onTransformChanged();
  }

  function animateViewport(targetX, targetY, targetZoom, duration = 320, onComplete = () => {}) {
    const stopMomentum = getStopMomentum();
    if (typeof stopMomentum === 'function') stopMomentum();
    if (viewportAnimFrame) cancelAnimationFrame(viewportAnimFrame);

    const startX = state.viewport.x;
    const startY = state.viewport.y;
    const startZoom = state.viewport.zoom;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);

      state.viewport.x = startX + (targetX - startX) * ease;
      state.viewport.y = startY + (targetY - startY) * ease;
      state.viewport.zoom = startZoom + (targetZoom - startZoom) * ease;

      updateWorldTransform();

      if (progress < 1) {
        viewportAnimFrame = requestAnimationFrame(step);
      } else {
        viewportAnimFrame = null;
        onComplete();
      }
    }

    viewportAnimFrame = requestAnimationFrame(step);
  }

  function fitAllContent(animate = true, onComplete = () => {}) {
    if (!state.doc || !container) return;
    const blocks = state.doc.blocks || [];
    const strokes = state.doc.globalAnnotations || [];

    if (blocks.length === 0 && strokes.length === 0) {
      if (animate) animateViewport(40, 40, 1.0, 320, onComplete);
      else {
        state.viewport.x = 40;
        state.viewport.y = 40;
        state.viewport.zoom = 1.0;
        updateWorldTransform();
        onComplete();
      }
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    blocks.forEach(b => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + (b.width || 520));
      maxY = Math.max(maxY, b.y + (b.height || 360));
    });

    strokes.forEach(s => {
      if (s.points) {
        s.points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      }
    });

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const containerW = container.clientWidth || window.innerWidth;
    const containerH = container.clientHeight || window.innerHeight;

    const paddingX = Math.max(60, containerW * 0.1);
    const paddingY = Math.max(60, containerH * 0.1);
    const availW = containerW - paddingX * 2;
    const availH = containerH - paddingY * 2;

    const targetZoom = Math.min(2.0, Math.max(0.3, Math.min(availW / contentW, availH / contentH)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const targetX = (containerW / 2) - centerX * targetZoom;
    const targetY = (containerH / 2) - centerY * targetZoom;

    if (animate) {
      animateViewport(targetX, targetY, targetZoom, 320, onComplete);
    } else {
      state.viewport.x = targetX;
      state.viewport.y = targetY;
      state.viewport.zoom = targetZoom;
      updateWorldTransform();
      onComplete();
    }
  }

  return {
    updateWorldTransform,
    animateViewport,
    fitAllContent,
    applyViewportClamping,
    refreshScrollbars
  };
}
