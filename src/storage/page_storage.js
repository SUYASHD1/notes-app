// Active Page Document Persistence, Auto-Saving & Serialization Controller
import { DocumentModel } from '../core/document.js';
import { createBlankDocument, createSampleDocument } from '../core/sample_notebook.js';

export function getPageStorageKey(pageId) {
  return `notes_universal_page_${pageId || 'default'}`;
}

export function createPageStorageManager({ state, storageStatus, onSaveComplete }) {
  let saveTimer = null;

  async function loadActivePageDocument() {
    if (!state.activePageId) {
      state.doc = new DocumentModel({ title: 'New Note' });
      return;
    }

    state.vault.saveSetting('activePageId', state.activePageId);

    // 1. Load full document from LocalVault (IndexedDB)
    const vaultDoc = await state.vault.loadPage(state.activePageId);
    if (vaultDoc) {
      const parsed = DocumentModel.fromJSON(vaultDoc);
      // Legacy cleanup: If a non-demo page was polluted by the early prototype demo data, auto-clean to a blank canvas
      if (
        state.activePageId !== 'nb_physics_demo_p1' &&
        parsed.blocks &&
        parsed.blocks.some(b => b.title === 'Kinematics & Derivatives' || b.id === 'note_kinematics_1')
      ) {
        state.doc = createBlankDocument(state.activePageId);
        saveActivePageDocument(state.activePageId);
      } else {
        state.doc = parsed;
      }
    } else {
      // Fallback to localStorage for backward compatibility with initial prototype data
      const key = getPageStorageKey(state.activePageId);
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (raw) {
        try {
          const parsed = DocumentModel.fromJSON(raw);
          if (
            state.activePageId !== 'nb_physics_demo_p1' &&
            parsed.blocks &&
            parsed.blocks.some(b => b.title === 'Kinematics & Derivatives' || b.id === 'note_kinematics_1')
          ) {
            state.doc = createBlankDocument(state.activePageId);
          } else {
            state.doc = parsed;
          }
        } catch {
          state.doc = createBlankDocument(state.activePageId);
        }
      } else if (state.activePageId === 'nb_physics_demo_p1') {
        // Only the first demo page of the default sample notebook gets sample content
        state.doc = createSampleDocument(state.activePageId);
      } else {
        // All other pages start completely clean and blank
        state.doc = createBlankDocument(state.activePageId);
      }
      // Persist clean page into LocalVault
      saveActivePageDocument(state.activePageId);
    }

    if (state.doc.viewport) {
      state.viewport.x = state.doc.viewport.x ?? 40;
      state.viewport.y = state.doc.viewport.y ?? 40;
      state.viewport.zoom = state.doc.viewport.zoom ?? 1.0;
    }
    state.history.clear();
    state.selectedBlockIds.clear();
    state.activeContainerId = (state.mode !== 'ipad' && state.doc.blocks[0]) ? state.doc.blocks[0].id : null;
  }

  function debouncedSave(delay = 500) {
    if (saveTimer) clearTimeout(saveTimer);
    const targetId = state.activePageId;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveActivePageDocument(targetId);
    }, delay);
  }

  function saveActivePageDocument(targetPageId = state.activePageId) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const pageIdToSave = targetPageId || state.activePageId;
    if (!state.doc || !pageIdToSave) return;

    // Flush any dirty text editor content before committing document
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.note-item-text').forEach(el => {
        if (typeof el._syncContent === 'function') el._syncContent();
      });
    }

    state.doc.viewport = { x: state.viewport.x, y: state.viewport.y, zoom: state.viewport.zoom };
    const docJson = state.doc.toJSON();

    // 1. Always persist full fidelity asynchronously in LocalVault (IndexedDB)
    state.vault.savePage(pageIdToSave, docJson).catch(e => console.warn('LocalVault save warning:', e));

    // 2. Write to localStorage during idle time to prevent synchronous UI freezes
    const scheduleDiskWrite = (typeof window !== 'undefined' && window.requestIdleCallback)
      ? (cb) => window.requestIdleCallback(cb, { timeout: 1000 })
      : (cb) => setTimeout(cb, 20);

    scheduleDiskWrite(() => {
      if (typeof localStorage === 'undefined') return;
      try {
        const key = getPageStorageKey(pageIdToSave);
        localStorage.setItem(key, JSON.stringify(docJson));
      } catch (err) {
        try {
          const shallow = JSON.parse(JSON.stringify(docJson));
          if (shallow.blocks) {
            shallow.blocks.forEach(b => {
              if (b.items) {
                b.items.forEach(it => {
                  if (it.dataUrl && it.dataUrl.length > 50000) it.dataUrl = '';
                  if (it.src && it.src.length > 50000) it.src = '';
                });
              }
            });
          }
          localStorage.setItem(getPageStorageKey(pageIdToSave), JSON.stringify(shallow));
        } catch (_) {}
      }
    });

    if (storageStatus) {
      storageStatus.textContent = 'Saved locally';
      storageStatus.title = 'Saved to LocalVault at ' + new Date().toLocaleTimeString();
    }
    if (typeof onSaveComplete === 'function') onSaveComplete(pageIdToSave);
  }

  function flushPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      saveActivePageDocument();
    }
  }

  return {
    loadActivePageDocument,
    saveActivePageDocument,
    debouncedSave,
    flushPendingSave,
    getPageStorageKey
  };
}
