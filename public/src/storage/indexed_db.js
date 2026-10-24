import { exportFullBackup, importFullBackup } from './vault_backup.js';
import { migrateCurrentDataToFolder } from './vault_folder_sync.js';
import { getStorageMetrics, requestPersistenceLock } from './vault_metrics.js';
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
    return exportFullBackup(this);
  }

  async importFullBackup(backupData) {
    return importFullBackup(this, backupData);
  }

  // --- Storage Metrics & Diagnostics ---

  async getStorageMetrics() {
    return getStorageMetrics(this);
  }

  async requestPersistenceLock() {
    return requestPersistenceLock();
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
    return migrateCurrentDataToFolder(this, folderHandle, progressCb);
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
