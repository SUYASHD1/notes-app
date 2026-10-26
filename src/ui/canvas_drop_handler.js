import { popOutNestedCard } from '../blocks/element_drag_helper.js';

/**
 * Handles canvas dragover & drop for file imports and popping out cards/images onto canvas.
 */
export function setupCanvasDrop({
  container,
  state,
  createNewNoteContainer,
  AddBlockCommand,
  saveActivePageDocument,
  renderAll,
  showToast
}) {
  if (!container) return;

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const hasInNote = (e.dataTransfer?.types && (e.dataTransfer.types.includes('application/notes-in-note-img') || e.dataTransfer.types.includes('application/notes-nested-card'))) || window.__activeInNoteDrag;
    e.dataTransfer.dropEffect = hasInNote ? 'move' : 'copy';
  });

  container.addEventListener('drop', (e) => {
    if (e.target && e.target.closest && e.target.closest('.universal-note-container')) {
      return;
    }

    e.preventDefault();

    // Check if dropped item was a nested card dragged OUT of its container
    const inNoteCardRaw = e.dataTransfer ? e.dataTransfer.getData('application/notes-nested-card') : null;
    let cardData = null;
    if (inNoteCardRaw) {
      try { cardData = JSON.parse(inNoteCardRaw); } catch (_) {}
    }
    if (!cardData && window.__activeInNoteDrag && window.__activeInNoteDrag.isCard) {
      cardData = window.__activeInNoteDrag;
    }
    if (cardData && cardData.element) {
      popOutNestedCard(cardData.element, null);
      window.__activeInNoteDrag = null;
      return;
    }

    // Check if dropped item was an in-note image dragged OUT of its container (Automatic Pop-Out)
    const inNoteImgRaw = e.dataTransfer ? e.dataTransfer.getData('application/notes-in-note-img') : null;
    let imgData = null;
    if (inNoteImgRaw) {
      try { imgData = JSON.parse(inNoteImgRaw); } catch (_) {}
    }
    if (!imgData && window.__activeInNoteDrag) {
      imgData = window.__activeInNoteDrag;
    }

    if (imgData) {
      try {
        const rect = container.getBoundingClientRect();
        const dropWorld = state.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        // Remove the image element from its source container
        if (imgData.element && imgData.element.parentNode) {
          imgData.element.remove();
        } else if (imgData.sourceBlockId) {
          const sourceEl = document.getElementById(imgData.sourceBlockId);
          const sourceTextDiv = sourceEl ? sourceEl.querySelector('.note-item-text') : null;
          if (sourceTextDiv) {
            const draggedImg = sourceTextDiv.querySelector('.dragging-element') || sourceTextDiv.querySelector(`.note-image-container[data-src="${CSS.escape(imgData.src)}"]`);
            if (draggedImg) draggedImg.remove();
            if (typeof sourceTextDiv._syncContent === 'function') sourceTextDiv._syncContent();
          }
        }

        const newNote = createNewNoteContainer(Math.round(dropWorld.x - 180), Math.round(dropWorld.y - 120), imgData.alt || 'NOTE');
        newNote.width = Math.max(340, Math.min(600, imgData.width || 420));
        newNote.items = [{
          id: 'item_img_' + Date.now(),
          type: 'image',
          src: imgData.src,
          caption: imgData.alt || 'Popped Out Image',
          width: imgData.width || 380
        }];
        state.history.execute(new AddBlockCommand(state.doc, newNote));
        state.activeContainerId = newNote.id;
        state.selectedBlockIds?.clear();
        state.selectedBlockIds?.add(newNote.id);
        window.__activeInNoteDrag = null;
        saveActivePageDocument();
        renderAll();
        showToast('🪟 Image popped out to canvas note');
        return;
      } catch (err) {
        console.warn('Pop-out drag failed:', err);
      }
    }

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const rect = container.getBoundingClientRect();
      const dropWorld = state.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          const newNote = createNewNoteContainer(dropWorld.x - 200, dropWorld.y - 100, file.name);
          newNote.items = [{
            id: 'item_img_' + Date.now(),
            type: 'image',
            src: loadEvt.target.result,
            caption: file.name
          }];
          state.history.execute(new AddBlockCommand(state.doc, newNote));
          saveActivePageDocument();
          renderAll();
          showToast(`🖼 Dropped image "${file.name}"`);
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.pdf')) {
        const newNote = createNewNoteContainer(dropWorld.x - 200, dropWorld.y - 100, file.name);
        newNote.items = [{
          id: 'item_pdf_' + Date.now(),
          type: 'pdf',
          title: file.name,
          totalPages: 3
        }];
        state.history.execute(new AddBlockCommand(state.doc, newNote));
        saveActivePageDocument();
        renderAll();
        showToast(`📑 Dropped PDF "${file.name}"`);
      }
    }
  });
}
