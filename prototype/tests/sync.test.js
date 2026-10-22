import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AtomicStorage } from '../src/storage/local_store.js';
import { HierarchyManager } from '../src/storage/hierarchy.js';
import { CloudflareR2Sync } from '../src/storage/r2_sync.js';

test('Atomic Document save and integrity verification', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes_atomic_test_'));
  const filePath = path.join(tmpDir, 'test_page.json');

  const docData = {
    id: 'page_atomic_1',
    title: 'Atomic Physics Notes',
    blocks: [{ id: 'b1', type: 'text', content: 'Atomic energy' }]
  };

  const saveRes = AtomicStorage.saveDocumentSync(filePath, docData);
  assert.equal(saveRes.success, true);
  assert.ok(fs.existsSync(filePath));

  // Verify file content is valid and intact
  const loaded = AtomicStorage.loadDocumentSync(filePath);
  assert.equal(loaded.id, 'page_atomic_1');
  assert.equal(loaded.title, 'Atomic Physics Notes');
  assert.equal(loaded.blocks.length, 1);

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Atomic Storage preserves existing file if write or verify fails', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes_atomic_fail_'));
  const filePath = path.join(tmpDir, 'stable_page.json');

  // Initial good write
  AtomicStorage.saveDocumentSync(filePath, { version: 1, title: 'Original Stable Version' });
  const originalContent = fs.readFileSync(filePath, 'utf8');

  // Simulate corrupt staging by monkeypatching writeFileSync temporarily or checksum test
  const origCompute = AtomicStorage.computeChecksum;
  let callCount = 0;
  AtomicStorage.computeChecksum = (content) => {
    callCount++;
    // Force mismatch on verification step (second call)
    if (callCount === 2) return 'corrupted_hash_mismatch';
    return origCompute.call(AtomicStorage, content);
  };

  assert.throws(() => {
    AtomicStorage.saveDocumentSync(filePath, { version: 2, title: 'Corrupted Attempt' });
  }, /Checksum mismatch/);

  // Restore
  AtomicStorage.computeChecksum = origCompute;

  // The original file MUST remain completely untouched and valid!
  const contentAfterFailure = fs.readFileSync(filePath, 'utf8');
  assert.equal(contentAfterFailure, originalContent);

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Asset deduplication with SHA-256 hash-addressing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes_assets_test_'));
  const buffer1 = Buffer.from('PDF slide binary mock data 12345');
  const buffer2 = Buffer.from('PDF slide binary mock data 12345'); // Identical data

  const asset1 = AtomicStorage.storeAssetSync(tmpDir, buffer1, 'pdf');
  const asset2 = AtomicStorage.storeAssetSync(tmpDir, buffer2, 'pdf');

  assert.equal(asset1.hash, asset2.hash);
  assert.equal(asset1.fileName, asset2.fileName);

  // Exactly one file should exist on disk due to deduplication
  const files = fs.readdirSync(tmpDir);
  assert.equal(files.length, 1);

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('HierarchyManager tree operations and cascade deletion', () => {
  const hm = new HierarchyManager();
  const nb = hm.addNotebook('Physics 101');
  const sec = hm.addSection(nb.id, 'Mechanics');
  const p1 = hm.addPage(sec.id, 'Newton Laws');
  const sub1 = hm.addPage(sec.id, 'First Law (Inertia)', p1.id);

  assert.equal(hm.notebooks.length, 1);
  assert.equal(hm.sections.length, 1);
  assert.equal(hm.pages.length, 2);
  assert.equal(sub1.isSubpage, true);
  assert.equal(sub1.parentPageId, p1.id);

  // Cascade delete page should also delete subpage
  hm.deletePage(p1.id);
  assert.equal(hm.getPagesForSection(sec.id).length, 0);

  // Add back and test notebook deletion
  const sec2 = hm.addSection(nb.id, 'Optics');
  hm.addPage(sec2.id, 'Refraction');
  hm.deleteNotebook(nb.id);
  assert.equal(hm.notebooks.length, 0);
  assert.equal(hm.sections.length, 0);
  assert.equal(hm.pages.length, 0);
});

test('Cloudflare R2 sync offline queuing and conflict resolution', () => {
  const r2 = new CloudflareR2Sync({ bucket: 'notes-store' });

  // 1. Go offline
  r2.setOnlineStatus(false);
  const queueRes = r2.putObject('doc_1', { title: 'Offline draft' }, 1000);
  assert.equal(queueRes.status, 'queued');
  assert.equal(r2.pendingQueue.length, 1);

  // 2. Go online -> flushes queue
  const flushResults = r2.setOnlineStatus(true);
  assert.equal(flushResults.length, 1);
  assert.equal(flushResults[0].status, 'synced');
  assert.equal(r2.pendingQueue.length, 0);

  // 3. Conflict resolution (last-write-wins)
  // Remote currently has timestamp 1000. Try to overwrite with older timestamp 800
  const conflictRes = r2.putObject('doc_1', { title: 'Older draft' }, 800);
  assert.equal(conflictRes.status, 'conflict_remote_newer');

  // Verify remote still has newer draft
  const currentRemote = r2.getObject('doc_1');
  assert.equal(currentRemote.data.title, 'Offline draft');
});
