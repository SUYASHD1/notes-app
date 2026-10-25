// Layout Switcher, Floating Mode Puck, and Navigate vs Ink Mode Controller

export function setMode({
  state,
  mode,
  silent = false,
  activeDrawCanvas,
  clearActiveDrawCanvas,
  resizeActiveDrawCanvas,
  showToast
}) {
  state.mode = mode;
  document.body.setAttribute('data-mode', mode);

  const winBtn = document.getElementById('btn-mode-win');
  const ipadBtn = document.getElementById('btn-mode-ipad');
  const textGroup = document.getElementById('ribbon-text-group');
  const inkGroup = document.getElementById('ribbon-ink-group');
  const insertCluster = document.querySelector('.insert-cluster');
  const selCluster = document.querySelector('.ml-auto');
  const puck = document.getElementById('floating-mode-puck');
  const puckIcon = document.getElementById('puck-icon');
  const puckLabel = document.getElementById('puck-label');

  if (mode === 'windows') {
    // Navigate Mode (Keyboard / Touch Navigation)
    winBtn?.classList.add('active');
    ipadBtn?.classList.remove('active');
    activeDrawCanvas?.classList.add('hidden');
    if (clearActiveDrawCanvas) clearActiveDrawCanvas();
    document.querySelectorAll('.note-item-text').forEach(t => t.contentEditable = 'true');
    const ribbonTabsNav = document.querySelector('.ribbon-tabs-nav');
    if (ribbonTabsNav) ribbonTabsNav.style.display = 'flex';
    if (inkGroup) inkGroup.style.display = 'none';
    const ribbonBar = document.getElementById('ribbon-bar');
    const curTab = ribbonBar?.getAttribute('data-tab') || 'home';
    if (curTab === 'home') {
      if (textGroup) textGroup.style.display = 'flex';
      if (insertCluster) insertCluster.style.display = 'none';
    } else {
      if (textGroup) textGroup.style.display = 'none';
      if (insertCluster) insertCluster.style.display = 'flex';
    }
    if (selCluster) selCluster.style.display = 'flex';

    if (puck) {
      puck.classList.remove('mode-ink');
      puck.classList.add('mode-navigate');
      if (puckIcon) puckIcon.textContent = '✋';
      if (puckLabel) puckLabel.textContent = 'Navigate';
    }
    // Unlock spatial scrollbars in navigate mode
    document.querySelectorAll('.canvas-scrollbar').forEach(sb => sb.classList.remove('locked'));
    if (!silent && showToast) showToast('💻 Navigate Mode: Smooth Touch Pan, Zoom & Typing Active');
  } else {
    // Ink Mode (Apple Pencil & Stylus writing)
    ipadBtn?.classList.add('active');
    winBtn?.classList.remove('active');
    activeDrawCanvas?.classList.remove('hidden');
    if (resizeActiveDrawCanvas) resizeActiveDrawCanvas();

    // Reset selections so user never accidentally drags a note box while handwriting
    state.selectedBlockIds.clear();
    state.activeContainerId = null;
    document.querySelectorAll('.universal-note-container, .canvas-block').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.note-item-text').forEach(t => t.contentEditable = 'false');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (window.getSelection) window.getSelection().removeAllRanges();
    document.getElementById('zoom-flyout')?.classList.add('hidden');

    // Strictly lock scrollbars in ink mode so stylus or hand never triggers scrolling
    document.querySelectorAll('.canvas-scrollbar').forEach(sb => sb.classList.add('locked'));

    const ribbonTabsNav = document.querySelector('.ribbon-tabs-nav');
    if (ribbonTabsNav) ribbonTabsNav.style.display = 'none';
    if (textGroup) textGroup.style.display = 'none';
    if (insertCluster) insertCluster.style.display = 'none';
    if (inkGroup) inkGroup.style.display = 'flex';
    if (selCluster) selCluster.style.display = 'none';

    if (puck) {
      puck.classList.remove('mode-navigate');
      puck.classList.add('mode-ink');
      if (puckIcon) puckIcon.textContent = '✏️';
      if (puckLabel) puckLabel.textContent = 'Ink Mode';
    }
    if (!silent && showToast) showToast('✏️ Ink Mode: Dedicated Apple Pencil Active');
  }
}

export function setupFloatingModePuck({ state, onToggleMode }) {
  const puck = document.getElementById('floating-mode-puck');
  if (!puck) return;

  // 1. Check user preference from storage & visual settings
  const isPuckVisible = localStorage.getItem('notes_show_mode_puck') !== 'false';
  puck.style.display = isPuckVisible ? 'flex' : 'none';

  // 2. Restore saved position & dock state anywhere on left/right/edges
  try {
    const saved = JSON.parse(localStorage.getItem('notes_puck_pos') || 'null');
    if (saved && typeof saved.y === 'number') {
      const maxY = Math.max(50, window.innerHeight - 50);
      const clampedY = Math.min(maxY, Math.max(50, saved.y));
      puck.style.top = `${clampedY}px`;
      puck.style.bottom = 'auto';

      if (saved.docked === 'left') {
        puck.classList.add('docked-left');
        puck.classList.remove('docked-right');
        puck.style.left = '0px';
        puck.style.right = 'auto';
      } else if (saved.docked === 'right') {
        puck.classList.add('docked-right');
        puck.classList.remove('docked-left');
        puck.style.left = 'auto';
        puck.style.right = '0px';
      } else if (typeof saved.x === 'number') {
        const maxX = Math.max(10, window.innerWidth - 130);
        const clampedX = Math.min(maxX, Math.max(10, saved.x));
        puck.style.left = `${clampedX}px`;
        puck.style.right = 'auto';
      }
    }
  } catch (_) {}

  let isDraggingPuck = false;
  let hasMoved = false;
  let puckStartPointer = { x: 0, y: 0 };
  let puckStartRect = { left: 0, top: 0 };

  const onPuckPointerDown = (e) => {
    e.stopPropagation();
    isDraggingPuck = true;
    hasMoved = false;
    puckStartPointer = { x: e.clientX, y: e.clientY };
    const r = puck.getBoundingClientRect();
    puckStartRect = { left: r.left, top: r.top };
    puck.classList.add('dragging');
    try { puck.setPointerCapture(e.pointerId); } catch (_) {}
  };

  const onPuckPointerMove = (e) => {
    if (!isDraggingPuck) return;
    e.stopPropagation();
    const dx = e.clientX - puckStartPointer.x;
    const dy = e.clientY - puckStartPointer.y;
    if (Math.hypot(dx, dy) > 5) {
      if (!hasMoved) {
        puck.classList.remove('docked-left', 'docked-right');
      }
      hasMoved = true;
    }

    let newX = puckStartRect.left + dx;
    let newY = puckStartRect.top + dy;

    // Clamp inside window boundaries with generous touch margin
    const maxX = window.innerWidth - puck.offsetWidth - 8;
    const maxY = window.innerHeight - puck.offsetHeight - 8;
    newX = Math.min(maxX, Math.max(0, newX));
    newY = Math.min(maxY, Math.max(48, newY));

    puck.style.left = `${newX}px`;
    puck.style.top = `${newY}px`;
    puck.style.right = 'auto';
    puck.style.bottom = 'auto';
  };

  const onPuckPointerUp = (e) => {
    if (!isDraggingPuck) return;
    e.stopPropagation();
    isDraggingPuck = false;
    puck.classList.remove('dragging');
    try {
      if (puck.hasPointerCapture && puck.hasPointerCapture(e.pointerId)) {
        puck.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (hasMoved) {
      // Check if dragged near left or right edge for docking
      const r = puck.getBoundingClientRect();
      const dockThreshold = 45;
      let docked = null;

      if (r.left <= dockThreshold) {
        docked = 'left';
        puck.classList.add('docked-left');
        puck.classList.remove('docked-right');
        puck.style.left = '0px';
        puck.style.right = 'auto';
      } else if (window.innerWidth - r.right <= dockThreshold) {
        docked = 'right';
        puck.classList.add('docked-right');
        puck.classList.remove('docked-left');
        puck.style.left = 'auto';
        puck.style.right = '0px';
      } else {
        puck.classList.remove('docked-left', 'docked-right');
      }

      try {
        localStorage.setItem('notes_puck_pos', JSON.stringify({
          x: Math.round(r.left),
          y: Math.round(r.top),
          docked
        }));
      } catch (_) {}
    } else {
      // Quick tap! Toggle between Navigate and Ink modes
      if (onToggleMode) onToggleMode();
    }
  };

  puck.addEventListener('pointerdown', onPuckPointerDown);
  window.addEventListener('pointermove', onPuckPointerMove);
  window.addEventListener('pointerup', onPuckPointerUp);
  window.addEventListener('pointercancel', onPuckPointerUp);
}

export function setupLayoutSwitcher({
  state,
  sidebar,
  resizeActiveDrawCanvas,
  updateWorldTransform,
  switchMode
}) {
  state.layout = 'layout-a';
  document.body.setAttribute('data-layout', 'layout-a');

  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar?.classList.toggle('collapsed', state.sidebarCollapsed);
    setTimeout(() => {
      if (resizeActiveDrawCanvas) resizeActiveDrawCanvas();
      if (updateWorldTransform) updateWorldTransform();
    }, 150);
  });

  const winBtn = document.getElementById('btn-mode-win');
  const ipadBtn = document.getElementById('btn-mode-ipad');

  winBtn?.addEventListener('click', () => switchMode('windows'));
  ipadBtn?.addEventListener('click', () => switchMode('ipad'));

  setupFloatingModePuck({
    state,
    onToggleMode: () => {
      const nextMode = state.mode === 'ipad' ? 'windows' : 'ipad';
      switchMode(nextMode);
    }
  });

  switchMode(state.mode || 'windows', true);

  window.addEventListener('resize', () => {
    if (resizeActiveDrawCanvas) resizeActiveDrawCanvas();
    if (updateWorldTransform) updateWorldTransform();
  });
}
