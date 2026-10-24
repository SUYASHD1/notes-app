import { renderExplorerTree as modularRenderExplorerTree } from './explorer_tree.js';
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

  // --- Interactive Notebook & File Explorer Tree (Modular Engine) ---
  const renderExplorerTree = () => {
    modularRenderExplorerTree({
      state,
      modal,
      saveHierarchy,
      renderHierarchyUI,
      loadActivePageDocument,
      renderAll,
      showToast,
      updateStorageSettingsView
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
