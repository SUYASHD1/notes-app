import test from 'node:test';
import assert from 'node:assert/strict';
import { ResizeHandleEngine, ResizeHandleType } from '../src/blocks/resize_handle.js';
import { DocumentModel } from '../src/core/document.js';
import { createNoteContainer } from '../src/core/types.js';

test('ResizeHandleEngine vertical stretch calculations', () => {
  const origBox = { x: 100, y: 100, width: 500, height: 300 };

  // Dragging South handle downward by 150px
  const resizedS = ResizeHandleEngine.applyResize(ResizeHandleType.S, origBox, 0, 150, 260, 80);
  assert.equal(resizedS.x, 100);
  assert.equal(resizedS.y, 100);
  assert.equal(resizedS.width, 500);
  assert.equal(resizedS.height, 450);

  // Dragging South-East handle down and right
  const resizedSE = ResizeHandleEngine.applyResize(ResizeHandleType.SE, origBox, 80, 120, 260, 80);
  assert.equal(resizedSE.width, 580);
  assert.equal(resizedSE.height, 420);

  // Dragging North handle upward
  const resizedN = ResizeHandleEngine.applyResize(ResizeHandleType.N, origBox, 0, -50, 260, 80);
  assert.equal(resizedN.y, 50);
  assert.equal(resizedN.height, 350);

  // Respect minimum height constraint
  const resizedMinH = ResizeHandleEngine.applyResize(ResizeHandleType.S, origBox, 0, -400, 260, 80);
  assert.equal(resizedMinH.height, 80);
});

test('Universal Note Container preserves custom height on serialization', () => {
  const doc = new DocumentModel({ title: 'Test Notes' });
  const container = createNoteContainer({
    x: 60,
    y: 80,
    width: 580,
    height: 650,
    items: [
      { id: 'item_text_1', type: 'text', content: 'Hello' },
      { id: 'item_media_1', type: 'media', url: 'signature.png', caption: 'Signature' }
    ]
  });
  doc.addBlock(container);

  const json = doc.toJSON();
  const loadedDoc = DocumentModel.fromJSON(json);
  const loadedBlock = loadedDoc.getBlock(container.id);

  assert.equal(loadedBlock.height, 650);
  assert.equal(loadedBlock.items.length, 2);
  assert.equal(loadedBlock.items[1].type, 'media');

  // Appending text item below media
  loadedBlock.items.push({ id: 'item_text_2', type: 'text', content: 'Text below signature' });
  assert.equal(loadedBlock.items.length, 3);
  assert.equal(loadedBlock.items[2].type, 'text');
  assert.equal(loadedBlock.items[2].content, 'Text below signature');
});

test('Universal Note Container supports embedded sketch canvas with local coordinates', () => {
  const doc = new DocumentModel({ title: 'Sketch Container' });
  const sketchItem = {
    id: 'sketch_item_1',
    type: 'sketch',
    height: 260,
    strokes: [
      {
        id: 'local_stroke_1',
        color: '#2563eb',
        width: 3,
        points: [
          { x: 10, y: 15, pressure: 0.5 },
          { x: 25, y: 30, pressure: 0.6 },
          { x: 40, y: 45, pressure: 0.5 }
        ]
      }
    ]
  };

  const container = createNoteContainer({
    x: 200,
    y: 150,
    width: 600,
    height: 400,
    items: [
      { id: 'item_title', type: 'text', content: 'Meeting Sketch' },
      sketchItem
    ]
  });

  doc.addBlock(container);
  const serialized = doc.toJSON();
  const reloaded = DocumentModel.fromJSON(serialized);
  const reloadedContainer = reloaded.getBlock(container.id);

  assert.equal(reloadedContainer.items.length, 2);
  assert.equal(reloadedContainer.items[1].type, 'sketch');
  assert.equal(reloadedContainer.items[1].height, 260);
  assert.equal(reloadedContainer.items[1].strokes.length, 1);
  assert.equal(reloadedContainer.items[1].strokes[0].points.length, 3);
  // Verify local coordinates are preserved without world offset contamination
  assert.equal(reloadedContainer.items[1].strokes[0].points[0].x, 10);
  assert.equal(reloadedContainer.items[1].strokes[0].points[0].y, 15);
});

test('Horizontal resize (E/W) adjusts width independently without altering vertical bounds', () => {
  const origBox = { x: 50, y: 80, width: 500, height: 350 };

  // Dragging East handle right by 100px
  const resizedE = ResizeHandleEngine.applyResize(ResizeHandleType.E, origBox, 100, 50, 260, 80);
  assert.equal(resizedE.x, 50);
  assert.equal(resizedE.y, 80);
  assert.equal(resizedE.width, 600);
  assert.equal(resizedE.height, 350); // Vertical height untouched by dy in E mode

  // Dragging West handle left by 50px
  const resizedW = ResizeHandleEngine.applyResize(ResizeHandleType.W, origBox, -50, 50, 260, 80);
  assert.equal(resizedW.x, 0);
  assert.equal(resizedW.y, 80);
  assert.equal(resizedW.width, 550);
  assert.equal(resizedW.height, 350); // Vertical height untouched by dy in W mode
});

test('Universal Note Container allows resetting custom height for natural content collapse', () => {
  const doc = new DocumentModel({ title: 'Dynamic Height Note' });
  const container = createNoteContainer({
    x: 100,
    y: 100,
    width: 580,
    height: 1200, // Manually stretched or tall pasted content
    items: [{ id: 'item_1', type: 'text', content: 'Long pasted content' }]
  });
  const added = doc.addBlock(container);

  // User deletes all content from note: height lock is removed to allow collapse
  delete added.height;
  added.items[0].content = '';
  doc.touch();

  const saved = doc.toJSON();
  const reloaded = DocumentModel.fromJSON(saved).getBlock(container.id);

  assert.equal(reloaded.height, undefined);
  assert.equal(reloaded.items[0].content, '');
});

