// Interactive Spatial Scrollbars & Edge Auto-Scroll Controller

import { getCanvasContentBounds, clampViewportBounds } from './viewport_bounds.js';

let isDraggingScrollbar = false;
let activeDragRepositionCallback = null;
let scrollActivityTimer = null;

function indicateScrollActivity(sbH, sbV) {
  if (sbH) sbH.classList.add('scrolling');
  if (sbV) sbV.classList.add('scrolling');
  if (scrollActivityTimer) clearTimeout(scrollActivityTimer);
  scrollActivityTimer = setTimeout(() => {
    if (sbH) sbH.classList.remove('scrolling');
    if (sbV) sbV.classList.remove('scrolling');
  }, 1200);
}

export function registerActiveDragCallback(cb) {
  activeDragRepositionCallback = cb;
}

export function unregisterActiveDragCallback() {
  activeDragRepositionCallback = null;
}

export function updateScrollbars({ state, container }) {
  if (isDraggingScrollbar) return;
  const sbH = document.getElementById('canvas-scrollbar-h');
  const sbV = document.getElementById('canvas-scrollbar-v');
  const thumbH = document.getElementById('canvas-scroll-thumb-h');
  const thumbV = document.getElementById('canvas-scroll-thumb-v');
  if (!sbH || !sbV || !thumbH || !thumbV || !container) return;

  indicateScrollActivity(sbH, sbV);

  const bounds = getCanvasContentBounds(state.doc);
  const containerW = container.offsetWidth || window.innerWidth;
  const containerH = container.offsetHeight || window.innerHeight;

  // Horizontal scrollbar
  const trackW = sbH.offsetWidth || 200;
  const visibleW = containerW / state.viewport.zoom;
  const thumbW = Math.max(36, Math.min(trackW, Math.round((visibleW / bounds.width) * trackW)));
  thumbH.style.width = `${thumbW}px`;

  const maxScrollX = Math.max(1, bounds.width * state.viewport.zoom - containerW + 40);
  const currentScrollX = Math.max(0, 40 - state.viewport.x);
  const scrollRatioX = Math.min(1, Math.max(0, currentScrollX / maxScrollX));
  thumbH.style.left = `${Math.round(scrollRatioX * (trackW - thumbW))}px`;

  // Vertical scrollbar: dynamic total space based on content bounds and current scroll
  const currentWorldBottom = (containerH - state.viewport.y) / state.viewport.zoom;
  const totalWorldH = Math.max(bounds.height, currentWorldBottom + 800);
  const trackH = sbV.offsetHeight || 200;
  const visibleH = containerH / state.viewport.zoom;
  const thumbHHeight = Math.max(36, Math.min(trackH, Math.round((visibleH / totalWorldH) * trackH)));
  thumbV.style.height = `${thumbHHeight}px`;

  const maxScrollY = Math.max(1, totalWorldH * state.viewport.zoom - containerH + 40);
  const currentScrollY = Math.max(0, 40 - state.viewport.y);
  const scrollRatioY = Math.min(1, Math.max(0, currentScrollY / maxScrollY));
  thumbV.style.top = `${Math.round(scrollRatioY * (trackH - thumbHHeight))}px`;
}

export function setupScrollbarDragging({ state, container, world, onTransformChange, onSave }) {
  const sbH = document.getElementById('canvas-scrollbar-h');
  const sbV = document.getElementById('canvas-scrollbar-v');
  const thumbH = document.getElementById('canvas-scroll-thumb-h');
  const thumbV = document.getElementById('canvas-scroll-thumb-v');
  if (!sbH || !sbV || !thumbH || !thumbV || !container) return;

  [sbH, sbV].forEach(el => {
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('mousedown', (e) => e.stopPropagation());
  });

  const applyWorldTransform = () => {
    clampViewportBounds({ viewport: state.viewport, doc: state.doc, containerWidth: container.offsetWidth || window.innerWidth });
    if (world) {
      world.style.transform = `translate3d(${state.viewport.x}px, ${state.viewport.y}px, 0px) scale(${state.viewport.zoom})`;
    }
    if (typeof onTransformChange === 'function') onTransformChange();
  };

  // Horizontal track click
  sbH.addEventListener('pointerdown', (e) => {
    if (sbH.classList.contains('locked') || e.target === thumbH) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = sbH.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const bounds = getCanvasContentBounds(state.doc);
    const containerW = container.offsetWidth || window.innerWidth;
    const trackW = sbH.offsetWidth || 200;
    const thumbW = thumbH.offsetWidth || 36;
    const maxScrollX = Math.max(1, bounds.width * state.viewport.zoom - containerW + 40);

    const targetLeft = Math.max(0, Math.min(trackW - thumbW, clickX - thumbW / 2));
    const ratio = targetLeft / Math.max(1, trackW - thumbW);
    state.viewport.x = 40 - ratio * maxScrollX;
    applyWorldTransform();
    updateScrollbars({ state, container });
    if (onSave) onSave();
  });

  // Vertical track click
  sbV.addEventListener('pointerdown', (e) => {
    if (sbV.classList.contains('locked') || e.target === thumbV) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = sbV.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const bounds = getCanvasContentBounds(state.doc);
    const containerH = container.offsetHeight || window.innerHeight;
    const trackH = sbV.offsetHeight || 200;
    const thumbHHeight = thumbV.offsetHeight || 36;
    const currentWorldBottom = (containerH - state.viewport.y) / state.viewport.zoom;
    const totalWorldH = Math.max(bounds.height, currentWorldBottom + 800);
    const maxScrollY = Math.max(1, totalWorldH * state.viewport.zoom - containerH + 40);

    const targetTop = Math.max(0, Math.min(trackH - thumbHHeight, clickY - thumbHHeight / 2));
    const ratio = targetTop / Math.max(1, trackH - thumbHHeight);
    state.viewport.y = 40 - ratio * maxScrollY;
    applyWorldTransform();
    updateScrollbars({ state, container });
    if (onSave) onSave();
  });

  // Horizontal thumb drag
  thumbH.addEventListener('pointerdown', (e) => {
    if (sbH.classList.contains('locked')) return;
    e.stopPropagation();
    e.preventDefault();
    isDraggingScrollbar = true;
    thumbH.setPointerCapture(e.pointerId);
    thumbH.classList.add('active');

    const startX = e.clientX;
    const initialThumbLeft = thumbH.offsetLeft;
    const trackW = sbH.offsetWidth || 200;
    const thumbW = thumbH.offsetWidth || 36;
    const bounds = getCanvasContentBounds(state.doc);
    const containerW = container.offsetWidth || window.innerWidth;
    const maxScrollX = Math.max(1, bounds.width * state.viewport.zoom - containerW + 40);

    const onPointerMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const newLeft = Math.max(0, Math.min(trackW - thumbW, initialThumbLeft + dx));
      thumbH.style.left = `${newLeft}px`;
      const ratio = newLeft / Math.max(1, trackW - thumbW);
      state.viewport.x = 40 - ratio * maxScrollX;
      applyWorldTransform();
    };

    const onPointerUp = (upEvt) => {
      isDraggingScrollbar = false;
      thumbH.classList.remove('active');
      try { thumbH.releasePointerCapture(upEvt.pointerId); } catch (_) {}
      thumbH.removeEventListener('pointermove', onPointerMove);
      thumbH.removeEventListener('pointerup', onPointerUp);
      thumbH.removeEventListener('pointercancel', onPointerUp);
      updateScrollbars({ state, container });
      if (onSave) onSave();
    };

    thumbH.addEventListener('pointermove', onPointerMove);
    thumbH.addEventListener('pointerup', onPointerUp);
    thumbH.addEventListener('pointercancel', onPointerUp);
  });

  // Vertical thumb drag
  thumbV.addEventListener('pointerdown', (e) => {
    if (sbV.classList.contains('locked')) return;
    e.stopPropagation();
    e.preventDefault();
    isDraggingScrollbar = true;
    thumbV.setPointerCapture(e.pointerId);
    thumbV.classList.add('active');

    const startY = e.clientY;
    const initialThumbTop = thumbV.offsetTop;
    const trackH = sbV.offsetHeight || 200;
    const thumbHHeight = thumbV.offsetHeight || 36;
    const bounds = getCanvasContentBounds(state.doc);
    const containerH = container.offsetHeight || window.innerHeight;
    const currentWorldBottom = (containerH - state.viewport.y) / state.viewport.zoom;
    const dragTotalWorldH = Math.max(bounds.height, currentWorldBottom + 800);
    const maxScrollY = Math.max(1, dragTotalWorldH * state.viewport.zoom - containerH + 40);

    const onPointerMove = (moveEvt) => {
      const dy = moveEvt.clientY - startY;
      const newTop = Math.max(0, Math.min(trackH - thumbHHeight, initialThumbTop + dy));
      thumbV.style.top = `${newTop}px`;
      const ratio = newTop / Math.max(1, trackH - thumbHHeight);
      state.viewport.y = 40 - ratio * maxScrollY;
      applyWorldTransform();
    };

    const onPointerUp = (upEvt) => {
      isDraggingScrollbar = false;
      thumbV.classList.remove('active');
      try { thumbV.releasePointerCapture(upEvt.pointerId); } catch (_) {}
      thumbV.removeEventListener('pointermove', onPointerMove);
      thumbV.removeEventListener('pointerup', onPointerUp);
      thumbV.removeEventListener('pointercancel', onPointerUp);
      updateScrollbars({ state, container });
      if (onSave) onSave();
    };

    thumbV.addEventListener('pointermove', onPointerMove);
    thumbV.addEventListener('pointerup', onPointerUp);
    thumbV.addEventListener('pointercancel', onPointerUp);
  });

  window.addEventListener('resize', () => updateScrollbars({ state, container }));
}

// Edge auto-scrolling with live block synchronization
let autoScrollFrame = null;
let autoScrollVelocity = { vx: 0, vy: 0 };

export function setupEdgeAutoScroll({ state, container, world, onTransformChange }) {
  const stepAutoScroll = () => {
    if (autoScrollVelocity.vx !== 0 || autoScrollVelocity.vy !== 0) {
      state.viewport.pan(autoScrollVelocity.vx, autoScrollVelocity.vy);
      clampViewportBounds({ viewport: state.viewport, doc: state.doc, containerWidth: container.offsetWidth || window.innerWidth });

      if (world) {
        world.style.transform = `translate3d(${state.viewport.x}px, ${state.viewport.y}px, 0px) scale(${state.viewport.zoom})`;
      }

      // Synchronize actively dragged block so it never drops behind
      if (typeof activeDragRepositionCallback === 'function') {
        activeDragRepositionCallback(-autoScrollVelocity.vx / state.viewport.zoom, -autoScrollVelocity.vy / state.viewport.zoom);
      }

      updateScrollbars({ state, container });
      if (typeof onTransformChange === 'function') onTransformChange();
      autoScrollFrame = requestAnimationFrame(stepAutoScroll);
    } else {
      autoScrollFrame = null;
    }
  };

  window.addEventListener('pointermove', (e) => {
    if (document.body.getAttribute('data-mode') === 'ipad') {
      autoScrollVelocity = { vx: 0, vy: 0 };
      return;
    }

    if (e.buttons !== 1) {
      autoScrollVelocity = { vx: 0, vy: 0 };
      return;
    }

    const rect = container.getBoundingClientRect();
    const edgeMargin = 60;
    const maxSpeed = 16;

    let vx = 0;
    let vy = 0;

    if (e.clientX > rect.right - edgeMargin) {
      const p = Math.min(edgeMargin, e.clientX - (rect.right - edgeMargin));
      vx = -Math.round((p / edgeMargin) * maxSpeed);
    } else if (e.clientX < rect.left + edgeMargin) {
      const p = Math.min(edgeMargin, (rect.left + edgeMargin) - e.clientX);
      vx = Math.round((p / edgeMargin) * maxSpeed);
    }

    if (e.clientY > rect.bottom - edgeMargin) {
      const p = Math.min(edgeMargin, e.clientY - (rect.bottom - edgeMargin));
      vy = -Math.round((p / edgeMargin) * maxSpeed);
    } else if (e.clientY < rect.top + edgeMargin) {
      const p = Math.min(edgeMargin, (rect.top + edgeMargin) - e.clientY);
      vy = Math.round((p / edgeMargin) * maxSpeed);
    }

    autoScrollVelocity = { vx, vy };
    if ((vx !== 0 || vy !== 0) && !autoScrollFrame) {
      autoScrollFrame = requestAnimationFrame(stepAutoScroll);
    }
  });

  window.addEventListener('pointerup', () => {
    autoScrollVelocity = { vx: 0, vy: 0 };
  });
}
