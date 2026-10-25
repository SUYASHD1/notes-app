// Typography Palettes: Font Color, Highlighter, Canva Font Menu & Spacing Popover

export function setupTypographyPalettes(options) {
  const {
    state,
    restoreTextSelection,
    captureTextSelection,
    syncRibbonActiveStates,
    showToast,
    saveActivePageDocument
  } = options;

  // --- Highlighter System ---
  let activeHighlightColor = '#fef08a';
  let isHighlightMode = false;
  const highlightBtn = document.getElementById('ribbon-highlight');
  const highlightBar = document.getElementById('ribbon-highlight-bar');
  const highlightDropBtn = document.getElementById('ribbon-highlight-dropdown-btn');
  const highlightPalette = document.getElementById('highlighter-palette');

  function applyHighlight(color) {
    restoreTextSelection();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      if (color === 'transparent') {
        document.execCommand('removeFormat');
      } else {
        document.execCommand('hiliteColor', false, color);
      }
      if (syncRibbonActiveStates) syncRibbonActiveStates();
      captureTextSelection();
      return true;
    }
    return false;
  }

  highlightBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const applied = applyHighlight(activeHighlightColor);
    if (!applied) {
      isHighlightMode = !isHighlightMode;
      highlightBtn.classList.toggle('active', isHighlightMode);
      if (typeof showToast === 'function') {
        showToast(isHighlightMode ? '🖍️ Highlight Tool Active: Drag over text to highlight' : 'Highlight Tool Inactive');
      }
    }
  });

  highlightDropBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!highlightPalette) return;
    fontColorPalette?.classList.add('hidden');
    fontMenu?.classList.add('hidden');
    spacingPalette?.classList.add('hidden');
    const isHidden = highlightPalette.classList.contains('hidden');
    if (isHidden) {
      const wrapper = highlightDropBtn.closest('#highlighter-picker-wrapper') || highlightDropBtn;
      const rect = wrapper.getBoundingClientRect();
      highlightPalette.style.top = `${rect.bottom + 6}px`;
      highlightPalette.style.left = `${Math.max(10, rect.left - 10)}px`;
      highlightPalette.classList.remove('hidden');
    } else {
      highlightPalette.classList.add('hidden');
    }
  });

  highlightPalette?.querySelectorAll('.hl-swatch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.getAttribute('data-color') || '#fef08a';
      activeHighlightColor = col;
      if (highlightBar) {
        highlightBar.style.backgroundColor = col === 'transparent' ? '#cbd5e1' : col;
        highlightBar.style.boxShadow = col === 'transparent' ? 'none' : `0 1px 5px ${col}88`;
      }
      highlightPalette.querySelectorAll('.hl-swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      highlightPalette.classList.add('hidden');
      applyHighlight(col);
    });
  });

  // --- Font Color System ---
  const fontColorBtn = document.getElementById('ribbon-font-color-btn');
  const fontColorDropBtn = document.getElementById('ribbon-font-color-dropdown-btn');
  const fontColorPalette = document.getElementById('font-color-palette');
  const ribbonColorBar = document.getElementById('ribbon-color-bar');
  const ribbonColorInput = document.getElementById('ribbon-color');
  let activeFontColor = '#0f172a';

  function applyFontColor(color) {
    restoreTextSelection();
    document.execCommand('foreColor', false, color);
    captureTextSelection();
  }

  fontColorBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    applyFontColor(activeFontColor);
  });

  fontColorDropBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!fontColorPalette) return;
    highlightPalette?.classList.add('hidden');
    fontMenu?.classList.add('hidden');
    spacingPalette?.classList.add('hidden');
    const isHidden = fontColorPalette.classList.contains('hidden');
    if (isHidden) {
      const wrapper = fontColorDropBtn.closest('.font-color-picker-wrapper') || fontColorDropBtn;
      const rect = wrapper.getBoundingClientRect();
      fontColorPalette.style.top = `${rect.bottom + 6}px`;
      fontColorPalette.style.left = `${Math.max(10, rect.left - 10)}px`;
      fontColorPalette.classList.remove('hidden');
    } else {
      fontColorPalette.classList.add('hidden');
    }
  });

  const resetDefaultBtn = document.getElementById('fc-reset-default');
  resetDefaultBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const defCol = isDark ? '#f1f5f9' : '#18181b';
    activeFontColor = defCol;
    if (ribbonColorBar) {
      ribbonColorBar.style.backgroundColor = defCol;
      ribbonColorBar.style.boxShadow = 'none';
    }
    fontColorPalette?.querySelectorAll('.fc-swatch').forEach(s => s.classList.remove('active'));
    applyFontColor(defCol);
  });

  fontColorPalette?.querySelectorAll('.fc-swatch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = btn.getAttribute('data-color') || '#18181b';
      activeFontColor = col;
      if (ribbonColorBar) {
        ribbonColorBar.style.backgroundColor = col;
        ribbonColorBar.style.boxShadow = `0 1px 5px ${col}88`;
      }
      fontColorPalette.querySelectorAll('.fc-swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      applyFontColor(col);
    });
  });

  ribbonColorInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    activeFontColor = val;
    if (ribbonColorBar) {
      ribbonColorBar.style.backgroundColor = val;
      ribbonColorBar.style.boxShadow = `0 1px 5px ${val}66`;
    }
    fontColorPalette?.querySelectorAll('.fc-swatch').forEach(s => s.classList.remove('active'));
    applyFontColor(val);
  });

  // --- Canva-Style Font Menu ---
  const fontMenu = document.getElementById('font-family-palette');
  const fontBtn = document.getElementById('ribbon-font-btn');
  const fontLabel = document.getElementById('ribbon-font-label');

  fontBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!fontMenu) return;
    highlightPalette?.classList.add('hidden');
    fontColorPalette?.classList.add('hidden');
    spacingPalette?.classList.add('hidden');
    const isHidden = fontMenu.classList.contains('hidden');
    if (isHidden) {
      const rect = fontBtn.getBoundingClientRect();
      fontMenu.style.top = `${rect.bottom + 6}px`;
      fontMenu.style.left = `${Math.max(10, rect.left)}px`;
      fontMenu.classList.remove('hidden');
      fontBtn.classList.add('active');
    } else {
      fontMenu.classList.add('hidden');
      fontBtn.classList.remove('active');
    }
  });

  function applyFontFamily(fontVal) {
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.getRangeAt(0).toString().trim().length > 0;
    const activeContId = state.activeContainerId;
    const activeContEl = activeContId ? document.getElementById(activeContId) : document.querySelector('.universal-note-container.selected');

    if (hasSelection) {
      restoreTextSelection();
      const curSel = window.getSelection();
      if (curSel && curSel.rangeCount > 0 && !curSel.isCollapsed) {
        const range = curSel.getRangeAt(0), span = document.createElement('span');
        span.style.fontFamily = fontVal;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        const nr = document.createRange();
        nr.selectNodeContents(span);
        curSel.removeAllRanges();
        curSel.addRange(nr);
      }
      captureTextSelection();
    } else if (activeContEl) {
      activeContEl.style.fontFamily = fontVal;
      activeContEl.querySelectorAll('.note-item-text').forEach(t => t.style.fontFamily = fontVal);
      if (state.doc && state.doc.blocks) {
        const blk = state.doc.blocks.find(b => b.id === (activeContId || activeContEl.id));
        if (blk) { blk.fontFamily = fontVal; if (saveActivePageDocument) saveActivePageDocument(); }
      }
    } else {
      document.execCommand('fontName', false, fontVal);
    }
  }

  fontMenu?.querySelectorAll('.font-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const fontVal = item.getAttribute('data-font');
      const fontName = item.querySelector('.font-item-name')?.textContent || 'Font';
      if (fontLabel) fontLabel.textContent = fontName;
      fontMenu.querySelectorAll('.font-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      fontMenu.classList.add('hidden');
      fontBtn?.classList.remove('active');
      applyFontFamily(fontVal);
    });
  });

  // --- Compact Line & Word Spacing Tool ---
  const spacingPalette = document.getElementById('spacing-palette');
  const spacingBtn = document.getElementById('ribbon-spacing-btn');

  spacingBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!spacingPalette) return;
    highlightPalette?.classList.add('hidden');
    fontColorPalette?.classList.add('hidden');
    fontMenu?.classList.add('hidden');
    const isHidden = spacingPalette.classList.contains('hidden');
    if (isHidden) {
      const rect = spacingBtn.getBoundingClientRect();
      spacingPalette.style.top = `${rect.bottom + 6}px`;
      spacingPalette.style.left = `${Math.max(10, rect.left - 60)}px`;
      spacingPalette.classList.remove('hidden');
      spacingBtn.classList.add('active');
    } else {
      spacingPalette.classList.add('hidden');
      spacingBtn.classList.remove('active');
    }
  });

  function applySpacing(type, val) {
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.getRangeAt(0).toString().trim().length > 0;
    const activeContId = state.activeContainerId;
    const activeContEl = activeContId ? document.getElementById(activeContId) : document.querySelector('.universal-note-container.selected');

    if (hasSelection) {
      restoreTextSelection();
      const curSel = window.getSelection();
      if (curSel && curSel.rangeCount > 0 && !curSel.isCollapsed) {
        const range = curSel.getRangeAt(0), span = document.createElement('span');
        if (type === 'line') span.style.lineHeight = val;
        if (type === 'word') span.style.letterSpacing = val;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        const nr = document.createRange();
        nr.selectNodeContents(span);
        curSel.removeAllRanges();
        curSel.addRange(nr);
      }
      captureTextSelection();
    } else if (activeContEl) {
      if (type === 'line') {
        activeContEl.style.lineHeight = val;
        activeContEl.querySelectorAll('.note-item-text').forEach(t => t.style.lineHeight = val);
      } else if (type === 'word') {
        activeContEl.style.letterSpacing = val;
        activeContEl.querySelectorAll('.note-item-text').forEach(t => t.style.letterSpacing = val);
      }
      if (state.doc && state.doc.blocks) {
        const blk = state.doc.blocks.find(b => b.id === (activeContId || activeContEl.id));
        if (blk) {
          if (type === 'line') blk.lineHeight = val;
          if (type === 'word') blk.letterSpacing = val;
          if (saveActivePageDocument) saveActivePageDocument();
        }
      }
    }
  }

  spacingPalette?.querySelectorAll('.sp-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const val = btn.getAttribute('data-val');
      spacingPalette.querySelectorAll(`.sp-pill-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applySpacing(type, val);
    });
  });

  // Central Outside Click Dismissal (Polite Guest Key)
  const dismissPalettes = (e) => {
    if (!e.target.closest('#highlighter-palette') && !e.target.closest('#ribbon-highlight-dropdown-btn')) highlightPalette?.classList.add('hidden');
    if (!e.target.closest('#font-color-palette') && !e.target.closest('#ribbon-font-color-dropdown-btn')) fontColorPalette?.classList.add('hidden');
    if (!e.target.closest('#font-family-palette') && !e.target.closest('#ribbon-font-btn')) { fontMenu?.classList.add('hidden'); fontBtn?.classList.remove('active'); }
    if (!e.target.closest('#spacing-palette') && !e.target.closest('#ribbon-spacing-btn')) { spacingPalette?.classList.add('hidden'); spacingBtn?.classList.remove('active'); }
  };
  document.addEventListener('pointerdown', dismissPalettes);
  document.addEventListener('click', dismissPalettes);

  document.addEventListener('selectionchange', () => {
    if (isHighlightMode) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).commonAncestorContainer;
        const textBlock = (node.nodeType === 1 ? node : node.parentElement)?.closest('.note-item-text');
        if (textBlock) applyHighlight(activeHighlightColor);
      }
    }
  });

  return { applyFontFamily, applyHighlight, applyFontColor, applySpacing };
}
