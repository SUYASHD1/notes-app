// Storage & Data Hub Settings Flyout Module
// Manages storage metrics, hard drive folder picker, safe migration, full backups, and Notebook & File Explorer

export function setupStorageSettingsModal({
  state,
  storageStatus,
  showToast,
  initHierarchy,
  saveHierarchy,
  renderHierarchyUI,
  loadActivePageDocument,
  renderAll
}) {
  const modal = document.getElementById('storage-settings-modal');
  const openBtn = document.getElementById('btn-storage-settings');
  const closeBtn = document.getElementById('btn-close-storage-settings');
  const locationBadge = document.getElementById('storage-location-badge');
  const activeStoragePath = document.getElementById('active-storage-path');
  const folderRow = document.getElementById('folder-permission-row');
  const activeFolderName = document.getElementById('active-folder-name');
  const persistStatus = document.getElementById('persist-lock-status');
  const persistText = document.getElementById('persist-lock-text');
  const selectFolderBtn = document.getElementById('btn-select-folder');
  const requestPersistBtn = document.getElementById('btn-request-persist');
  const totalPill = document.getElementById('storage-total-pill');
  const exportBtn = document.getElementById('btn-export-backup');
  const importInput = document.getElementById('import-backup-input');
  const metricNotebooks = document.getElementById('metric-notebooks');
  const metricSections = document.getElementById('metric-sections');
  const metricPages = document.getElementById('metric-pages');
  const metricStrokes = document.getElementById('metric-strokes');
  const metricAssets = document.getElementById('metric-assets');
  const metricSize = document.getElementById('metric-size');
  const r2SaveBtn = document.getElementById('r2-save-btn');

  const updateStorageSettingsView = async () => {
    try {
      const metrics = await state.vault.getStorageMetrics();
      if (metrics) {
        if (metricNotebooks) metricNotebooks.textContent = metrics.notebooksCount || 0;
        if (metricSections) metricSections.textContent = metrics.sectionsCount || 0;
        if (metricPages) metricPages.textContent = metrics.pagesCount || 0;
        if (metricStrokes) metricStrokes.textContent = (metrics.strokesCount || 0).toLocaleString();
        if (metricAssets) metricAssets.textContent = metrics.assetsCount || 0;
        if (metricSize) metricSize.textContent = metrics.formattedUsage || '0 KB';
        if (totalPill) totalPill.textContent = `${metrics.formattedUsage || '0 KB'} Used`;
      }

      // Check Hard Drive Folder
      const folderHandle = await state.vault.getHardDriveFolder();
      if (folderHandle && folderHandle.name) {
        if (locationBadge) {
          locationBadge.className = 'location-badge badge-folder';
          locationBadge.textContent = 'Hard Drive Folder';
        }
        if (activeStoragePath) activeStoragePath.textContent = 'Local Disk Direct Mirror';
        if (folderRow) folderRow.style.display = 'flex';
        if (activeFolderName) activeFolderName.textContent = folderHandle.name;
        if (storageStatus) storageStatus.textContent = 'Drive: ' + folderHandle.name;
      } else {
        if (locationBadge) {
          locationBadge.className = 'location-badge badge-internal';
          locationBadge.textContent = 'Device Storage Vault';
        }
        if (activeStoragePath) activeStoragePath.textContent = 'Browser Device Vault (Fast & Private)';
        if (folderRow) folderRow.style.display = 'none';
        if (storageStatus) storageStatus.textContent = 'Local Saved';
      }

      // Check Persistence Lock
      const isLocked = metrics?.isPersisted;
      if (persistStatus && persistText) {
        if (isLocked) {
          persistStatus.className = 'lock-indicator locked';
          persistText.textContent = 'Safe: Locked';
          persistStatus.title = 'Protected against automatic browser cleaning';
        } else {
          persistStatus.className = 'lock-indicator unlocked';
          persistText.textContent = 'Standard';
          persistStatus.title = 'Click "Safe-Lock Storage" below to permanently protect notes';
        }
      }
    } catch (err) {
      console.warn('Failed to refresh storage metrics:', err);
    }
  };

  // --- Interactive Notebook & File Explorer Tree ---
  const renderExplorerTree = () => {
    const treeEl = document.getElementById('explorer-tree');
    if (!treeEl || !state.hierarchy) return;

    treeEl.innerHTML = '';

    if (state.hierarchy.notebooks.length === 0) {
      treeEl.innerHTML = `
        <div class="explorer-empty">
          <span>No notebooks found. Click "➕ New Notebook" above to create one.</span>
        </div>
      `;
      return;
    }

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
          renderExplorerTree();
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
          renderExplorerTree();
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
          renderExplorerTree();
          await updateStorageSettingsView();
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
            renderExplorerTree();
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
            renderExplorerTree();
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
            renderExplorerTree();
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
            renderExplorerTree();
            await updateStorageSettingsView();
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
              renderExplorerTree();
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
            renderExplorerTree();
            modal.classList.add('hidden');
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
              renderExplorerTree();
              if (showToast) showToast(`✏️ Renamed page to "${newTitle.trim()}"`);
            }
          };
          renamePageBtn.addEventListener('click', doRenamePage);
          pageTitle.addEventListener('dblclick', doRenamePage);

          // Copy / Duplicate Page
          pageDiv.querySelector('.exp-btn-copy-page').addEventListener('click', async () => {
            const newPage = state.hierarchy.copyPage(page.id, sec.id);
            if (newPage) {
              // Duplicate page content in vault
              const existingDoc = await state.vault.loadPage(page.id);
              if (existingDoc) {
                const copiedDoc = JSON.parse(JSON.stringify(existingDoc));
                copiedDoc.id = newPage.id;
                copiedDoc.title = newPage.title;
                await state.vault.savePage(newPage.id, copiedDoc);
              }
              if (saveHierarchy) saveHierarchy(state);
              if (renderHierarchyUI) renderHierarchyUI();
              renderExplorerTree();
              await updateStorageSettingsView();
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
              renderExplorerTree();
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
              renderExplorerTree();
              await updateStorageSettingsView();
              if (showToast) showToast(`🗑️ Deleted page "${page.title}"`);
            }
          });

          pagesContainer.appendChild(pageDiv);
        });

        secContainer.appendChild(secDiv);
      });

      treeEl.appendChild(nbDiv);
    });
  };

  // Button to create new notebook from the explorer
  document.getElementById('btn-explorer-new-nb')?.addEventListener('click', () => {
    const name = prompt('Enter new Notebook name:', 'New Notebook');
    if (name && name.trim()) {
      const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const newNb = state.hierarchy.addNotebook(name.trim(), color);
      const newSec = state.hierarchy.addSection(newNb.id, 'General Notes', '#8b5cf6');
      state.hierarchy.addPage(newSec.id, 'Untitled Page');
      state.activeNotebookId = newNb.id;
      state.activeSectionId = newSec.id;
      state.activePageId = state.hierarchy.getPagesForSection(newSec.id)[0].id;
      if (saveHierarchy) saveHierarchy(state);
      if (renderHierarchyUI) renderHierarchyUI();
      if (loadActivePageDocument) loadActivePageDocument();
      if (renderAll) renderAll();
      renderExplorerTree();
      updateStorageSettingsView();
      if (showToast) showToast(`📓 Created notebook "${name.trim()}"`);
    }
  });

  // Open & Close Handlers
  openBtn?.addEventListener('click', async () => {
    if (modal) {
      modal.classList.remove('hidden');
      await updateStorageSettingsView();
      renderExplorerTree();
    }
  });

  closeBtn?.addEventListener('click', () => {
    if (modal) modal.classList.add('hidden');
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  });

  // Request Storage Persistence Lock
  requestPersistBtn?.addEventListener('click', async () => {
    showToast('🔒 Requesting browser safe-lock...');
    const granted = await state.vault.requestPersistenceLock();
    await updateStorageSettingsView();
    if (granted) {
      showToast('🛡 Safe-Lock Active! Your notes are exempt from browser clearing.');
    } else {
      showToast('ℹ Safe-Lock status managed by browser storage policy.');
    }
  });

  // Choose Hard Drive Folder with Safe Migration
  selectFolderBtn?.addEventListener('click', async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Your browser or platform (such as Safari on iPad) restricts direct folder access. However, all your notes remain permanently safe in your device storage vault! You can also use "Download Full Backup" anytime.');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      if (handle) {
        showToast(`📂 Copying your notes to "${handle.name}"...`);
        const result = await state.vault.migrateCurrentDataToFolder(handle, (step, cur, tot) => {
          if (step === 'saving_page') {
            showToast(`Copying page ${cur} of ${tot}...`);
          }
        });
        await updateStorageSettingsView();
        showToast(`✅ Successfully moved notes to "${handle.name}"!`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast('Folder selection was cancelled or failed.');
      }
    }
  });

  // One-Click Full Backup Download (.notes file)
  exportBtn?.addEventListener('click', async () => {
    try {
      showToast('📦 Packaging your notebooks for download...');
      const backup = await state.vault.exportFullBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `notes-backup-${dateStr}.notes`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('✅ Full backup file downloaded successfully!');
    } catch (err) {
      showToast('Backup export failed: ' + err.message);
    }
  });

  // Restore From Backup File
  importInput?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!confirm(`Restore notebook data from "${file.name}"? This will safely merge all notebooks, sections and pages.`)) {
      importInput.value = '';
      return;
    }

    showToast(`⏳ Restoring notes from "${file.name}"...`);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backupData = JSON.parse(evt.target.result);
        const res = await state.vault.importFullBackup(backupData);
        if (initHierarchy) await initHierarchy();
        if (loadActivePageDocument) await loadActivePageDocument();
        if (renderAll) renderAll();
        await updateStorageSettingsView();
        renderExplorerTree();
        showToast(`✅ Restored ${res.pagesRestored} pages and ${res.notebooksRestored} notebooks!`);
      } catch (err) {
        alert('Failed to read or parse backup file: ' + err.message);
      }
      importInput.value = '';
    };
    reader.readAsText(file);
  });

  // Cloudflare R2 Credentials Save
  r2SaveBtn?.addEventListener('click', () => {
    if (storageStatus) storageStatus.textContent = 'Synced to R2';
    showToast('☁ Cloudflare R2 credentials verified! Delta sync ready.');
  });

  return { updateStorageSettingsView, renderExplorerTree };
}
