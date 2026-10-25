// Inking & Eraser Palette Controls Module
// Handles Pen, Highlighter, and Eraser toolbar controls, tip sizes, and swatches

export function setupInkPaletteControls({
  state,
  activeDrawCanvas,
  clearActiveDrawCanvas,
  showToast
}) {
  const penBtn = document.getElementById('ink-tool-pen');
  const highlighterBtn = document.getElementById('ink-tool-highlighter');
  const eraserBtn = document.getElementById('ink-tool-eraser');
  const penControls = document.getElementById('pen-controls-cluster');
  const eraserControls = document.getElementById('eraser-controls-cluster');

  const ribbonInkGroup = document.getElementById('ribbon-ink-group');

  const activatePen = () => {
    state.inkTool = 'pen';
    ribbonInkGroup?.setAttribute('data-ink-tool', 'pen');
    penBtn?.classList.add('active');
    highlighterBtn?.classList.remove('active');
    eraserBtn?.classList.remove('active');
    if (penControls) penControls.style.display = 'flex';
    if (eraserControls) eraserControls.style.display = 'none';
    activeDrawCanvas?.classList.remove('eraser-cursor');
    if (clearActiveDrawCanvas) clearActiveDrawCanvas();
  };

  const activateHighlighter = () => {
    state.inkTool = 'highlighter';
    ribbonInkGroup?.setAttribute('data-ink-tool', 'highlighter');
    highlighterBtn?.classList.add('active');
    penBtn?.classList.remove('active');
    eraserBtn?.classList.remove('active');
    if (penControls) penControls.style.display = 'flex';
    if (eraserControls) eraserControls.style.display = 'none';
    activeDrawCanvas?.classList.remove('eraser-cursor');
    if (clearActiveDrawCanvas) clearActiveDrawCanvas();
  };

  const activateEraser = () => {
    state.inkTool = 'eraser';
    eraserBtn?.classList.add('active');
    penBtn?.classList.remove('active');
    highlighterBtn?.classList.remove('active');
    if (penControls) penControls.style.display = 'none';
    if (eraserControls) eraserControls.style.display = 'flex';
    activeDrawCanvas?.classList.add('eraser-cursor');
  };

  penBtn?.addEventListener('click', () => {
    activatePen();
    showToast('🖊 Pen Tool Active');
  });

  highlighterBtn?.addEventListener('click', () => {
    activateHighlighter();
    showToast('🖍 Highlighter Tool Active');
  });

  eraserBtn?.addEventListener('click', () => {
    activateEraser();
    showToast(`🧹 Eraser Active (${state.eraserMode === 'full' ? 'Full Stroke' : 'Partial Stroke'})`);
  });

  // Pen Tip Size Buttons
  document.querySelectorAll('.ink-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ink-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.inkWidth = parseInt(btn.dataset.size, 10) || 3;
      if (state.inkTool === 'eraser') activatePen();
      showToast(`Tip Size: ${state.inkWidth}px`);
    });
  });

  // Pen Color Swatches
  document.querySelectorAll('.ink-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.ink-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      state.inkColor = swatch.dataset.color;
      if (state.inkTool === 'eraser') activatePen();
      showToast(`🎨 Color: ${swatch.title}`);
    });
  });

  // Custom Color Input & Launcher Button
  const customColor = document.getElementById('ink-color-custom');
  if (customColor) {
    customColor.addEventListener('input', (e) => {
      document.querySelectorAll('.ink-swatch').forEach(s => s.classList.remove('active'));
      customColor.closest('.ink-custom-btn')?.classList.add('active');
      state.inkColor = e.target.value;
      if (state.inkTool === 'eraser') activatePen();
    });
  }

  // Eraser Modes: Full vs Partial
  const fullBtn = document.getElementById('eraser-mode-full');
  const partBtn = document.getElementById('eraser-mode-partial');

  fullBtn?.addEventListener('click', () => {
    state.eraserMode = 'full';
    fullBtn.classList.add('active');
    partBtn?.classList.remove('active');
    activateEraser();
    showToast('⚡ OneNote-Style Full Stroke Eraser');
  });

  partBtn?.addEventListener('click', () => {
    state.eraserMode = 'partial';
    partBtn.classList.add('active');
    fullBtn?.classList.remove('active');
    activateEraser();
    showToast('✂ Segment Partial Stroke Eraser');
  });

  // Eraser Sizes
  document.querySelectorAll('.ink-eraser-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ink-eraser-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.eraserSize = parseInt(btn.dataset.radius, 10) || 24;
      activateEraser();
      showToast(`Eraser Size: ${btn.textContent}`);
    });
  });
}
