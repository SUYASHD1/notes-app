// Interactive Notebook, Section & Page File Explorer Tree with Drag-and-Drop
export function renderExplorerTree(options = {}) {
  const {
    state,
    modal = document.getElementById('storage-settings-modal'),
    saveHierarchy,
    renderHierarchyUI,
    loadActivePageDocument,
    renderAll,
    showToast,
    updateStorageSettingsView
  } = options;

  const treeEl = document.getElementById('explorer-tree');
  if (!treeEl || !state?.hierarchy) return;

  treeEl.innerHTML = '';

  if (state.hierarchy.notebooks.length === 0) {
    treeEl.innerHTML = `
      <div class="explorer-empty">
        <span>No notebooks found. Click "➕ New Notebook" above to create one.</span>
      </div>
    `;
    return;
  }

  const rerender = () => renderExplorerTree(options);

  state.hierarchy.notebooks.forEach((nb) => {
    const nbDiv = document.createElement('div');
    nbDiv.className = 'explorer-nb-card';
    nbDiv.dataset.nbId = nb.id;

    const isCurrentNb = nb.id === state.activeNotebookId;
    const sections = state.hierarchy.getSectionsForNotebook(nb.id);

    nbDiv.innerHTML = `
      <div class="explorer-nb-header ${isCurrentNb ? 'active-nb' : ''}">
        <div class="explorer-header-left">
          <span class="explorer-toggle-chevron">▾</span>
          <span class="explorer-icon">📓</span>
          <span class="explorer-title nb-title" title="Double click to rename">${nb.name}</span>
          <span class="explorer-count-badge">${sections.length} ${sections.length === 1 ? 'section' : 'sections'}</span>
        </div>
        <div class="explorer-actions">
          <button class="exp-btn exp-btn-add" title="Add Section to Notebook">+ Section</button>
          <button class="exp-btn exp-btn-rename" title="Rename Notebook">✏️</button>
          <button class="exp-btn exp-btn-delete" title="Delete Notebook">🗑️</button>
        </div>
      </div>
      <div class="explorer-sections-container"></div>
    `;

    // Chevron collapse/expand
    const chevron = nbDiv.querySelector('.explorer-toggle-chevron');
    const secContainer = nbDiv.querySelector('.explorer-sections-container');
    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      secContainer.classList.toggle('hidden');
      chevron.textContent = secContainer.classList.contains('hidden') ? '▸' : '▾';
    });

    // Rename Notebook
    const renameBtn = nbDiv.querySelector('.exp-btn-rename');
    const nbTitle = nbDiv.querySelector('.nb-title');
    const doRenameNb = () => {
      const newName = prompt(`Rename notebook "${nb.name}" to:`, nb.name);
      if (newName && newName.trim() && newName.trim() !== nb.name) {
        state.hierarchy.renameNotebook(nb.id, newName.trim());
        if (saveHierarchy) saveHierarchy(state);
        if (renderHierarchyUI) renderHierarchyUI();
        rerender();
        if (showToast) showToast(`✏️ Renamed notebook to "${newName.trim()}"`);
      }
    };
    renameBtn.addEventListener('click', doRenameNb);
    nbTitle.addEventListener('dblclick', doRenameNb);

    // Add Section
    nbDiv.querySelector('.exp-btn-add').addEventListener('click', () => {
      const secName = prompt(`Enter new section name for "${nb.name}":`, 'New Section');
      if (secName && secName.trim()) {
        const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const newSec = state.hierarchy.addSection(nb.id, secName.trim(), color);
        state.hierarchy.addPage(newSec.id, 'Untitled Page');
        if (saveHierarchy) saveHierarchy(state);
        if (renderHierarchyUI) renderHierarchyUI();
        rerender();
        if (showToast) showToast(`📁 Added section "${secName.trim()}"`);
      }
    });

    // Delete Notebook
    nbDiv.querySelector('.exp-btn-delete').addEventListener('click', async () => {
      if (confirm(`Delete notebook "${nb.name}" and ALL its sections and pages? This cannot be undone.`)) {
        state.hierarchy.deleteNotebook(nb.id);
        if (state.hierarchy.notebooks.length === 0) {
          const freshNb = state.hierarchy.addNotebook('My Notebook', '#6366f1');
          const freshSec = state.hierarchy.addSection(freshNb.id, 'General Notes', '#8b5cf6');
          state.hierarchy.addPage(freshSec.id, 'Untitled Page');
        }
        if (state.activeNotebookId === nb.id) {
          state.activeNotebookId = state.hierarchy.notebooks[0].id;
          const remainingSecs = state.hierarchy.getSectionsForNotebook(state.activeNotebookId);
          state.activeSectionId = remainingSecs.length ? remainingSecs[0].id : null;
          const remainingPages = state.activeSectionId ? state.hierarchy.getPagesForSection(state.activeSectionId) : [];
          state.activePageId = remainingPages.length ? remainingPages[0].id : null;
        }
        if (saveHierarchy) saveHierarchy(state);
        if (renderHierarchyUI) renderHierarchyUI();
        if (loadActivePageDocument) await loadActivePageDocument();
        if (renderAll) renderAll();
        rerender();
        if (updateStorageSettingsView) await updateStorageSettingsView();
        if (showToast) showToast(`🗑️ Deleted notebook "${nb.name}"`);
      }
    });

    // Render sections for this notebook
    sections.forEach((sec) => {
      const secDiv = document.createElement('div');
      secDiv.className = 'explorer-sec-card';
      secDiv.dataset.secId = sec.id;
      const isCurrentSec = sec.id === state.activeSectionId;
      const pages = state.hierarchy.getPagesForSection(sec.id);

      secDiv.innerHTML = `
        <div class="explorer-sec-header ${isCurrentSec ? 'active-sec' : ''}">
          <div class="explorer-header-left">
            <span class="sec-dot" style="background: ${sec.color || '#8b5cf6'};"></span>
            <span class="explorer-icon">📂</span>
            <span class="explorer-title sec-title" title="Double click to rename">${sec.name}</span>
            <span class="explorer-count-badge">${pages.length} ${pages.length === 1 ? 'page' : 'pages'}</span>
          </div>
          <div class="explorer-actions">
            <button class="exp-btn exp-btn-add-page" title="Add Page to Section">+ Page</button>
            <button class="exp-btn exp-btn-move-sec" title="Move Section to Another Notebook">➡️ Move</button>
            <button class="exp-btn exp-btn-rename-sec" title="Rename Section">✏️</button>
            <button class="exp-btn exp-btn-delete-sec" title="Delete Section">🗑️</button>
          </div>
        </div>
        <div class="explorer-pages-container"></div>
      `;

      // Section Rename
      const renameSecBtn = secDiv.querySelector('.exp-btn-rename-sec');
      const secTitle = secDiv.querySelector('.sec-title');
      const doRenameSec = () => {
        const newName = prompt(`Rename section "${sec.name}" to:`, sec.name);
        if (newName && newName.trim() && newName.trim() !== sec.name) {
          state.hierarchy.renameSection(sec.id, newName.trim());
          if (saveHierarchy) saveHierarchy(state);
          if (renderHierarchyUI) renderHierarchyUI();
          rerender();
          if (showToast) showToast(`✏️ Renamed section to "${newName.trim()}"`);
        }
      };
      renameSecBtn.addEventListener('click', doRenameSec);
      secTitle.addEventListener('dblclick', doRenameSec);

      // Move Section to another notebook
      secDiv.querySelector('.exp-btn-move-sec').addEventListener('click', () => {
        const otherNbs = state.hierarchy.notebooks.filter(n => n.id !== nb.id);
        if (otherNbs.length === 0) {
          alert('Create another notebook first to move sections between notebooks.');
          return;
        }
        const optionsText = otherNbs.map((n, i) => `${i + 1}. ${n.name}`).join('\n');
        const choice = prompt(`Move section "${sec.name}" to which notebook?\n\n${optionsText}\nEnter notebook number (1-${otherNbs.length}):`);
        const num = parseInt(choice, 10);
        if (!isNaN(num) && num >= 1 && num <= otherNbs.length) {
          const targetNb = otherNbs[num - 1];
          state.hierarchy.moveSection(sec.id, targetNb.id);
          if (saveHierarchy) saveHierarchy(state);
          if (renderHierarchyUI) renderHierarchyUI();
          rerender();
          if (showToast) showToast(`➡️ Moved section "${sec.name}" to "${targetNb.name}"`);
        }
      });

      // Add Page to Section
      secDiv.querySelector('.exp-btn-add-page').addEventListener('click', async () => {
        const pageTitle = prompt(`Enter new page title for "${sec.name}":`, 'Untitled Page');
        if (pageTitle && pageTitle.trim()) {
          const newPage = state.hierarchy.addPage(sec.id, pageTitle.trim());
          state.activeNotebookId = nb.id;
          state.activeSectionId = sec.id;
          state.activePageId = newPage.id;
          if (saveHierarchy) saveHierarchy(state);
          if (renderHierarchyUI) renderHierarchyUI();
          if (loadActivePageDocument) await loadActivePageDocument();
          if (renderAll) renderAll();
          rerender();
          if (showToast) showToast(`📄 Created blank page "${pageTitle.trim()}"`);
        }
      });

      // Delete Section
      secDiv.querySelector('.exp-btn-delete-sec').addEventListener('click', async () => {
        if (confirm(`Delete section "${sec.name}" and all its pages?`)) {
          state.hierarchy.deleteSection(sec.id);
          const remainingSecs = state.hierarchy.getSectionsForNotebook(nb.id);
          if (state.activeSectionId === sec.id) {
            state.activeSectionId = remainingSecs.length ? remainingSecs[0].id : null;
            const remainingPages = state.activeSectionId ? state.hierarchy.getPagesForSection(state.activeSectionId) : [];
            state.activePageId = remainingPages.length ? remainingPages[0].id : null;
          }
          if (saveHierarchy) saveHierarchy(state);
          if (renderHierarchyUI) renderHierarchyUI();
          if (loadActivePageDocument) await loadActivePageDocument();
          if (renderAll) renderAll();
          rerender();
          if (updateStorageSettingsView) await updateStorageSettingsView();
          if (showToast) showToast(`🗑️ Deleted section "${sec.name}"`);
        }
      });

      // Drag target on Section to accept dragged Pages
      secDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        secDiv.classList.add('drag-hover');
      });
      secDiv.addEventListener('dragleave', () => secDiv.classList.remove('drag-hover'));
      secDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        secDiv.classList.remove('drag-hover');
        const draggedPageId = e.dataTransfer.getData('text/plain');
        if (draggedPageId) {
          const moved = state.hierarchy.movePage(draggedPageId, sec.id);
          if (moved) {
            if (saveHierarchy) saveHierarchy(state);
            if (renderHierarchyUI) renderHierarchyUI();
            rerender();
            if (showToast) showToast(`🚚 Moved page into section "${sec.name}"`);
          }
        }
      });

      // Render Pages inside this section
      const pagesContainer = secDiv.querySelector('.explorer-pages-container');
      pages.forEach((page) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = `explorer-page-row ${page.id === state.activePageId ? 'active-page' : ''}`;
        pageDiv.draggable = true;
        pageDiv.dataset.pageId = page.id;

        pageDiv.innerHTML = `
          <div class="explorer-header-left">
            <span class="explorer-drag-handle" title="Drag to move page">⋮⋮</span>
            <span class="explorer-icon">📄</span>
            <span class="explorer-title page-title" title="Double click to rename">${page.title}</span>
          </div>
          <div class="explorer-actions">
            <button class="exp-btn exp-btn-open-page" title="Open this page">Open</button>
            <button class="exp-btn exp-btn-copy-page" title="Duplicate / Copy Page">📋 Copy</button>
            <button class="exp-btn exp-btn-move-page" title="Move to Section">➡️ Move</button>
            <button class="exp-btn exp-btn-rename-page" title="Rename Page">✏️</button>
            <button class="exp-btn exp-btn-delete-page" title="Delete Page">🗑️</button>
          </div>
        `;

        // Drag Start
        pageDiv.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', page.id);
          e.dataTransfer.effectAllowed = 'move';
          pageDiv.classList.add('dragging');
        });
        pageDiv.addEventListener('dragend', () => pageDiv.classList.remove('dragging'));

        // Open Page
        pageDiv.querySelector('.exp-btn-open-page').addEventListener('click', async () => {
          state.activeNotebookId = nb.id;
          state.activeSectionId = sec.id;
          state.activePageId = page.id;
          if (saveHierarchy) saveHierarchy(state);
          if (renderHierarchyUI) renderHierarchyUI();
          if (loadActivePageDocument) await loadActivePageDocument();
          if (renderAll) renderAll();
          rerender();
          if (modal) modal.classList.add('hidden');
        });

        // Rename Page
        const renamePageBtn = pageDiv.querySelector('.exp-btn-rename-page');
        const pageTitle = pageDiv.querySelector('.page-title');
        const doRenamePage = () => {
          const newTitle = prompt(`Rename page "${page.title}" to:`, page.title);
          if (newTitle && newTitle.trim() && newTitle.trim() !== page.title) {
            state.hierarchy.renamePage(page.id, newTitle.trim());
            if (saveHierarchy) saveHierarchy(state);
            if (renderHierarchyUI) renderHierarchyUI();
            rerender();
            if (showToast) showToast(`✏️ Renamed page to "${newTitle.trim()}"`);
          }
        };
        renamePageBtn.addEventListener('click', doRenamePage);
        pageTitle.addEventListener('dblclick', doRenamePage);

        // Copy / Duplicate Page
        pageDiv.querySelector('.exp-btn-copy-page').addEventListener('click', async () => {
          const newPage = state.hierarchy.copyPage(page.id, sec.id);
          if (newPage) {
            const existingDoc = await state.vault.loadPage(page.id);
            if (existingDoc) {
              const copiedDoc = JSON.parse(JSON.stringify(existingDoc));
              copiedDoc.id = newPage.id;
              copiedDoc.title = newPage.title;
              await state.vault.savePage(newPage.id, copiedDoc);
            }
            if (saveHierarchy) saveHierarchy(state);
            if (renderHierarchyUI) renderHierarchyUI();
            rerender();
            if (updateStorageSettingsView) await updateStorageSettingsView();
            if (showToast) showToast(`📋 Duplicated page "${page.title}"`);
          }
        });

        // Move Page
        pageDiv.querySelector('.exp-btn-move-page').addEventListener('click', () => {
          const allSecs = state.hierarchy.sections.filter(s => s.id !== sec.id);
          if (allSecs.length === 0) {
            alert('Create another section first to move pages between sections.');
            return;
          }
          const optionsText = allSecs.map((s, i) => {
            const pNb = state.hierarchy.notebooks.find(n => n.id === s.notebookId);
            return `${i + 1}. [${pNb ? pNb.name : 'Notebook'}] > ${s.name}`;
          }).join('\n');
          const choice = prompt(`Move page "${page.title}" to which section?\n\n${optionsText}\nEnter section number (1-${allSecs.length}):`);
          const num = parseInt(choice, 10);
          if (!isNaN(num) && num >= 1 && num <= allSecs.length) {
            const targetSec = allSecs[num - 1];
            state.hierarchy.movePage(page.id, targetSec.id);
            if (saveHierarchy) saveHierarchy(state);
            if (renderHierarchyUI) renderHierarchyUI();
            rerender();
            if (showToast) showToast(`🚚 Moved page to "${targetSec.name}"`);
          }
        });

        // Delete Page
        pageDiv.querySelector('.exp-btn-delete-page').addEventListener('click', async () => {
          if (confirm(`Delete page "${page.title}"?`)) {
            await state.vault.deletePage(page.id);
            state.hierarchy.deletePage(page.id);
            const remainingPages = state.hierarchy.getPagesForSection(sec.id);
            if (state.activePageId === page.id) {
              state.activePageId = remainingPages.length ? remainingPages[0].id : null;
            }
            if (saveHierarchy) saveHierarchy(state);
            if (renderHierarchyUI) renderHierarchyUI();
            if (loadActivePageDocument) await loadActivePageDocument();
            if (renderAll) renderAll();
            rerender();
            if (updateStorageSettingsView) await updateStorageSettingsView();
            if (showToast) showToast(`🗑️ Deleted page "${page.title}"`);
          }
        });

        pagesContainer.appendChild(pageDiv);
      });

      secContainer.appendChild(secDiv);
    });

    treeEl.appendChild(nbDiv);
  });
}
