// Atomic File Storage Engine with Checksum Verification

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Sandbox } from '../core/sandbox.js';

export class AtomicStorage {
  /**
   * Computes SHA-256 hash string for data integrity validation.
   */
  static computeChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Saves document data atomically to disk:
   * 1. Serializes content to JSON.
   * 2. Writes to temporary staging file (.tmp).
   * 3. Verifies file checksum on disk.
   * 4. Atomically renames staging file to final destination.
   */
  static saveDocumentSync(targetPath, docData) {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const serialized = typeof docData === 'string' ? docData : JSON.stringify(docData, null, 2);
    const expectedChecksum = this.computeChecksum(serialized);
    const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substr(2, 6)}.tmp`;

    try {
      // Step 1: Write staging file
      fs.writeFileSync(tempPath, serialized, 'utf8');

      // Step 2: Verify checksum
      const writtenContent = fs.readFileSync(tempPath, 'utf8');
      const actualChecksum = this.computeChecksum(writtenContent);

      if (actualChecksum !== expectedChecksum) {
        throw new Error(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
      }

      // Step 3: Atomic rename
      fs.renameSync(tempPath, targetPath);
      return { success: true, path: targetPath, checksum: expectedChecksum };
    } catch (err) {
      // Clean up orphaned temp file if still present
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      throw new Error(`Atomic write failed: ${err.message}`);
    }
  }

  /**
   * Loads and parses document from disk safely.
   */
  static loadDocumentSync(targetPath) {
    if (!fs.existsSync(targetPath)) return null;
    const raw = fs.readFileSync(targetPath, 'utf8');
    return Sandbox.parseJSON(raw, null);
  }

  /**
   * Stores an asset file using hash-addressed deduplication.
   */
  static storeAssetSync(assetsDir, contentBuffer, ext = 'bin') {
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const hash = crypto.createHash('sha256').update(contentBuffer).digest('hex');
    const assetFileName = `${hash}.${ext}`;
    const assetPath = path.join(assetsDir, assetFileName);

    if (!fs.existsSync(assetPath)) {
      fs.writeFileSync(assetPath, contentBuffer);
    }

    return {
      hash,
      fileName: assetFileName,
      path: assetPath
    };
  }
}
