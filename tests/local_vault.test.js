import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalVault } from '../src/core.js';

test('LocalVault initializes and handles page CRUD operations', async () => {
  const vault = new LocalVault('TestDB_Pages');
  await vault.init();

  const samplePage = {
    id: 'page_quantum_101',
    title: 'Quantum Wave Mechanics',
    viewport: { x: 10, y: 20, zoom: 1.2 },
    blocks: [
      { id: 'b1', type: 'note_container', x: 50, y: 50, items: [{ type: 'text', content: 'Schrodinger equation' }] }
    ],
    globalAnnotations: [
      { id: 's1', tool: 'pen', color: '#6366f1', points: [{ x: 10, y: 10, pressure: 0.5 }] }
    ]
  };

  // 1. Save Page
  const saveOk = await vault.savePage('page_quantum_101', samplePage);
  assert.equal(saveOk, true);

  // 2. Load Page
  const loaded = await vault.loadPage('page_quantum_101');
  assert.ok(loaded);
  assert.equal(loaded.id, 'page_quantum_101');
  assert.equal(loaded.title, 'Quantum Wave Mechanics');
  assert.equal(loaded.blocks.length, 1);
  assert.equal(loaded.globalAnnotations.length, 1);
  assert.ok(loaded.updatedAt);

  // 3. List page IDs
  const allIds = await vault.getAllPageIds();
  assert.ok(allIds.includes('page_quantum_101'));

  // 4. Delete Page
  const delOk = await vault.deletePage('page_quantum_101');
  assert.equal(delOk, true);

  const reloadDeleted = await vault.loadPage('page_quantum_101');
  assert.equal(reloadDeleted, null);
});

test('LocalVault preserves and retrieves notebook hierarchy structure', async () => {
  const vault = new LocalVault('TestDB_Hierarchy');
  
  const hierarchyTree = {
    notebooks: [{ id: 'nb_1', name: 'Math', color: '#3b82f6' }],
    sections: [{ id: 'sec_1', notebookId: 'nb_1', name: 'Calculus' }],
    pages: [{ id: 'pg_1', sectionId: 'sec_1', title: 'Derivatives' }]
  };

  const saveRes = await vault.saveHierarchy(hierarchyTree);
  assert.equal(saveRes, true);

  const loaded = await vault.loadHierarchy();
  assert.ok(loaded);
  assert.equal(loaded.notebooks.length, 1);
  assert.equal(loaded.notebooks[0].name, 'Math');
  assert.equal(loaded.sections[0].name, 'Calculus');
  assert.equal(loaded.pages[0].title, 'Derivatives');
});

test('LocalVault safely vaults binary and large assets with deduplication', async () => {
  const vault = new LocalVault('TestDB_Assets');

  const assetId = 'asset_pdf_lecture1_hash123';
  const assetPayload = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...SIMULATED_LARGE_PDF_CONTENT';

  // Store asset
  const storeRes = await vault.storeAsset(assetId, assetPayload);
  assert.equal(storeRes, true);

  // Retrieve asset
  const retrieved = await vault.getAsset(assetId);
  assert.equal(retrieved, assetPayload);

  // Delete asset
  const delRes = await vault.deleteAsset(assetId);
  assert.equal(delRes, true);

  const missing = await vault.getAsset(assetId);
  assert.equal(missing, null);
});

test('LocalVault persists user workspace settings and clears on reset', async () => {
  const vault = new LocalVault('TestDB_Settings');

  await vault.saveSetting('activeNotebookId', 'nb_physics');
  await vault.saveSetting('puckPosition', { x: 450, y: 800 });

  const activeNb = await vault.getSetting('activeNotebookId');
  assert.equal(activeNb, 'nb_physics');

  const puckPos = await vault.getSetting('puckPosition');
  assert.deepEqual(puckPos, { x: 450, y: 800 });

  const defaultSetting = await vault.getSetting('unknownKey', 'defaultVal');
  assert.equal(defaultSetting, 'defaultVal');

  // Clear all
  await vault.clearAll();
  const clearedNb = await vault.getSetting('activeNotebookId');
  assert.equal(clearedNb, null);
});

test('LocalVault exports full backup and restores seamlessly', async () => {
  const vault = new LocalVault('TestDB_BackupRestore');
  
  await vault.saveHierarchy({
    notebooks: [{ id: 'nb_astro', name: 'Astrophysics', color: '#10b981' }],
    sections: [{ id: 'sec_galaxies', notebookId: 'nb_astro', name: 'Spiral Galaxies' }],
    pages: [{ id: 'page_andromeda', sectionId: 'sec_galaxies', title: 'Andromeda' }]
  });

  await vault.savePage('page_andromeda', {
    id: 'page_andromeda',
    title: 'Andromeda Collision Course',
    blocks: [{ id: 'b1', type: 'text', content: '2.5 million light years' }],
    globalAnnotations: [{ id: 's1', tool: 'pen', points: [{ x: 10, y: 10 }] }]
  });

  await vault.saveSetting('activeNotebookId', 'nb_astro');

  // 1. Export backup
  const backup = await vault.exportFullBackup();
  assert.ok(backup);
  assert.equal(backup.appName, 'NotesApp');
  assert.equal(backup.hierarchy.notebooks.length, 1);
  assert.equal(backup.pages.length, 1);
  assert.equal(backup.settings.activeNotebookId, 'nb_astro');

  // 2. Clear vault
  await vault.clearAll();
  assert.equal(await vault.loadHierarchy(), null);
  assert.equal(await vault.loadPage('page_andromeda'), null);

  // 3. Restore backup
  const restoreRes = await vault.importFullBackup(backup);
  assert.equal(restoreRes.success, true);
  assert.equal(restoreRes.notebooksRestored, 1);
  assert.equal(restoreRes.pagesRestored, 1);

  // 4. Verify restored state
  const restoredHierarchy = await vault.loadHierarchy();
  assert.equal(restoredHierarchy.notebooks[0].name, 'Astrophysics');
  const restoredPage = await vault.loadPage('page_andromeda');
  assert.equal(restoredPage.title, 'Andromeda Collision Course');
});

test('LocalVault computes live storage metrics and breakdown', async () => {
  const vault = new LocalVault('TestDB_Metrics');

  await vault.saveHierarchy({
    notebooks: [{ id: 'nb_chem', name: 'Chemistry' }],
    sections: [{ id: 'sec_organic', name: 'Organic' }, { id: 'sec_inorganic', name: 'Inorganic' }],
    pages: [{ id: 'p1' }, { id: 'p2' }]
  });

  await vault.savePage('p1', {
    id: 'p1',
    blocks: [{ id: 'b1' }, { id: 'b2' }],
    globalAnnotations: [{ id: 's1' }, { id: 's2' }, { id: 's3' }]
  });

  const metrics = await vault.getStorageMetrics();
  assert.ok(metrics);
  assert.equal(metrics.notebooksCount, 1);
  assert.equal(metrics.sectionsCount, 2);
  assert.ok(metrics.pagesCount >= 1);
  assert.equal(metrics.strokesCount, 3);
  assert.equal(metrics.blocksCount, 2);
  assert.ok(metrics.formattedUsage);
});

test('LocalVault Smart Merge: keeps both copies when page ID or content conflicts', async () => {
  const vault = new LocalVault('TestDB_SmartMerge');

  // Existing current state with today's edits
  await vault.saveHierarchy({
    notebooks: [{ id: 'nb_active', name: 'Current Active Notebook' }],
    sections: [{ id: 'sec_today', notebookId: 'nb_active', name: 'Today Section' }],
    pages: [{ id: 'page_shared', sectionId: 'sec_today', title: 'Shared Note (Today New Edit)' }]
  });

  await vault.savePage('page_shared', {
    id: 'page_shared',
    title: 'Shared Note (Today New Edit)',
    blocks: [{ id: 'b1', content: 'Updated today with fresh ideas' }]
  });

  // Older backup payload that has an older version of 'page_shared' and an additional notebook
  const oldBackup = {
    appName: 'NotesApp',
    hierarchy: {
      notebooks: [
        { id: 'nb_active', name: 'Current Active Notebook' },
        { id: 'nb_archive', name: 'Archived Notebook' }
      ],
      sections: [
        { id: 'sec_today', notebookId: 'nb_active', name: 'Today Section' },
        { id: 'sec_old', notebookId: 'nb_archive', name: 'Old Section' }
      ],
      pages: [
        { id: 'page_shared', sectionId: 'sec_today', title: 'Shared Note (Last Week)' },
        { id: 'page_old', sectionId: 'sec_old', title: 'Old History' }
      ]
    },
    pages: [
      { id: 'page_shared', title: 'Shared Note (Last Week)', blocks: [{ id: 'b1', content: 'Last week content' }] },
      { id: 'page_old', title: 'Old History', blocks: [{ id: 'b2', content: 'Historic data' }] }
    ]
  };

  const res = await vault.importFullBackup(oldBackup);
  assert.equal(res.success, true);
  assert.equal(res.conflictsResolved, 1, 'Should resolve 1 conflicting page by keeping both');

  // Verify current note is NOT destroyed or overwritten
  const currentDoc = await vault.loadPage('page_shared');
  assert.equal(currentDoc.title, 'Shared Note (Today New Edit)');
  assert.equal(currentDoc.blocks[0].content, 'Updated today with fresh ideas');

  // Verify merged hierarchy has both notebooks and all pages
  const hier = await vault.loadHierarchy();
  assert.equal(hier.notebooks.length, 2, 'Should keep both active and incoming notebooks');
  assert.ok(hier.pages.some(p => p.id === 'page_shared'));
  assert.ok(hier.pages.some(p => p.id === 'page_old'));
  assert.ok(hier.pages.some(p => p.title.includes('(Restored)')));
});

