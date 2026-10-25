// Universal Mixed-Media Note Containers Master Layout & Item Dispatch Engine
import { attachResizeHandle, makeDraggable } from './block_drag_resize.js';
import { dockImageIntoContainer, renderMediaItem } from './media_renderer.js';
import { renderTextItem } from './text_renderer.js';
import { renderTableItem, renderPlotItem } from './math_table_renderer.js';
import { renderPDFItem } from './pdf_renderer.js';
import { renderSketchItem } from './sketch_renderer.js';
import { RemoveBlockCommand } from '../core/history.js';

export function renderBlocks(deps = {}) {
  const state = deps.state || window.state;
  const blocksLayer = deps.blocksLayer || document.getElementById('blocks-container');
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const renderAll = deps.renderAll || window.renderAll;
  const showToast = deps.showToast || window.showToast;
  const updateSelectionStatus = deps.updateSelectionStatus || window.updateSelectionStatus;
  const mediaFileInput = deps.mediaFileInput || document.getElementById('media-file-input');
  const pdfFileInput = deps.pdfFileInput || document.getElementById('pdf-file-input');

  if (!blocksLayer) return;
  blocksLayer.innerHTML = '';
  if (!state?.doc) return;

  const blocks = state.doc.blocks || [];
  blocks.forEach(block => {
    // Normalization: Ensure container format
    if (block.type !== 'note_container') {
      block.type = 'note_container';
      if (!block.items) {
        block.items = [{ id: 'sub_' + block.id, type: block.type || 'text', ...block }];
      }
    }

    const el = document.createElement('div');
    const isSelected = state.selectedBlockIds ? state.selectedBlockIds.has(block.id) : false;
    el.className = `universal-note-container ${isSelected ? 'selected' : ''}`;
    el.id = block.id;
    el.style.left = `${block.x}px`;
    el.style.top = `${block.y}px`;
    el.style.width = `${block.width || 560}px`;
    if (block.height && typeof block.height === 'number' && block.height > 0) {
      el.style.minHeight = `${block.height}px`;
    } else {
      el.style.minHeight = '';
    }
    if (block.fontFamily) el.style.fontFamily = block.fontFamily;
    if (block.lineHeight) el.style.lineHeight = block.lineHeight;
    if (block.letterSpacing) el.style.letterSpacing = block.letterSpacing;

    el.addEventListener('mousedown', (e) => {
      if (state.mode === 'ipad') return;
      state.activeContainerId = block.id;
      if (!state.selectedBlockIds.has(block.id) && !e.shiftKey) {
        state.selectedBlockIds.clear();
        state.selectedBlockIds.add(block.id);
        document.querySelectorAll('.universal-note-container').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        if (updateSelectionStatus) updateSelectionStatus();
      }
    });

    // Drag-and-Drop Docking Support (docking images from canvas into this note)
    el.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('application/notes-dock-img')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drop-target-active');
      }
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drop-target-active');
      }
    });

    el.addEventListener('drop', (e) => {
      el.classList.remove('drop-target-active');
      const dockDataRaw = e.dataTransfer ? e.dataTransfer.getData('application/notes-dock-img') : null;
      if (dockDataRaw) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const dockData = JSON.parse(dockDataRaw);
          const sourceBlock = (state.doc.blocks || []).find(b => b.id === dockData.blockId);
          if (sourceBlock && sourceBlock.id !== block.id) {
            const imgItem = (sourceBlock.items || []).find(it => it.id === dockData.itemId) || {
              src: dockData.src,
              caption: dockData.caption,
              width: dockData.width
            };
            dockImageIntoContainer(imgItem, sourceBlock, block, deps);
          }
        } catch (err) {
          console.warn('Dock drop failed:', err);
        }
      }
    });

    // 8-Point Resize Handles
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(dir => {
      const h = document.createElement('div');
      h.className = `resize-handle handle-${dir}`;
      h.dataset.dir = dir;
      attachResizeHandle(h, block, el, dir, deps);
      el.appendChild(h);
    });

    // Container Header with Clean Minimal Handle and Close Button
    const header = document.createElement('div');
    header.className = 'note-container-header';
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="block-handle-dots" style="cursor:grab; font-weight:bold; letter-spacing:2px; color:var(--text-muted, #94a3b8);" title="Drag note">:::</span>
        <span style="font-weight: 600; color: var(--text-color, #475569);">${block.title || 'NOTE'}</span>
      </div>
      <div class="note-container-tools">
        <button class="block-delete-btn" title="Delete note (&times;)" style="font-size:16px; font-weight:bold; color:var(--text-muted, #94a3b8); background:none; border:none; cursor:pointer; padding:2px 6px; border-radius:4px; line-height:1;">&times;</button>
      </div>
    `;

    header.querySelector('.block-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.history) state.history.execute(new RemoveBlockCommand(state.doc, block.id));
      if (state.selectedBlockIds) state.selectedBlockIds.delete(block.id);
      if (saveActivePageDocument) saveActivePageDocument();
      if (renderAll) renderAll();
    });

    makeDraggable(el, header, block, deps);
    el.appendChild(header);

    // Container Body with Mixed Media Items
    const body = document.createElement('div');
    body.className = 'note-container-body';

    // Click on empty space inside body to type/focus at the bottom
    body.addEventListener('click', (e) => {
      if (state.mode === 'ipad') return;
      if (e.target === body) {
        if (!block.items) block.items = [];
        const lastItem = block.items[block.items.length - 1];
        if (lastItem && lastItem.type === 'text') {
          const textEls = body.querySelectorAll('.note-item-text');
          const lastTextEl = textEls[textEls.length - 1];
          if (lastTextEl) {
            lastTextEl.click();
            const range = document.createRange();
            const sel = window.getSelection();
            if (sel) {
              range.selectNodeContents(lastTextEl);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        } else {
          const newItem = {
            id: 'item_' + Date.now(),
            type: 'text',
            content: ''
          };
          block.items.push(newItem);
          state.focusItemId = newItem.id;
          if (saveActivePageDocument) saveActivePageDocument();
          if (renderAll) renderAll();
        }
      }
    });

    (block.items || []).forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'note-item';
      itemEl.dataset.itemId = item.id || `item_${index}`;

      // Delete single item button
      const delItemBtn = document.createElement('button');
      delItemBtn.className = 'note-item-delete';
      delItemBtn.title = 'Remove item';
      delItemBtn.innerHTML = '&times;';
      delItemBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        block.items.splice(index, 1);
        if (saveActivePageDocument) saveActivePageDocument();
        if (renderAll) renderAll();
      });
      itemEl.appendChild(delItemBtn);

      switch (item.type) {
        case 'text':
          renderTextItem(itemEl, item, header, block, deps);
          break;
        case 'image':
        case 'media':
          renderMediaItem(itemEl, item, block, deps);
          break;
        case 'table':
          renderTableItem(itemEl, item, block, deps);
          break;
        case 'plot':
          renderPlotItem(itemEl, item, block, deps);
          break;
        case 'pdf':
        case 'pdf_printout':
          renderPDFItem(itemEl, item, deps);
          break;
        case 'sketch':
        case 'inbox_canvas':
          renderSketchItem(itemEl, item, block, deps);
          break;
        default:
          renderTextItem(itemEl, item, header, block, deps);
          break;
      }

      body.appendChild(itemEl);
    });

    el.appendChild(body);
    blocksLayer.appendChild(el);

    if (el.offsetHeight > 0) {
      block.actualHeight = el.offsetHeight;
    }
  });
}
