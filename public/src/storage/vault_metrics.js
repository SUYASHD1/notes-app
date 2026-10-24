// Storage Diagnostics, Device Quota Estimation & Persistence Safe-Lock Engine

export async function getStorageMetrics(vault) {
  await vault.init();
  const hierarchy = (await vault.loadHierarchy()) || { notebooks: [], sections: [], pages: [] };
  const pages = await vault.getAllPages();

  let totalStrokes = 0;
  let totalBlocks = 0;
  let totalAssets = 0;
  let totalBytesApprox = 0;

  pages.forEach(p => {
    const pageStr = JSON.stringify(p);
    totalBytesApprox += pageStr.length * 2; // UTF-16 byte approximation
    if (Array.isArray(p.globalAnnotations)) {
      totalStrokes += p.globalAnnotations.length;
    }
    if (Array.isArray(p.blocks)) {
      totalBlocks += p.blocks.length;
    }
    p.blocks?.forEach(b => {
      b.items?.forEach(it => {
        if (it && (it.type === 'image' || it.type === 'pdf')) {
          totalAssets++;
        }
      });
    });
  });

  let systemUsage = null;
  let systemQuota = null;
  let isPersisted = false;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        systemUsage = estimate.usage || totalBytesApprox;
        systemQuota = estimate.quota || null;
      }
      if (navigator.storage.persisted) {
        isPersisted = await navigator.storage.persisted();
      }
    } catch (_) {}
  }

  const bytesToUse = systemUsage || totalBytesApprox;
  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  return {
    totalBytes: bytesToUse,
    formattedUsage: formatBytes(bytesToUse),
    formattedQuota: systemQuota ? formatBytes(systemQuota) : 'Device Quota Managed',
    notebooksCount: hierarchy.notebooks?.length || 0,
    sectionsCount: hierarchy.sections?.length || 0,
    pagesCount: pages.length || hierarchy.pages?.length || 0,
    strokesCount: totalStrokes,
    blocksCount: totalBlocks,
    assetsCount: totalAssets,
    isPersisted
  };
}

export async function requestPersistenceLock() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const persisted = await navigator.storage.persist();
      return persisted;
    } catch {
      return false;
    }
  }
  return false;
}
