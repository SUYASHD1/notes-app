// Hard Drive Folder Migration & File System Access Sync Engine

export async function migrateCurrentDataToFolder(vault, folderHandle, progressCb = () => {}) {
  if (!folderHandle || typeof folderHandle.getFileHandle !== 'function') {
    return { success: false, error: 'Invalid directory handle' };
  }

  try {
    progressCb({ step: 'init', message: 'Connecting to selected folder...' });

    // 1. Write hierarchy.json
    progressCb({ step: 'hierarchy', message: 'Saving notebook hierarchy structure...' });
    const hierarchy = (await vault.loadHierarchy()) || { notebooks: [], sections: [], pages: [] };
    const hierFile = await folderHandle.getFileHandle('hierarchy.json', { create: true });
    const hierWritable = await hierFile.createWritable();
    await hierWritable.write(JSON.stringify(hierarchy, null, 2));
    await hierWritable.close();

    // 2. Create pages directory and save each page
    progressCb({ step: 'pages_dir', message: 'Creating pages directory...' });
    const pagesDir = await folderHandle.getDirectoryHandle('pages', { create: true });
    const pages = await vault.getAllPages();

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      progressCb({
        step: 'page',
        message: `Copying page ${i + 1} of ${pages.length}: "${p.title || p.id}"...`,
        current: i + 1,
        total: pages.length
      });
      const pageFile = await pagesDir.getFileHandle(`${p.id}.json`, { create: true });
      const pageWritable = await pageFile.createWritable();
      await pageWritable.write(JSON.stringify(p, null, 2));
      await pageWritable.close();
    }

    // 3. Mark folder as active
    await vault.setHardDriveFolder(folderHandle, folderHandle.name);
    progressCb({ step: 'done', message: 'All notes safely transferred!' });

    return { success: true, count: pages.length };
  } catch (err) {
    console.warn('Migration to folder failed:', err);
    return { success: false, error: err.message };
  }
}
