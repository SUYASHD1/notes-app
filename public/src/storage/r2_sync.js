// Cloudflare R2 S3 REST Sync Engine with Offline Queuing & Conflict Resolution

export class CloudflareR2Sync {
  constructor(config = {}) {
    this.endpoint = config.endpoint || 'https://<account_id>.r2.cloudflarestorage.com';
    this.bucket = config.bucket || 'notes-app-bucket';
    this.accessKeyId = config.accessKeyId || '';
    this.secretAccessKey = config.secretAccessKey || '';

    this.isOnline = config.isOnline ?? true;
    this.pendingQueue = [];
    this.remoteStore = new Map(); // Simulated remote R2 store for headless testing
  }

  setOnlineStatus(online) {
    this.isOnline = !!online;
    if (this.isOnline && this.pendingQueue.length > 0) {
      return this.flushPendingQueue();
    }
    return [];
  }

  /**
   * Puts an object to R2 or queues it if offline.
   */
  putObject(key, data, timestamp = Date.now()) {
    const payload = {
      key,
      data,
      timestamp,
      checksum: this.computeSimpleHash(typeof data === 'string' ? data : JSON.stringify(data))
    };

    if (!this.isOnline) {
      this.pendingQueue.push({ action: 'PUT', payload });
      return { status: 'queued', key };
    }

    // When online, check timestamp for conflict resolution (last-write-wins)
    const existing = this.remoteStore.get(key);
    if (existing && existing.timestamp > timestamp) {
      // Remote version is newer, reject overwrite
      return { status: 'conflict_remote_newer', key };
    }

    this.remoteStore.set(key, payload);
    return { status: 'synced', key, checksum: payload.checksum };
  }

  /**
   * Retrieves an object from R2.
   */
  getObject(key) {
    if (!this.isOnline) {
      throw new Error('Cannot get object while offline');
    }
    return this.remoteStore.get(key) || null;
  }

  /**
   * Flushes queued offline deltas.
   */
  flushPendingQueue() {
    const results = [];
    const queue = [...this.pendingQueue];
    this.pendingQueue = [];

    for (const item of queue) {
      if (item.action === 'PUT') {
        const res = this.putObject(item.payload.key, item.payload.data, item.payload.timestamp);
        results.push(res);
      }
    }

    return results;
  }

  computeSimpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash);
  }
}
