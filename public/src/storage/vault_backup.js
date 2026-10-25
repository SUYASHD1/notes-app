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

export async function importFullBackup(vault, backupData, options = {}) {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Invalid backup data format');
  }

  await vault.init();

  const existingHierarchy = (await vault.loadHierarchy()) || { notebooks: [], sections: [], pages: [] };
  const incomingHierarchy = backupData.hierarchy || { notebooks: [], sections: [], pages: [] };

  const isExistingEmpty =
    (!existingHierarchy.notebooks || existingHierarchy.notebooks.length === 0) &&
    (!existingHierarchy.pages || existingHierarchy.pages.length === 0);

  let mergedHierarchy;
  let pageCount = 0;
  let conflictDuplicates = 0;

  if (isExistingEmpty || options.overwrite) {
    // 1. Clean restore
    mergedHierarchy = {
      notebooks: incomingHierarchy.notebooks ? [...incomingHierarchy.notebooks] : [],
      sections: incomingHierarchy.sections ? [...incomingHierarchy.sections] : [],
      pages: incomingHierarchy.pages ? [...incomingHierarchy.pages] : []
    };

    if (Array.isArray(backupData.pages)) {
      for (const page of backupData.pages) {
        if (page && page.id) {
          await vault.savePage(page.id, page);
          pageCount++;
        }
      }
    }
  } else {
    // 2. Smart Merge Mode: Protect existing work and prevent accidental overwrites
    mergedHierarchy = {
      notebooks: [...(existingHierarchy.notebooks || [])],
      sections: [...(existingHierarchy.sections || [])],
      pages: [...(existingHierarchy.pages || [])]
    };

    // Merge Notebooks without duplicating identical IDs
    if (Array.isArray(incomingHierarchy.notebooks)) {
      for (const inNb of incomingHierarchy.notebooks) {
        if (!mergedHierarchy.notebooks.some(n => n.id === inNb.id)) {
          mergedHierarchy.notebooks.push(inNb);
        }
      }
    }

    // Merge Sections without duplicating identical IDs
    if (Array.isArray(incomingHierarchy.sections)) {
      for (const inSec of incomingHierarchy.sections) {
        if (!mergedHierarchy.sections.some(s => s.id === inSec.id)) {
          mergedHierarchy.sections.push(inSec);
        }
      }
    }

    // Process Page Documents with Conflict & "Keep Both" Protection
    if (Array.isArray(backupData.pages)) {
      for (const page of backupData.pages) {
        if (!page || !page.id) continue;

        const existingDoc = await vault.loadPage(page.id);
        if (!existingDoc) {
          // Page does not exist in current vault - safely restore it
          await vault.savePage(page.id, page);
          pageCount++;

          // Ensure entry exists in hierarchy
          const inMeta = incomingHierarchy.pages?.find(p => p.id === page.id);
          if (inMeta && !mergedHierarchy.pages.some(p => p.id === page.id)) {
            mergedHierarchy.pages.push(inMeta);
          }
        } else {
          // Conflict: A page with the exact same ID already exists!
          const isIdentical = JSON.stringify(existingDoc) === JSON.stringify(page);
          if (isIdentical) {
            // Already matching, no action needed
            pageCount++;
          } else {
            // Content differs! To guarantee zero loss of current edits, keep both!
            conflictDuplicates++;
            const restoredId = `${page.id}_restored_${Date.now().toString(36)}`;
            const restoredTitle = `${page.title || 'Untitled'} (Restored)`;

            const clonedPage = {
              ...page,
              id: restoredId,
              title: restoredTitle
            };

            await vault.savePage(restoredId, clonedPage);
            pageCount++;

            // Register cloned page entry in hierarchy under original section
            const originalMeta = incomingHierarchy.pages?.find(p => p.id === page.id);
            mergedHierarchy.pages.push({
              id: restoredId,
              sectionId: originalMeta?.sectionId || page.sectionId,
              title: restoredTitle,
              parentPageId: null,
              isSubpage: false,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        }
      }
    }
  }

  // Save merged hierarchy
  await vault.saveHierarchy(mergedHierarchy);

  // Restore active settings if not already configured
  if (backupData.settings) {
    const curNb = await vault.getSetting('activeNotebookId');
    if (!curNb && backupData.settings.activeNotebookId) {
      await vault.saveSetting('activeNotebookId', backupData.settings.activeNotebookId);
    }
    const curSec = await vault.getSetting('activeSectionId');
    if (!curSec && backupData.settings.activeSectionId) {
      await vault.saveSetting('activeSectionId', backupData.settings.activeSectionId);
    }
    const curPg = await vault.getSetting('activePageId');
    if (!curPg && backupData.settings.activePageId) {
      await vault.saveSetting('activePageId', backupData.settings.activePageId);
    }
  }

  return {
    success: true,
    notebooksRestored: incomingHierarchy.notebooks?.length || 0,
    sectionsRestored: incomingHierarchy.sections?.length || 0,
    pagesRestored: pageCount,
    conflictsResolved: conflictDuplicates
  };
}
