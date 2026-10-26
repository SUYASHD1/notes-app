// In-Note Element Drag Reordering (Tables & Images) (< 200 lines)

let activeDraggedElement = null;
let dropIndicator = null;

function getOrCreateDropIndicator(container) {
  if (!dropIndicator || !container.contains(dropIndicator)) {
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'note-drop-indicator';
    dropIndicator.contentEditable = 'false';
  }
  return dropIndicator;
}

export function removeDropIndicator() {
  if (dropIndicator && dropIndicator.parentNode) {
    dropIndicator.remove();
  }
}

/**
 * Finds the nearest child block within container for vertical drop positioning.
 */
function getNearestChildBlock(container, clientY) {
  const children = Array.from(container.children).filter(
    el => el !== dropIndicator && !el.classList.contains('embedded-img-toolbar')
  );

  let closest = null;
  let minDistance = Infinity;
  let placeAfter = false;

  for (const child of children) {
    const box = child.getBoundingClientRect();
    const midY = box.top + box.height / 2;
    const dist = Math.abs(clientY - midY);

    if (dist < minDistance) {
      minDistance = dist;
      closest = child;
      placeAfter = clientY > midY;
    }
  }

  return { closest, placeAfter };
}

/**
 * Binds Word-style move handles and selection to tables inside a rich text block.
 */
export function bindTableMoveHandles(textDiv, onContentChanged) {
  const tables = textDiv.querySelectorAll('table');
  tables.forEach(table => {
    let wrapper = table.closest('.note-table-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'note-table-wrapper';
      wrapper.contentEditable = 'false';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }

    let handle = wrapper.querySelector('.table-move-handle');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'table-move-handle';
      handle.contentEditable = 'false';
      handle.setAttribute('draggable', 'true');
      handle.title = 'Click to select / Drag to reposition table';
      handle.textContent = '✢';
      wrapper.insertBefore(handle, table);
    }

    handle.setAttribute('draggable', 'true');

    handle.onmousedown = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.note-table-wrapper.selected-table').forEach(w => w.classList.remove('selected-table'));
      wrapper.classList.add('selected-table');
    };

    handle.ondragstart = (e) => {
      e.stopPropagation();
      activeDraggedElement = wrapper;
      wrapper.classList.add('dragging-element');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'note-table');
    };

    handle.ondragend = () => {
      wrapper.classList.remove('dragging-element');
      activeDraggedElement = null;
      removeDropIndicator();
    };
  });
}

/**
 * Enables in-note drag-and-drop repositioning for images and tables.
 */
export function bindInNoteDragAndDrop(textDiv, onContentChanged) {
  // Retrospectively wrap any naked <img> elements inside textDiv into .note-image-container
  const unadornedImgs = textDiv.querySelectorAll('img:not(.note-image-container img):not(.embedded-img-toolbar img)');
  unadornedImgs.forEach(img => {
    if (!img.closest('.note-image-container')) {
      const wrap = document.createElement('div');
      wrap.className = 'note-image-container wrap-center';
      wrap.setAttribute('data-wrap', 'center');
      wrap.setAttribute('data-src', img.src);
      wrap.setAttribute('data-alt', img.alt || 'Image');
      wrap.setAttribute('contenteditable', 'false');
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
    }
  });

  // Bind image container drag handles
  const imageContainers = textDiv.querySelectorAll('.note-image-container');
  imageContainers.forEach(container => {
    container.setAttribute('contenteditable', 'false');
    container.setAttribute('draggable', 'true');

    container.ondragstart = (e) => {
      // Avoid drag if resizing
      if (e.target.classList.contains('embedded-img-resize-handle') || e.target.closest('.embedded-img-toolbar')) {
        e.preventDefault();
        return;
      }
      activeDraggedElement = container;
      container.classList.add('dragging-element');
      e.dataTransfer.effectAllowed = 'all';
      e.dataTransfer.setData('text/plain', 'note-image');

      const imgEl = container.querySelector('img');
      const src = container.getAttribute('data-src') || (imgEl ? imgEl.src : '');
      const alt = container.getAttribute('data-alt') || (imgEl ? imgEl.alt : 'Image');
      const wrap = container.getAttribute('data-wrap') || 'center';
      const width = container.offsetWidth || 360;
      const noteContainer = container.closest('.universal-note-container');
      const sourceBlockId = noteContainer ? noteContainer.id : null;

      const payload = { sourceBlockId, src, alt, wrap, width, element: container };
      window.__activeInNoteDrag = payload;
      e.dataTransfer.setData('application/notes-in-note-img', JSON.stringify(payload));
    };

    container.ondragend = () => {
      container.classList.remove('dragging-element');
      activeDraggedElement = null;
      window.__activeInNoteDrag = null;
      removeDropIndicator();
    };
  });

  // Bind nested cards inside textDiv
  const nestedCards = textDiv.querySelectorAll('.note-nested-card');
  nestedCards.forEach(card => {
    card.setAttribute('contenteditable', 'false');
    card.setAttribute('draggable', 'true');

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      textDiv.querySelectorAll('.selected-image, .selected-table, .selected-nested-card').forEach(el => {
        if (el !== card) el.classList.remove('selected-image', 'selected-table', 'selected-nested-card');
      });
      card.classList.add('selected-nested-card');
    });

    card.querySelectorAll('.nested-tool-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const action = btn.getAttribute('data-action');
        if (action === 'wrap-left' || action === 'wrap-center' || action === 'wrap-right') {
          const wrapMode = action.replace('wrap-', '');
          card.setAttribute('data-wrap', wrapMode);
          card.classList.remove('wrap-left', 'wrap-center', 'wrap-right');
          card.classList.add(`wrap-${wrapMode}`);
          card.querySelectorAll('.nested-tool-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (typeof onContentChanged === 'function') onContentChanged();
        } else if (action === 'delete') {
          card.remove();
          if (typeof onContentChanged === 'function') onContentChanged();
        } else if (action === 'pop-out') {
          popOutNestedCard(card, textDiv);
        }
      };
    });

    card.ondragstart = (e) => {
      activeDraggedElement = card;
      card.classList.add('dragging-element');
      e.dataTransfer.effectAllowed = 'all';
      e.dataTransfer.setData('text/plain', 'nested-card');

      const title = card.getAttribute('data-title') || 'Card';
      const width = card.offsetWidth || 420;
      const noteContainer = card.closest('.universal-note-container');
      const sourceBlockId = noteContainer ? noteContainer.id : null;
      const payload = {
        sourceBlockId,
        title,
        width,
        element: card,
        isCard: true
      };
      window.__activeInNoteDrag = payload;
      e.dataTransfer.setData('application/notes-nested-card', JSON.stringify(payload));
    };

    card.ondragend = () => {
      card.classList.remove('dragging-element');
      activeDraggedElement = null;
      window.__activeInNoteDrag = null;
      removeDropIndicator();
    };
  });

  // Handle Drag Over with Fluid Caret Positioning
  textDiv.ondragover = (e) => {
    const isOurDrag = activeDraggedElement || window.__activeInNoteDrag || (e.dataTransfer?.types && (e.dataTransfer.types.includes('application/notes-in-note-img') || e.dataTransfer.types.includes('application/notes-nested-card')));
    if (!isOurDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // 1. Fluid Caret Range Detection: place caret right between characters/words!
    let targetRange = null;
    if (document.caretRangeFromPoint) {
      targetRange = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        targetRange = document.createRange();
        targetRange.setStart(pos.offsetNode, pos.offset);
        targetRange.collapse(true);
      }
    }

    if (targetRange && textDiv.contains(targetRange.startContainer)) {
      if (!activeDraggedElement || !activeDraggedElement.contains(targetRange.startContainer)) {
        const indicator = getOrCreateDropIndicator(textDiv);
        indicator.classList.remove('block-indicator');
        try {
          targetRange.insertNode(indicator);
          return;
        } catch (_) {}
      }
    }

    // 2. Fallback: Between child blocks
    const nearest = getNearestChildBlock(textDiv, e.clientY);
    const indicator = getOrCreateDropIndicator(textDiv);
    indicator.classList.add('block-indicator');
    if (nearest.closest && nearest.closest !== indicator && nearest.closest !== activeDraggedElement) {
      if (nearest.placeAfter) {
        textDiv.insertBefore(indicator, nearest.closest.nextSibling);
      } else {
        textDiv.insertBefore(indicator, nearest.closest);
      }
    } else {
      textDiv.appendChild(indicator);
    }
  };

  // Handle Drag Leave
  textDiv.ondragleave = (e) => {
    if (e.relatedTarget && !textDiv.contains(e.relatedTarget)) {
      removeDropIndicator();
    }
  };

  // Handle Drop
  textDiv.ondrop = (e) => {
    const isOurDrag = activeDraggedElement || window.__activeInNoteDrag;
    if (!isOurDrag) return;
    e.preventDefault();
    e.stopPropagation();

    const elementToDrop = activeDraggedElement || (window.__activeInNoteDrag ? window.__activeInNoteDrag.element : null);
    const inNotePayload = window.__activeInNoteDrag;

    const noteContainer = textDiv.closest('.universal-note-container');
    const thisBlockId = noteContainer ? noteContainer.id : null;
    const isCrossContainer = inNotePayload && inNotePayload.sourceBlockId && inNotePayload.sourceBlockId !== thisBlockId;

    let targetEl = elementToDrop;
    if (isCrossContainer && inNotePayload && !inNotePayload.isCard) {
      if (elementToDrop && elementToDrop.parentNode) {
        elementToDrop.remove();
      }
      targetEl = document.createElement('div');
      targetEl.className = `note-image-container wrap-${inNotePayload.wrap || 'center'}`;
      targetEl.setAttribute('data-wrap', inNotePayload.wrap || 'center');
      targetEl.setAttribute('data-src', inNotePayload.src);
      targetEl.setAttribute('data-alt', inNotePayload.alt || 'Image');
      targetEl.setAttribute('contenteditable', 'false');
      targetEl.innerHTML = `<img class="note-embedded-image" src="${inNotePayload.src}" alt="${inNotePayload.alt || 'Image'}" loading="lazy" />`;
    }

    if (!targetEl) return;

    if (dropIndicator && dropIndicator.parentNode) {
      dropIndicator.parentNode.insertBefore(targetEl, dropIndicator);
      dropIndicator.remove();
    } else {
      textDiv.appendChild(targetEl);
    }

    targetEl.classList.remove('dragging-element');
    activeDraggedElement = null;
    window.__activeInNoteDrag = null;
    removeDropIndicator();
    textDiv.normalize();

    if (typeof onContentChanged === 'function') {
      onContentChanged();
    }
  };
}

export function dockWholeBoxIntoContainer(sourceBlock, targetBlock, deps = {}) {
  const state = deps.state || window.state;
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const renderAll = deps.renderAll || window.renderAll;
  const showToast = deps.showToast || window.showToast;

  if (!sourceBlock || !targetBlock || sourceBlock.id === targetBlock.id) return;
  const beforeSnap = state?.history?.takeSnapshot(state.doc);

  if (!targetBlock.items) targetBlock.items = [];
  let textItem = targetBlock.items.find(it => it.type === 'text' || !it.type);
  if (!textItem) {
    textItem = { id: 'item_text_' + Date.now(), type: 'text', content: '' };
    targetBlock.items.push(textItem);
  }

  let cardHtml = '';
  (sourceBlock.items || []).forEach(it => {
    if (it.type === 'image' || it.src) {
      const src = it.src || it.url;
      const alt = it.caption || 'Image';
      cardHtml += `<div class="note-image-container wrap-center" data-wrap="center" data-src="${src}" data-alt="${alt}"><img class="note-embedded-image" src="${src}" alt="${alt}" loading="lazy" /></div>`;
    } else if (it.type === 'text' || !it.type) {
      cardHtml += `<div class="nested-text-segment">${it.content || ''}</div>`;
    }
  });

  const title = sourceBlock.title || 'Note Card';
  const nestedCardHtml = `\n\n<div class="note-nested-card wrap-center" data-wrap="center" data-title="${title}" contenteditable="false" draggable="true"><div class="nested-card-header"><span class="nested-card-drag-handle" title="Drag to reposition or pop out">:::</span><span class="nested-card-title">${title}</span><div class="nested-card-toolbar"><button class="nested-tool-btn" data-action="wrap-left" title="Wrap text around left">⬅️ Left</button><button class="nested-tool-btn active" data-action="wrap-center" title="Center card">⏸️ Center</button><button class="nested-tool-btn" data-action="wrap-right" title="Wrap text around right">➡️ Right</button><button class="nested-tool-btn btn-popout" data-action="pop-out" title="Pop out onto canvas">🪟 Pop Out</button><button class="nested-tool-btn btn-danger" data-action="delete" title="Delete card">🗑️</button></div></div><div class="nested-card-content">${cardHtml}</div></div>\n\n`;

  textItem.content = (textItem.content || '').trim() + nestedCardHtml;

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
  if (showToast) showToast('📥 Docked box into note as card');
}

export function popOutNestedCard(card, textDiv) {
  const state = window.state;
  if (!card || !state?.doc) return;
  const beforeSnap = state.history?.takeSnapshot(state.doc);
  const title = card.getAttribute('data-title') || 'Note Card';
  const width = card.offsetWidth || 440;
  const parentContainer = card.closest('.universal-note-container');
  const parentBlock = parentContainer ? state.doc.getBlock(parentContainer.id) : null;

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

  const textSegments = Array.from(card.querySelectorAll('.nested-text-segment, p, span'))
    .map(el => el.textContent.trim())
    .filter(Boolean);
  const textContent = textSegments.join('\n\n');
  if (textContent) {
    items.push({
      id: 'item_text_' + Date.now(),
      type: 'text',
      content: textContent
    });
  }
  if (items.length === 0) {
    items.push({
      id: 'item_text_' + Date.now(),
      type: 'text',
      content: card.querySelector('.nested-card-content')?.innerHTML || ''
    });
  }

  card.remove();
  if (textDiv && typeof textDiv._syncContent === 'function') {
    textDiv._syncContent();
  }

  const newBlock = {
    id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type: 'note_container',
    x: (parentBlock ? parentBlock.x : 100) + (parentBlock ? (parentBlock.width || 500) : 500) + 40,
    y: parentBlock ? parentBlock.y : 100,
    width: Math.max(340, Math.min(640, width)),
    title: title,
    items: items
  };

  state.doc.addBlock(newBlock);
  state.activeContainerId = newBlock.id;
  state.selectedBlockIds?.clear();
  state.selectedBlockIds?.add(newBlock.id);

  if (beforeSnap) state.history?.recordSnapshot(state.doc, beforeSnap);
  if (window.saveActivePageDocument) window.saveActivePageDocument();
  if (window.renderAll) window.renderAll();
  if (window.showToast) window.showToast('🪟 Card popped out to canvas note');
}
