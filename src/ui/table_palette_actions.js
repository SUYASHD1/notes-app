// Table Ribbon Palette & In-Note Table Formatting Actions (< 350 lines)

export function setupTablePalette(options = {}) {
  const {
    state,
    showToast = window.showToast,
    saveActivePageDocument = window.saveActivePageDocument,
    renderAll = window.renderAll,
    getOrCreateActiveContainer = () => null,
    restoreTextSelection = () => {},
    captureTextSelection = () => {}
  } = options;

  const ribbonTableBtn = document.getElementById('ribbon-table-btn');
  const tablePalette = document.getElementById('table-palette');
  const tblActiveTools = document.getElementById('tbl-active-tools');
  const tblInsertTools = document.getElementById('tbl-insert-tools');

  let activeTableElement = null;
  let activeTableCell = null;

  // Track active table when user clicks or moves cursor inside a table
  function registerActiveTable(tbl, cell = null) {
    activeTableElement = tbl;
    activeTableCell = cell;
    if (ribbonTableBtn) ribbonTableBtn.classList.add('active');
    if (tblActiveTools && tblInsertTools) {
      tblActiveTools.style.display = 'block';
      tblInsertTools.style.display = 'none';
    }
  }

  function clearActiveTable() {
    activeTableElement = null;
    activeTableCell = null;
    if (ribbonTableBtn) ribbonTableBtn.classList.remove('active');
    if (tblActiveTools && tblInsertTools) {
      tblActiveTools.style.display = 'none';
      tblInsertTools.style.display = 'block';
    }
    document.querySelectorAll('.note-table-wrapper.selected-table').forEach(w => {
      w.classList.remove('selected-table');
    });
  }

  document.addEventListener('click', (e) => {
    const table = e.target.closest('table');
    const moveHandle = e.target.closest('.table-move-handle');
    const wrapper = e.target.closest('.note-table-wrapper');

    if (moveHandle && wrapper) {
      const tbl = wrapper.querySelector('table');
      if (tbl) {
        document.querySelectorAll('.note-table-wrapper.selected-table').forEach(w => w.classList.remove('selected-table'));
        wrapper.classList.add('selected-table');
        registerActiveTable(tbl, tbl.querySelector('td, th'));
        return;
      }
    }

    if (table) {
      const cell = e.target.closest('td, th');
      registerActiveTable(table, cell);
    } else if (!e.target.closest('#table-picker-wrapper') && !e.target.closest('.note-table-wrapper')) {
      if (!tablePalette || tablePalette.classList.contains('hidden')) {
        document.querySelectorAll('.note-table-wrapper.selected-table').forEach(w => w.classList.remove('selected-table'));
      }
    }
  });

  // Toggle Table Ribbon Menu
  ribbonTableBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!tablePalette) return;

    // Polite Guest: close other typography popovers
    ['#font-color-palette', '#font-family-palette', '#spacing-palette', '#highlighter-palette'].forEach(sel => {
      document.querySelector(sel)?.classList.add('hidden');
    });

    const isHidden = tablePalette.classList.contains('hidden');
    if (isHidden) {
      const wrapper = ribbonTableBtn.closest('#table-picker-wrapper') || ribbonTableBtn;
      const rect = wrapper.getBoundingClientRect();
      tablePalette.style.top = `${rect.bottom + 6}px`;
      tablePalette.style.left = `${Math.max(10, rect.left - 50)}px`;
      tablePalette.classList.remove('hidden');

      // Update active vs insert view based on activeTableElement
      if (activeTableElement && document.body.contains(activeTableElement)) {
        if (tblActiveTools) tblActiveTools.style.display = 'block';
        if (tblInsertTools) tblInsertTools.style.display = 'none';
      } else {
        if (tblActiveTools) tblActiveTools.style.display = 'none';
        if (tblInsertTools) tblInsertTools.style.display = 'block';
      }
    } else {
      tablePalette.classList.add('hidden');
    }
  });

  // Dismiss on outside click
  document.addEventListener('click', (e) => {
    if (tablePalette && !tablePalette.classList.contains('hidden') && !e.target.closest('#table-picker-wrapper')) {
      tablePalette.classList.add('hidden');
    }
  });

  // Create Table HTML helper
  function buildTableHTML(rows, cols) {
    let html = '<div class="note-table-wrapper" contenteditable="false"><div class="table-move-handle" contenteditable="false" title="Drag to move table">✢</div>';
    html += '<table class="note-table" style="width:100%; border-collapse:collapse; margin:4px 0;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? 'th' : 'td';
        const bg = r === 0 ? 'background:var(--panel-sub, #f8fafc); font-weight:600;' : 'background:var(--card-bg, #ffffff);';
        html += `<${tag} contenteditable="true" style="border:1px solid var(--border-color, #cbd5e1); padding:8px 10px; ${bg} min-width:60px;">${r === 0 ? `Col ${c + 1}` : ''}</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table></div><p><br></p>';
    return html;
  }

  // Insert Table handler (2x2, 3x3, etc.)
  document.querySelectorAll('[data-tbl-insert]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const spec = btn.getAttribute('data-tbl-insert') || '3x3';
      const [rStr, cStr] = spec.split('x');
      const rows = parseInt(rStr, 10) || 3;
      const cols = parseInt(cStr, 10) || 3;

      tablePalette?.classList.add('hidden');

      restoreTextSelection();
      const sel = window.getSelection();
      let inserted = false;

      if (sel && sel.rangeCount > 0) {
        const textContainer = sel.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? sel.anchorNode.closest('.note-item-text')
          : sel.anchorNode?.parentElement?.closest('.note-item-text');

        if (textContainer) {
          document.execCommand('insertHTML', false, buildTableHTML(rows, cols));
          if (textContainer._syncContent) textContainer._syncContent();
          inserted = true;
        }
      }

      if (!inserted) {
        const targetContainer = getOrCreateActiveContainer();
        if (targetContainer) {
          const grid = [];
          for (let r = 0; r < rows; r++) {
            const rowData = [];
            for (let c = 0; c < cols; c++) {
              rowData.push(r === 0 ? `Col ${c + 1}` : '');
            }
            grid.push(rowData);
          }
          targetContainer.items.push({
            id: 'item_tbl_' + Date.now(),
            type: 'table',
            data: grid
          });
          if (renderAll) renderAll();
          inserted = true;
        }
      }

      if (saveActivePageDocument) saveActivePageDocument();
      if (showToast) showToast(`⊞ Inserted ${rows} × ${cols} Table`);
    });
  });

  // Table Active Tool actions (styles, row/col operations, delete)
  document.querySelectorAll('[data-tbl-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-tbl-action');
      if (!activeTableElement || !document.body.contains(activeTableElement)) {
        if (showToast) showToast('⚠️ Click inside a table to format it');
        return;
      }

      const table = activeTableElement;
      const wrapper = table.closest('.note-table-wrapper') || table;
      const noteItemText = table.closest('.note-item-text');

      // Styles
      if (action.startsWith('style-')) {
        wrapper.classList.remove('table-style-striped', 'table-style-header-accent', 'table-style-minimal');
        if (action === 'style-striped') wrapper.classList.add('table-style-striped');
        else if (action === 'style-header') wrapper.classList.add('table-style-header-accent');
        else if (action === 'style-minimal') wrapper.classList.add('table-style-minimal');

        if (noteItemText?._syncContent) noteItemText._syncContent();
        if (saveActivePageDocument) saveActivePageDocument();
        if (showToast) showToast(`Applied ${action.replace('style-', '')} table style`);
        return;
      }

      const currentTr = (activeTableCell ? activeTableCell.closest('tr') : null) || table.querySelector('tr');
      const allRows = Array.from(table.querySelectorAll('tr'));
      const rowIndex = currentTr ? allRows.indexOf(currentTr) : 0;
      const colIndex = activeTableCell ? Array.from(currentTr?.children || []).indexOf(activeTableCell) : 0;

      if (action === 'add-row-above' || action === 'add-row-below') {
        const colCount = currentTr ? currentTr.children.length : (table.querySelector('tr')?.children.length || 3);
        const newTr = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          td.style.border = '1px solid var(--border-color, #cbd5e1)';
          td.style.padding = '8px 10px';
          td.style.background = 'var(--card-bg, #ffffff)';
          newTr.appendChild(td);
        }
        if (action === 'add-row-above' && currentTr) {
          currentTr.parentNode.insertBefore(newTr, currentTr);
        } else if (currentTr && currentTr.nextSibling) {
          currentTr.parentNode.insertBefore(newTr, currentTr.nextSibling);
        } else {
          table.appendChild(newTr);
        }
        if (showToast) showToast('Added table row');
      } else if (action === 'add-col-left' || action === 'add-col-right') {
        allRows.forEach((tr, rIdx) => {
          const isHeader = rIdx === 0 && tr.querySelector('th');
          const cell = document.createElement(isHeader ? 'th' : 'td');
          cell.contentEditable = 'true';
          cell.style.border = '1px solid var(--border-color, #cbd5e1)';
          cell.style.padding = '8px 10px';
          cell.style.background = isHeader ? 'var(--panel-sub, #f8fafc)' : 'var(--card-bg, #ffffff)';
          if (isHeader) cell.textContent = `New Col`;

          const targetRef = tr.children[colIndex];
          if (action === 'add-col-left' && targetRef) {
            tr.insertBefore(cell, targetRef);
          } else if (targetRef && targetRef.nextSibling) {
            tr.insertBefore(cell, targetRef.nextSibling);
          } else {
            tr.appendChild(cell);
          }
        });
        if (showToast) showToast('Added table column');
      } else if (action === 'del-row') {
        if (allRows.length <= 1) {
          if (showToast) showToast('Cannot delete last remaining row');
          return;
        }
        if (currentTr) currentTr.remove();
        if (showToast) showToast('Deleted table row');
      } else if (action === 'del-col') {
        const firstRowCells = allRows[0]?.children.length || 0;
        if (firstRowCells <= 1) {
          if (showToast) showToast('Cannot delete last remaining column');
          return;
        }
        allRows.forEach(tr => {
          if (tr.children[colIndex]) tr.children[colIndex].remove();
        });
        if (showToast) showToast('Deleted table column');
      } else if (action === 'del-table') {
        if (wrapper && wrapper !== table) {
          wrapper.remove();
        } else {
          table.remove();
        }
        clearActiveTable();
        tablePalette?.classList.add('hidden');
        if (showToast) showToast('🗑️ Deleted table');
      }

      if (noteItemText?._syncContent) noteItemText._syncContent();
      if (saveActivePageDocument) saveActivePageDocument();
    });
  });

  return {
    registerActiveTable,
    clearActiveTable
  };
}
