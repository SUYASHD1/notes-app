// Full Portable Notebook Collection (.notes) Backup & Restore Engine

export async function exportFullBackup(vault) {
  await vault.init();
  const hierarchy = await vault.loadHierarchy();
  const pages = await vault.getAllPages();
  const activeNotebookId = await vault.getSetting('activeNotebookId');
  const activeSectionId = await vault.getSetting('activeSectionId');
  const activePageId = await vault.getSetting('activePageId');

  return {
    appName: 'NotesApp',
    version: '1.0',
    exportedAt: Date.now(),
    exportedAtFormatted: new Date().toISOString(),
    hierarchy: hierarchy || { notebooks: [], sections: [], pages: [] },
    pages: pages || [],
    settings: {
      activeNotebookId,
      activeSectionId,
      activePageId
    }
  };
}

export async function importFullBackup(vault, backupData) {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Invalid backup data format');
  }

  await vault.init();

  // 1. Restore hierarchy
  if (backupData.hierarchy) {
    await vault.saveHierarchy(backupData.hierarchy);
  }

  // 2. Restore all pages
  let pageCount = 0;
  if (Array.isArray(backupData.pages)) {
    for (const page of backupData.pages) {
      if (page && page.id) {
        await vault.savePage(page.id, page);
        pageCount++;
      }
    }
  }

  // 3. Restore settings
  if (backupData.settings) {
    if (backupData.settings.activeNotebookId) await vault.saveSetting('activeNotebookId', backupData.settings.activeNotebookId);
    if (backupData.settings.activeSectionId) await vault.saveSetting('activeSectionId', backupData.settings.activeSectionId);
    if (backupData.settings.activePageId) await vault.saveSetting('activePageId', backupData.settings.activePageId);
  }

  return {
    success: true,
    notebooksRestored: backupData.hierarchy?.notebooks?.length || 0,
    sectionsRestored: backupData.hierarchy?.sections?.length || 0,
    pagesRestored: pageCount
  };
}
