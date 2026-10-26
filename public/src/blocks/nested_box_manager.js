import { dismissTextCaret } from '../core/app_shield.js';

/**
 * Creates the HTML for a Universal Box (Box-in-Box model)
 * Always contains:
 * - Header with drag handle ::: and wrap/pop-out/delete toolbar
 * - Media payload (image, table, or visual block)
 * - Live editable text space (.nested-card-text)
 * - 8-point resize capability
 * - Original block blueprint preserved in data-original-block
 */
export function createUniversalBoxHtml({
  title = 'Note Card',
  src = '',
  alt = 'Image',
  textHtml = '',
  tableHtml = '',
  originalBlock = null,
  wrap = 'center',
  width = 420
}) {
  const originalJson = originalBlock ? encodeURIComponent(JSON.stringify(originalBlock)) : '';

  let mediaHtml = '';
  if (src) {
    mediaHtml = `<div class="note-image-container" data-src="${src}" data-alt="${alt}"><img class="note-embedded-image" src="${src}" alt="${alt}" loading="lazy" /></div>`;
  } else if (tableHtml) {
    mediaHtml = `<div class="note-table-wrapper">${tableHtml}</div>`;
  }

  const safeText = textHtml || '';

  return `<div class="note-nested-card wrap-${wrap}" data-wrap="${wrap}" data-title="${title}" data-original-block="${originalJson}" style="width:${width}px;" contenteditable="false" draggable="true">` +
    `<div class="nested-card-header">` +
      `<span class="nested-card-drag-handle" title="Drag to reposition or pop out">:::</span>` +
      `<span class="nested-card-title">${title}</span>` +
      `<div class="nested-card-toolbar">` +
        `<button class="nested-tool-btn ${wrap === 'left' ? 'active' : ''}" data-action="wrap-left" title="Wrap text around left">⬅️ Left</button>` +
        `<button class="nested-tool-btn ${wrap === 'center' ? 'active' : ''}" data-action="wrap-center" title="Center card">⏸️ Center</button>` +
        `<button class="nested-tool-btn ${wrap === 'right' ? 'active' : ''}" data-action="wrap-right" title="Wrap text around right">➡️ Right</button>` +
        `<button class="nested-tool-btn btn-popout" data-action="pop-out" title="Pop out onto canvas">🪟 Pop Out</button>` +
        `<button class="nested-tool-btn btn-danger" data-action="delete" title="Delete card">🗑️</button>` +
      `</div>` +
    `</div>` +
    `<div class="nested-card-content">${mediaHtml}</div>` +
    `<div class="nested-card-text" contenteditable="true" data-placeholder="Click to type notes here...">${safeText}</div>` +
  `</div>`;
}

/**
 * Attaches 8-point resize handles to a nested card for fluid corner/edge resizing.
 */
export function attachCardResizeHandles(card, onContentChanged) {
  if (card.querySelector('.card-resize-handle')) return;

  const positions = ['nw', 'ne', 'se', 'sw', 'e', 'w'];
  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `card-resize-handle handle-${pos}`;
    handle.contentEditable = 'false';

    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dismissTextCaret();

      const startX = e.clientX;
      const startWidth = card.offsetWidth;

      const onMouseMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        let newWidth = startWidth;
        if (pos.includes('e')) {
          newWidth = startWidth + dx;
        } else if (pos.includes('w')) {
          newWidth = startWidth - dx;
        }
        newWidth = Math.max(200, Math.min(800, newWidth));
        card.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (typeof onContentChanged === 'function') onContentChanged();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    card.appendChild(handle);
  });
}

/**
 * Docks a whole box into another note container.
 * Inserts directly at targetRange (mouse drop location) instead of appending to the bottom.
 */
export function dockWholeBoxIntoContainer(sourceBlock, targetBlock, deps = {}, targetRange = null) {
  const state = deps.state || window.state;
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const renderAll = deps.renderAll || window.renderAll;
  const showToast = deps.showToast || window.showToast;

  if (!sourceBlock || !targetBlock) return;
  const beforeSnap = state?.history?.takeSnapshot(state.doc);

  if (!targetBlock.items) targetBlock.items = [];
  let textItem = targetBlock.items.find(it => it.type === 'text' || !it.type);
  if (!textItem) {
    textItem = { id: 'item_text_' + Date.now(), type: 'text', content: '' };
    targetBlock.items.push(textItem);
  }

  // Extract images and text from sourceBlock
  let src = '';
  let alt = sourceBlock.title || 'Image';
  let textHtml = '';

  (sourceBlock.items || []).forEach(it => {
    if (it.type === 'image' || it.src) {
      src = it.src || it.url;
      alt = it.caption || alt;
    } else if (it.type === 'text' || !it.type) {
      textHtml += (textHtml ? '<br>' : '') + (it.content || '');
    }
  });

  const cardHtml = createUniversalBoxHtml({
    title: sourceBlock.title || 'Note Card',
    src,
    alt,
    textHtml,
    originalBlock: sourceBlock,
    wrap: 'center',
    width: Math.max(280, Math.min(540, sourceBlock.width || 420))
  });

  // Target DOM element if already visible
  const targetEl = document.getElementById(targetBlock.id);
  const textDiv = targetEl ? targetEl.querySelector('.note-item-text') : null;

  if (textDiv && targetRange && textDiv.contains(targetRange.startContainer)) {
    const temp = document.createElement('div');
    temp.innerHTML = cardHtml;
    const insertedCard = temp.firstElementChild;
    targetRange.insertNode(insertedCard);
    textDiv._dirty = true;
    if (typeof textDiv._syncContent === 'function') textDiv._syncContent(true);
    textItem.content = textDiv.innerHTML;
  } else if (textDiv) {
    const temp = document.createElement('div');
    temp.innerHTML = cardHtml;
    const insertedCard = temp.firstElementChild;
    textDiv.appendChild(insertedCard);
    textDiv._dirty = true;
    if (typeof textDiv._syncContent === 'function') textDiv._syncContent(true);
    textItem.content = textDiv.innerHTML;
  } else {
    textItem.content = (textItem.content || '').trim() + '\n\n' + cardHtml + '\n\n';
  }

  // Remove sourceBlock from canvas blocks
  if (state?.doc?.blocks) {
    const idx = state.doc.blocks.findIndex(b => b.id === sourceBlock.id);
    if (idx !== -1) state.doc.blocks.splice(idx, 1);
  }

  if (state) {
    state.activeContainerId = targetBlock.id;
    state.selectedBlockIds?.clear();
    state.selectedBlockIds?.add(targetBlock.id);
  }

  if (beforeSnap) state?.history?.recordSnapshot(state.doc, beforeSnap);
  if (saveActivePageDocument) saveActivePageDocument();
  if (renderAll) renderAll();
  if (showToast) showToast('📥 Docked box into note as Universal Box');
}

/**
 * Pops out a nested card back onto the canvas.
 * - Restores exact original block formatting and layout without any data loss.
 * - Places the new note right under targetCoords (mouse drop location).
 */
export function popOutNestedCard(card, textDiv, targetCoords = null) {
  const state = window.state;
  if (!card || !state?.doc) return;
  const beforeSnap = state.history?.takeSnapshot(state.doc);

  const rawOriginal = card.getAttribute('data-original-block');
  let originalBlock = null;
  if (rawOriginal) {
    try {
      originalBlock = JSON.parse(decodeURIComponent(rawOriginal));
    } catch (_) {}
  }

  const parentContainer = card.closest('.universal-note-container');
  const parentBlock = parentContainer ? state.doc.getBlock(parentContainer.id) : null;
  const cardTextEl = card.querySelector('.nested-card-text');
  const liveText = cardTextEl ? cardTextEl.innerHTML : '';
  const title = card.getAttribute('data-title') || originalBlock?.title || 'Note Card';
  const width = card.offsetWidth || originalBlock?.width || 440;

  let spawnX = targetCoords ? targetCoords.x : (parentBlock ? parentBlock.x + (parentBlock.width || 480) + 30 : 120);
  let spawnY = targetCoords ? targetCoords.y : (parentBlock ? parentBlock.y : 120);

  let newBlock = null;
  if (originalBlock) {
    newBlock = JSON.parse(JSON.stringify(originalBlock));
    newBlock.id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    newBlock.x = spawnX;
    newBlock.y = spawnY;
    newBlock.width = width;
    if (liveText) {
      let txtItem = (newBlock.items || []).find(it => it.type === 'text' || !it.type);
      if (txtItem) {
        txtItem.content = liveText;
      }
    }
  } else {
    const items = [];
    const imgs = card.querySelectorAll('img');
    imgs.forEach(img => {
      items.push({
        id: 'item_img_' + Date.now() + Math.random().toString(36).substr(2, 4),
        type: 'image',
        src: img.src,
        caption: img.alt || title,
        width: Math.min(width - 40, 420)
      });
    });
    if (liveText) {
      items.push({
        id: 'item_text_' + Date.now(),
        type: 'text',
        content: liveText
      });
    }
    newBlock = {
      id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'note_container',
      x: spawnX,
      y: spawnY,
      width: Math.max(340, Math.min(640, width)),
      title: title,
      items: items.length > 0 ? items : [{ id: 'item_text_' + Date.now(), type: 'text', content: '' }]
    };
  }

  // Remove card element from DOM and sync parent note
  const parentText = card.closest('.note-item-text') || textDiv;
  card.remove();
  if (parentText) {
    parentText._dirty = true;
    if (typeof parentText._syncContent === 'function') {
      parentText._syncContent(true);
    }
    if (parentBlock) {
      let ptItem = (parentBlock.items || []).find(it => it.type === 'text' || !it.type);
      if (ptItem) ptItem.content = parentText.innerHTML;
    }
  }

  state.doc.addBlock(newBlock);
  state.activeContainerId = newBlock.id;
  state.selectedBlockIds?.clear();
  state.selectedBlockIds?.add(newBlock.id);

  if (beforeSnap) state.history?.recordSnapshot(state.doc, beforeSnap);
  if (window.saveActivePageDocument) window.saveActivePageDocument();
  if (window.renderAll) window.renderAll();
  if (window.showToast) window.showToast('🪟 Card popped out to canvas note');
}
