// Natural Kinetic Pan, Momentum Inertia & Smooth Wheel Zoom Engine

/**
 * Sets up kinetic momentum tracking and smooth requestAnimationFrame wheel/touchpad zoom.
 */
export function setupKineticPan(options) {
  const {
    state,
    container,
    updateWorldTransform,
    saveActivePageDocument,
    debouncedSave
  } = options;

  let panVelocity = { vx: 0, vy: 0 };
  let lastPanSampleTime = 0;
  let lastPanSamplePos = { x: 0, y: 0 };
  let momentumAnimFrame = null;

  function trackPanMove(clientX, clientY) {
    const now = performance.now();
    const dt = Math.max(1, now - lastPanSampleTime);
    if (dt < 120) {
      const instVx = ((clientX - lastPanSamplePos.x) / dt) * 16;
      const instVy = ((clientY - lastPanSamplePos.y) / dt) * 16;
      panVelocity.vx = panVelocity.vx * 0.35 + instVx * 0.65;
      panVelocity.vy = panVelocity.vy * 0.35 + instVy * 0.65;
    }
    lastPanSampleTime = now;
    lastPanSamplePos = { x: clientX, y: clientY };
  }

  function startMomentumPan() {
    if (momentumAnimFrame) cancelAnimationFrame(momentumAnimFrame);

    if (performance.now() - lastPanSampleTime > 80) {
      panVelocity = { vx: 0, vy: 0 };
      return;
    }

    const speed = Math.hypot(panVelocity.vx, panVelocity.vy);
    if (speed < 0.8) {
      panVelocity = { vx: 0, vy: 0 };
      return;
    }

    const maxSpeed = 40;
    if (speed > maxSpeed) {
      panVelocity.vx = (panVelocity.vx / speed) * maxSpeed;
      panVelocity.vy = (panVelocity.vy / speed) * maxSpeed;
    }

    function momentumStep() {
      panVelocity.vx *= 0.935;
      panVelocity.vy *= 0.935;

      state.viewport.pan(panVelocity.vx, panVelocity.vy);
      updateWorldTransform();

      if (Math.hypot(panVelocity.vx, panVelocity.vy) > 0.15) {
        momentumAnimFrame = requestAnimationFrame(momentumStep);
      } else {
        momentumAnimFrame = null;
        panVelocity = { vx: 0, vy: 0 };
        debouncedSave(600);
      }
    }

    momentumAnimFrame = requestAnimationFrame(momentumStep);
  }

  function stopMomentum() {
    if (momentumAnimFrame) {
      cancelAnimationFrame(momentumAnimFrame);
      momentumAnimFrame = null;
    }
    panVelocity = { vx: 0, vy: 0 };
  }

  // Natural Wheel & Touchpad Zoom / Pan with 60-120 FPS requestAnimationFrame coalescing
  let pendingWheelPanX = 0;
  let pendingWheelPanY = 0;
  let pendingWheelZoomFactor = 1.0;
  let pendingWheelCursorX = 0;
  let pendingWheelCursorY = 0;
  let hasPendingWheelZoom = false;
  let hasPendingWheelPan = false;
  let wheelRafId = null;
  let wheelSaveTimer = null;

  function flushWheelTransform() {
    wheelRafId = null;
    if (hasPendingWheelZoom) {
      state.viewport.zoomAt(pendingWheelCursorX, pendingWheelCursorY, pendingWheelZoomFactor);
      pendingWheelZoomFactor = 1.0;
      hasPendingWheelZoom = false;
    }
    if (hasPendingWheelPan) {
      state.viewport.pan(pendingWheelPanX, pendingWheelPanY);
      pendingWheelPanX = 0;
      pendingWheelPanY = 0;
      hasPendingWheelPan = false;
    }
    updateWorldTransform();
  }

  function scheduleWheelTransform() {
    if (!wheelRafId) {
      wheelRafId = requestAnimationFrame(flushWheelTransform);
    }
    if (wheelSaveTimer) clearTimeout(wheelSaveTimer);
    wheelSaveTimer = setTimeout(() => {
      saveActivePageDocument();
    }, 1000);
  }

  container.addEventListener('wheel', (e) => {
    if (state.mode === 'ipad') {
      e.preventDefault();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomSensitivity = e.deltaMode === 1 ? 0.04 : 0.0065;
      const factor = Math.min(1.38, Math.max(0.72, Math.exp(-e.deltaY * zoomSensitivity)));

      pendingWheelZoomFactor *= factor;
      pendingWheelCursorX = cursorX;
      pendingWheelCursorY = cursorY;
      hasPendingWheelZoom = true;
      scheduleWheelTransform();
      return;
    }

    if (e.shiftKey) {
      e.preventDefault();
      const panSpeed = e.deltaMode === 1 ? 24 : 1.0;
      pendingWheelPanX += -e.deltaY * panSpeed;
      hasPendingWheelPan = true;
      scheduleWheelTransform();
      return;
    }

    const scrollEl = e.target.closest ? e.target.closest('.pdf-pages-container, .note-container-body, textarea') : null;
    if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight) {
      const atTop = scrollEl.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = Math.ceil(scrollEl.scrollTop + scrollEl.clientHeight) >= scrollEl.scrollHeight && e.deltaY > 0;
      if (!atTop && !atBottom) {
        return;
      }
    }

    e.preventDefault();
    const panSpeed = e.deltaMode === 1 ? 24 : 1.0;
    pendingWheelPanX += -e.deltaX * panSpeed;
    pendingWheelPanY += -e.deltaY * panSpeed;
    hasPendingWheelPan = true;
    scheduleWheelTransform();
  }, { passive: false });

  // Suppress browser default page scrolling during multi-touch gestures on container
  container.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length >= 2 && e.cancelable) e.preventDefault();
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length >= 2 && e.cancelable) e.preventDefault();
  }, { passive: false });

  return { trackPanMove, startMomentumPan, stopMomentum };
}
