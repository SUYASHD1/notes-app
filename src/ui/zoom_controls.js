/**
 * Sets up canvas zoom flyout, fit-to-content, 100% reset, and zoom in/out buttons.
 */
export function setupZoomControls({
  container,
  state,
  fitAllContent,
  animateViewport,
  showToast,
  zoomIndicator
}) {
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
