import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTablePalette } from '../src/ui/table_palette_actions.js';
import { bindTableMoveHandles, bindInNoteDragAndDrop } from '../src/blocks/element_drag_helper.js';

test('Table Tools & Drag System: setupTablePalette registers active table and toggles active tools', () => {
  const elements = new Map();

  const ribbonTableBtn = {
    addEventListener: () => {},
    classList: {
      tokens: new Set(),
      add(cls) { this.tokens.add(cls); },
      remove(cls) { this.tokens.delete(cls); },
      contains(cls) { return this.tokens.has(cls); }
    }
  };

  const tblActiveTools = { style: { display: 'none' } };
  const tblInsertTools = { style: { display: 'block' } };
  const tablePalette = {
    classList: {
      tokens: new Set(['hidden']),
      add(cls) { this.tokens.add(cls); },
      remove(cls) { this.tokens.delete(cls); },
      contains(cls) { return this.tokens.has(cls); }
    }
  };

  elements.set('ribbon-table-btn', ribbonTableBtn);
  elements.set('tbl-active-tools', tblActiveTools);
  elements.set('tbl-insert-tools', tblInsertTools);
  elements.set('table-palette', tablePalette);

  global.document = {
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  global.window = {
    showToast: () => {},
    saveActivePageDocument: () => {},
    renderAll: () => {}
  };

  const { registerActiveTable, clearActiveTable } = setupTablePalette();

  const fakeTable = {};
  const fakeCell = {};

  registerActiveTable(fakeTable, fakeCell);
  assert.equal(ribbonTableBtn.classList.contains('active'), true);
  assert.equal(tblActiveTools.style.display, 'block');
  assert.equal(tblInsertTools.style.display, 'none');

  clearActiveTable();
  assert.equal(ribbonTableBtn.classList.contains('active'), false);
  assert.equal(tblActiveTools.style.display, 'none');
  assert.equal(tblInsertTools.style.display, 'block');
});

test('Table Tools & Drag System: bindTableMoveHandles ensures .note-table-wrapper and .table-move-handle', () => {
  let createdWrapper = null;
  let createdHandle = null;

  const fakeTable = {
    closest: (sel) => null,
    parentNode: {
      insertBefore: (newChild, refChild) => {
        createdWrapper = newChild;
      }
    }
  };

  const fakeTextDiv = {
    querySelectorAll: (sel) => {
      if (sel === 'table') return [fakeTable];
      return [];
    }
  };

  global.document = {
    createElement: (tag) => {
      const el = {
        className: '',
        contentEditable: '',
        attrs: {},
        setAttribute: (k, v) => { el.attrs[k] = v; },
        getAttribute: (k) => el.attrs[k],
        querySelector: (sel) => null,
        appendChild: (child) => {},
        insertBefore: (child, ref) => { createdHandle = child; }
      };
      return el;
    }
  };

  bindTableMoveHandles(fakeTextDiv, () => {});

  assert.ok(createdWrapper, 'Wrapper element must be created');
  assert.equal(createdWrapper.className, 'note-table-wrapper');
  assert.ok(createdHandle, 'Handle element must be inserted');
  assert.equal(createdHandle.className, 'table-move-handle');
  assert.equal(createdHandle.textContent, '✢');
  assert.equal(createdHandle.getAttribute('draggable'), 'true');
});

test('Table Tools & Drag System: bindInNoteDragAndDrop enables draggable on image containers', () => {
  const fakeImgContainer = {
    attrs: {},
    setAttribute: (k, v) => { fakeImgContainer.attrs[k] = v; },
    getAttribute: (k) => fakeImgContainer.attrs[k]
  };

  const fakeTextDiv = {
    querySelectorAll: (sel) => {
      if (sel === '.note-image-container') return [fakeImgContainer];
      return [];
    }
  };

  bindInNoteDragAndDrop(fakeTextDiv, () => {});

  assert.equal(fakeImgContainer.getAttribute('draggable'), 'true');
  assert.equal(typeof fakeTextDiv.ondragover, 'function');
  assert.equal(typeof fakeTextDiv.ondrop, 'function');
});
