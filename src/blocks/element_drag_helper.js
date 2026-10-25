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
  // Bind image container drag handles
  const imageContainers = textDiv.querySelectorAll('.note-image-container');
  imageContainers.forEach(container => {
    container.setAttribute('draggable', 'true');

    container.ondragstart = (e) => {
      // Avoid drag if resizing
      if (e.target.classList.contains('embedded-img-resize-handle') || e.target.closest('.embedded-img-toolbar')) {
        e.preventDefault();
        return;
      }
      activeDraggedElement = container;
      container.classList.add('dragging-element');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'note-image');
    };

    container.ondragend = () => {
      container.classList.remove('dragging-element');
      activeDraggedElement = null;
      removeDropIndicator();
    };
  });

  // Handle Drag Over
  textDiv.ondragover = (e) => {
    if (!activeDraggedElement) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const { closest, placeAfter } = getNearestChildBlock(textDiv, e.clientY);
    const indicator = getOrCreateDropIndicator(textDiv);

    if (closest) {
      if (placeAfter) {
        if (closest.nextSibling !== indicator) {
          textDiv.insertBefore(indicator, closest.nextSibling);
        }
      } else {
        if (closest !== indicator) {
          textDiv.insertBefore(indicator, closest);
        }
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
    if (!activeDraggedElement) return;
    e.preventDefault();

    const indicator = dropIndicator;
    if (indicator && indicator.parentNode === textDiv) {
      textDiv.insertBefore(activeDraggedElement, indicator);
      indicator.remove();
    } else {
      textDiv.appendChild(activeDraggedElement);
    }

    activeDraggedElement.classList.remove('dragging-element');
    activeDraggedElement = null;
    removeDropIndicator();

    if (typeof onContentChanged === 'function') {
      onContentChanged();
    }
  };
}
