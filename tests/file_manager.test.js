import test from 'node:test';
import assert from 'node:assert/strict';
import { HierarchyManager } from '../src/storage/hierarchy.js';
import { DocumentModel } from '../src/core/document.js';

test('HierarchyManager: Notebook, Section, and Page File Management lifecycle', () => {
  const hm = new HierarchyManager();

  // 1. Create notebooks
  const nb1 = hm.addNotebook('Math Notebook', '#6366f1');
  const nb2 = hm.addNotebook('Science Notebook', '#10b981');
  assert.equal(hm.notebooks.length, 2);

  // 2. Rename notebook
  const renamed = hm.renameNotebook(nb1.id, 'Advanced Mathematics');
  assert.equal(renamed, true);
  assert.equal(hm.notebooks.find(n => n.id === nb1.id).name, 'Advanced Mathematics');

  // 3. Create sections in both notebooks
  const sec1 = hm.addSection(nb1.id, 'Algebra');
  const sec2 = hm.addSection(nb1.id, 'Geometry');
  const secScience = hm.addSection(nb2.id, 'Biology');
  assert.equal(hm.getSectionsForNotebook(nb1.id).length, 2);
  assert.equal(hm.getSectionsForNotebook(nb2.id).length, 1);

  // 4. Rename section
  assert.equal(hm.renameSection(sec1.id, 'Linear Algebra'), true);
  assert.equal(hm.sections.find(s => s.id === sec1.id).name, 'Linear Algebra');

  // 5. Create pages in section 1
  const p1 = hm.addPage(sec1.id, 'Matrices Intro');
  const p2 = hm.addPage(sec1.id, 'Eigenvalues');
  assert.equal(hm.getPagesForSection(sec1.id).length, 2);

  // 6. Rename page
  assert.equal(hm.renamePage(p1.id, 'Matrix Determinants'), true);
  assert.equal(hm.pages.find(p => p.id === p1.id).title, 'Matrix Determinants');

  // 7. Move page to another section (Drag & Drop behavior)
  assert.equal(hm.movePage(p1.id, sec2.id), true);
  assert.equal(hm.getPagesForSection(sec1.id).length, 1);
  assert.equal(hm.getPagesForSection(sec2.id).length, 1);
  assert.equal(hm.pages.find(p => p.id === p1.id).sectionId, sec2.id);

  // 8. Copy / Duplicate Page
  const copyP2 = hm.copyPage(p2.id, sec2.id);
  assert.ok(copyP2);
  assert.equal(copyP2.title, 'Eigenvalues (Copy)');
  assert.equal(hm.getPagesForSection(sec2.id).length, 2);

  // 9. Move section across notebooks
  assert.equal(hm.moveSection(sec2.id, nb2.id), true);
  assert.equal(hm.getSectionsForNotebook(nb1.id).length, 1); // Only Linear Algebra left
  assert.equal(hm.getSectionsForNotebook(nb2.id).length, 2); // Biology + Geometry moved

  // 10. Reorder pages in section
  hm.reorderPages(sec2.id, [copyP2.id, p1.id]);
  const reordered = hm.getPagesForSection(sec2.id);
  assert.equal(reordered[0].id, copyP2.id);
  assert.equal(reordered[1].id, p1.id);

  // 11. Delete Notebook cascades all child sections and pages
  hm.deleteNotebook(nb2.id);
  assert.equal(hm.notebooks.some(n => n.id === nb2.id), false);
  assert.equal(hm.getSectionsForNotebook(nb2.id).length, 0);
  assert.equal(hm.pages.some(p => p.id === p1.id), false);
  assert.equal(hm.pages.some(p => p.id === copyP2.id), false);
});

test('Clean Blank Page Guarantee: New documents default to empty blocks and zero dummy notes', () => {
  const blankDoc = new DocumentModel({
    id: 'page_new_123',
    title: 'My Clean Page',
    blocks: [],
    globalAnnotations: []
  });

  assert.equal(blankDoc.blocks.length, 0, 'New page must have 0 blocks by default');
  assert.equal(blankDoc.globalAnnotations.length, 0, 'New page must have 0 ink strokes by default');
  assert.equal(blankDoc.title, 'My Clean Page');
});

test('Smart Auto-Numbering & Duplicate Name Avoidance', () => {
  const hm = new HierarchyManager();
  const nb1 = hm.addNotebook('Notes', '#6366f1');

  // Notebook auto-numbering
  const nbName1 = hm.generateUniqueNotebookName('Notes');
  assert.equal(nbName1, 'Notes 2');
  hm.addNotebook(nbName1);
  const nbName2 = hm.generateUniqueNotebookName('Notes');
  assert.equal(nbName2, 'Notes 3');

  // Section auto-numbering
  const sec1 = hm.addSection(nb1.id, 'New Section');
  const secName1 = hm.generateUniqueSectionName(nb1.id, 'New Section');
  assert.equal(secName1, 'New Section 2');
  assert.equal(hm.isDuplicateSectionName(nb1.id, 'New Section'), true);
  assert.equal(hm.isDuplicateSectionName(nb1.id, 'Different Section'), false);

  // Page auto-numbering
  const p1 = hm.addPage(sec1.id, 'Untitled Page');
  const pageTitle1 = hm.generateUniquePageTitle(sec1.id, 'Untitled Page');
  assert.equal(pageTitle1, 'Untitled Page 2');
  assert.equal(hm.isDuplicatePageTitle(sec1.id, 'Untitled Page'), true);
  assert.equal(hm.isDuplicatePageTitle(sec1.id, 'Unique Page Title'), false);
});

