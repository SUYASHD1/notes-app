// LocalVault — High-Performance Asynchronous Local-First IndexedDB Engine
// Handles persistent storage for Pages, Notebook Hierarchy, Binary Assets (PDFs/Images), and Settings.
// Provides graceful in-memory fallback for headless/Node.js testing environments.

export class LocalVault {
  constructor(dbName = 'NotesAppLocalVault', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.isIDBSupported = typeof indexedDB !== 'undefined';
    
    // In-memory fallback stores for testing or environments where IDB is unavailable
    this._memoryFallback = {
      pages: new Map(),
      hierarchy: new Map(),
      assets: new Map(),
      settings: new Map()
    };
  }

  /**
   * Initializes database connection and ensures all required object stores exist.
   */
  async init() {
    if (!this.isIDBSupported) {
      return this;
    }

    if (this.db) {
      return this;
    }

    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(this.dbName, this.version);

        req.onupgradeneeded = (e) => {
          const db = req.result;
          if (!db.objectStoreNames.contains('pages')) {
            db.createObjectStore('pages', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('hierarchy')) {
            db.createObjectStore('hierarchy');
          }
          if (!db.objectStoreNames.contains('assets')) {
            db.createObjectStore('assets');
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
        };

        req.onsuccess = () => {
          this.db = req.result;
          resolve(this);
        };

        req.onerror = () => {
          console.warn('LocalVault: IndexedDB open failed, falling back to in-memory store:', req.error);
          this.isIDBSupported = false;
          resolve(this);
        };
      } catch (err) {
        console.warn('LocalVault: Exception during open, using fallback:', err);
        this.isIDBSupported = false;
        resolve(this);
      }
    });
  }

  // --- Page Operations ---

  async savePage(pageId, pageDoc) {
    if (!pageId || !pageDoc) return false;
    await this.init();

    // Ensure document has an id and timestamp
    const record = {
      id: pageId,
      ...pageDoc,
      updatedAt: pageDoc.updatedAt || Date.now()
    };

    if (!this.isIDBSupported || !this.db) {
      this._memoryFallback.pages.set(pageId, JSON.parse(JSON.stringify(record)));
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('pages', 'readwrite');
        tx.objectStore('pages').put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          console.warn('LocalVault: savePage error', tx.error);
          resolve(false);
        };
      } catch (e) {
        console.warn('LocalVault: savePage transaction failed:', e);
        this._memoryFallback.pages.set(pageId, record);
        resolve(true);
      }
    });
  }

  async loadPage(pageId) {
    if (!pageId) return null;
    await this.init();

    if (!this.isIDBSupported || !this.db) {
      const found = this._memoryFallback.pages.get(pageId);
      return found ? JSON.parse(JSON.stringify(found)) : null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('pages', 'readonly');
        const req = tx.objectStore('pages').get(pageId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        console.warn('LocalVault: loadPage error:', e);
        resolve(this._memoryFallback.pages.get(pageId) || null);
      }
    });
  }

  async deletePage(pageId) {
    if (!pageId) return false;
    await this.init();

    if (!this.isIDBSupported || !this.db) {
      this._memoryFallback.pages.delete(pageId);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('pages', 'readwrite');
        tx.objectStore('pages').delete(pageId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async getAllPageIds() {
    await this.init();
    if (!this.isIDBSupported || !this.db) {
      return Array.from(this._memoryFallback.pages.keys());
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('pages', 'readonly');
        const req = tx.objectStore('pages').getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  // --- Hierarchy Operations ---

  async saveHierarchy(hierarchyData) {
    await this.init();
    const dataToSave = hierarchyData ? JSON.parse(JSON.stringify(hierarchyData)) : null;

    if (!this.isIDBSupported || !this.db) {
      this._memoryFallback.hierarchy.set('current', dataToSave);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('hierarchy', 'readwrite');
        tx.objectStore('hierarchy').put(dataToSave, 'current');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        console.warn('LocalVault: saveHierarchy error:', e);
        this._memoryFallback.hierarchy.set('current', dataToSave);
        resolve(true);
      }
    });
  }

  async loadHierarchy() {
    await this.init();
    if (!this.isIDBSupported || !this.db) {
      return this._memoryFallback.hierarchy.get('current') || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('hierarchy', 'readonly');
        const req = tx.objectStore('hierarchy').get('current');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  // --- Binary Asset Operations (PDFs, Images, Canvas Snapshots) ---

  async storeAsset(assetId, assetData) {
    if (!assetId || !assetData) return false;
    await this.init();

    const record = {
      id: assetId,
      data: assetData,
      size: typeof assetData === 'string' ? assetData.length : (assetData.size || 0),
      createdAt: Date.now()
    };

    if (!this.isIDBSupported || !this.db) {
      this._memoryFallback.assets.set(assetId, record);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(record, assetId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        console.warn('LocalVault: storeAsset error:', e);
        this._memoryFallback.assets.set(assetId, record);
        resolve(true);
      }
    });
  }

  async getAsset(assetId) {
    if (!assetId) return null;
    await this.init();

    if (!this.isIDBSupported || !this.db) {
      const res = this._memoryFallback.assets.get(assetId);
      return res ? res.data : null;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('assets', 'readonly');
        const req = tx.objectStore('assets').get(assetId);
        req.onsuccess = () => {
          const result = req.result;
          resolve(result ? result.data : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async deleteAsset(assetId) {
    if (!assetId) return false;
    await this.init();

    if (!this.isIDBSupported || !this.db) {
      this._memoryFallback.assets.delete(assetId);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('assets', 'readwrite');
        tx.objectStore('assets').delete(assetId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  // --- App Settings (e.g., active Notebook, Section, Page, Puck position) ---

  async saveSetting(key, val) {
    await this.init();
    if (!this.isIDBSupported || !this.db) {
      this._memoryFallback.settings.set(key, val);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(val, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async getSetting(key, defaultValue = null) {
    await this.init();
    if (!this.isIDBSupported || !this.db) {
      const found = this._memoryFallback.settings.get(key);
      return found !== undefined ? found : defaultValue;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get(key);
        req.onsuccess = () => {
          resolve(req.result !== undefined ? req.result : defaultValue);
        };
        req.onerror = () => resolve(defaultValue);
      } catch {
        resolve(defaultValue);
      }
    });
  }

  // --- Backup & Restore Engine ---

  async getAllPages() {
    await this.init();
    if (!this.isIDBSupported || !this.db) {
      return Array.from(this._memoryFallback.pages.values());
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('pages', 'readonly');
        const req = tx.objectStore('pages').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async exportFullBackup() {
    await this.init();
    const hierarchy = await this.loadHierarchy();
    const pages = await this.getAllPages();
    const activeNotebookId = await this.getSetting('activeNotebookId');
    const activeSectionId = await this.getSetting('activeSectionId');
    const activePageId = await this.getSetting('activePageId');

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

  async importFullBackup(backupData) {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Invalid backup data format');
    }

    await this.init();

    // 1. Restore hierarchy
    if (backupData.hierarchy) {
      await this.saveHierarchy(backupData.hierarchy);
    }

    // 2. Restore all pages
    let pageCount = 0;
    if (Array.isArray(backupData.pages)) {
      for (const page of backupData.pages) {
        if (page && page.id) {
          await this.savePage(page.id, page);
          pageCount++;
        }
      }
    }

    // 3. Restore settings
    if (backupData.settings) {
      if (backupData.settings.activeNotebookId) await this.saveSetting('activeNotebookId', backupData.settings.activeNotebookId);
      if (backupData.settings.activeSectionId) await this.saveSetting('activeSectionId', backupData.settings.activeSectionId);
      if (backupData.settings.activePageId) await this.saveSetting('activePageId', backupData.settings.activePageId);
    }

    return {
      success: true,
      notebooksRestored: backupData.hierarchy?.notebooks?.length || 0,
      sectionsRestored: backupData.hierarchy?.sections?.length || 0,
      pagesRestored: pageCount
    };
  }

  // --- Storage Metrics & Diagnostics ---

  async getStorageMetrics() {
    await this.init();
    const hierarchy = (await this.loadHierarchy()) || { notebooks: [], sections: [], pages: [] };
    const pages = await this.getAllPages();

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
        p.blocks.forEach(b => {
          if (Array.isArray(b.items)) {
            b.items.forEach(it => {
              if (it && (it.type === 'image' || it.type === 'pdf')) {
                totalAssets++;
              }
            });
          }
        });
      }
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

  async requestPersistenceLock() {
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

  // --- Hard Drive Folder Sync (File System Access API) ---

  async setHardDriveFolder(handle, folderName) {
    await this.init();
    await this.saveSetting('hardDriveFolderHandle', handle);
    await this.saveSetting('hardDriveFolderName', folderName || handle.name || 'Custom Folder');
    await this.saveSetting('storageLocationType', 'hard_drive');
  }

  async getHardDriveFolder() {
    await this.init();
    const handle = await this.getSetting('hardDriveFolderHandle');
    const folderName = await this.getSetting('hardDriveFolderName');
    const locationType = await this.getSetting('storageLocationType', 'device_vault');
    return { handle, folderName, locationType };
  }

  async clearHardDriveFolder() {
    await this.init();
    await this.saveSetting('hardDriveFolderHandle', null);
    await this.saveSetting('hardDriveFolderName', null);
    await this.saveSetting('storageLocationType', 'device_vault');
  }

  async migrateCurrentDataToFolder(folderHandle, progressCb = () => {}) {
    if (!folderHandle || typeof folderHandle.getFileHandle !== 'function') {
      return { success: false, error: 'Invalid directory handle' };
    }

    try {
      progressCb({ step: 'init', message: 'Connecting to selected folder...' });

      // 1. Write hierarchy.json
      progressCb({ step: 'hierarchy', message: 'Saving notebook hierarchy structure...' });
      const hierarchy = (await this.loadHierarchy()) || { notebooks: [], sections: [], pages: [] };
      const hierFile = await folderHandle.getFileHandle('hierarchy.json', { create: true });
      const hierWritable = await hierFile.createWritable();
      await hierWritable.write(JSON.stringify(hierarchy, null, 2));
      await hierWritable.close();

      // 2. Create pages directory and save each page
      progressCb({ step: 'pages_dir', message: 'Creating pages directory...' });
      const pagesDir = await folderHandle.getDirectoryHandle('pages', { create: true });
      const pages = await this.getAllPages();

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
      await this.setHardDriveFolder(folderHandle, folderHandle.name);
      progressCb({ step: 'done', message: 'All notes safely transferred!' });

      return { success: true, count: pages.length };
    } catch (err) {
      console.warn('Migration to folder failed:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Clears all data (useful for factory reset or testing teardowns).
   */
  async clearAll() {
    await this.init();
    this._memoryFallback.pages.clear();
    this._memoryFallback.hierarchy.clear();
    this._memoryFallback.assets.clear();
    this._memoryFallback.settings.clear();

    if (!this.isIDBSupported || !this.db) {
      return true;
    }

    return new Promise((resolve) => {
      try {
        const stores = ['pages', 'hierarchy', 'assets', 'settings'];
        const tx = this.db.transaction(stores, 'readwrite');
        stores.forEach(s => tx.objectStore(s).clear());
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
}
