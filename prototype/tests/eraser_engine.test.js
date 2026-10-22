import test from 'node:test';
import assert from 'node:assert/strict';
import { EraserEngine } from '../src/canvas/eraser_engine.js';
import { DocumentModel } from '../src/core/document.js';
import { HistoryManager, EraseStrokesCommand } from '../src/core/history.js';

test('distanceToSegment accurately computes perpendicular and endpoint distances', () => {
  // Horizontal segment from (0, 0) to (100, 0)
  // Test point (50, 20) -> perpendicular distance is 20
  const distMid = EraserEngine.distanceToSegment(50, 20, 0, 0, 100, 0);
  assert.equal(Math.round(distMid), 20);

  // Test point (-10, 0) -> distance to endpoint (0, 0) is 10
  const distStart = EraserEngine.distanceToSegment(-10, 0, 0, 0, 100, 0);
  assert.equal(Math.round(distStart), 10);

  // Test point (120, 0) -> distance to endpoint (100, 0) is 20
  const distEnd = EraserEngine.distanceToSegment(120, 0, 0, 0, 100, 0);
  assert.equal(Math.round(distEnd), 20);
});

test('Full Stroke Erase deletes entire intersecting stroke and leaves others untouched', () => {
  const stroke1 = {
    id: 's1',
    color: '#2563eb',
    width: 4,
    points: [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: 100, y: 100 }
    ]
  };
  const stroke2 = {
    id: 's2',
    color: '#ef4444',
    width: 2,
    points: [
      { x: 300, y: 300 },
      { x: 350, y: 350 }
    ]
  };

  const strokes = [stroke1, stroke2];

  // Erase near stroke1 at (50, 50) with radius 15
  const result = EraserEngine.eraseFullStrokes(strokes, 50, 50, 15);

  assert.equal(result.removedStrokes.length, 1);
  assert.equal(result.removedStrokes[0].id, 's1');
  assert.equal(result.remainingStrokes.length, 1);
  assert.equal(result.remainingStrokes[0].id, 's2');
});

test('Full Stroke Erase does nothing if eraser does not intersect any stroke', () => {
  const stroke = {
    id: 's1',
    points: [{ x: 0, y: 0 }, { x: 50, y: 50 }]
  };

  const result = EraserEngine.eraseFullStrokes([stroke], 400, 400, 20);
  assert.equal(result.removedStrokes.length, 0);
  assert.equal(result.remainingStrokes.length, 1);
});

test('Partial Stroke Erase cuts stroke and splits into sub-strokes', () => {
  // Horizontal line from x=0 to x=100 with points every 10px
  const points = [];
  for (let x = 0; x <= 100; x += 10) {
    points.push({ x, y: 50 });
  }

  const stroke = {
    id: 'stroke_split_test',
    color: '#10b981',
    width: 4,
    points
  };

  // Erase at (50, 50) with radius 15 -> points at x=40, 50, 60 will be erased
  const result = EraserEngine.erasePartialStrokes([stroke], 50, 50, 15);

  assert.equal(result.modified, true);
  // Should produce 2 sub-strokes: one for x=0..30 and one for x=70..100
  assert.equal(result.updatedStrokes.length, 2);

  const leftStroke = result.updatedStrokes[0];
  const rightStroke = result.updatedStrokes[1];

  assert.equal(leftStroke.color, '#10b981');
  assert.equal(rightStroke.color, '#10b981');
  assert.ok(leftStroke.points.every(p => p.x <= 30));
  assert.ok(rightStroke.points.every(p => p.x >= 70));
});

test('EraseStrokesCommand integrates with HistoryManager for undo/redo', () => {
  const doc = new DocumentModel();
  const history = new HistoryManager();

  const strokeA = { id: 'sa', color: '#000', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] };
  const strokeB = { id: 'sb', color: '#000', points: [{ x: 50, y: 50 }, { x: 60, y: 60 }] };

  doc.globalAnnotations = [strokeA, strokeB];

  // Erase strokeA
  const remaining = [strokeB];
  history.execute(new EraseStrokesCommand(doc, [strokeA, strokeB], remaining));

  assert.equal(doc.globalAnnotations.length, 1);
  assert.equal(doc.globalAnnotations[0].id, 'sb');

  // Undo
  history.undo();
  assert.equal(doc.globalAnnotations.length, 2);
  assert.equal(doc.globalAnnotations[0].id, 'sa');
  assert.equal(doc.globalAnnotations[1].id, 'sb');

  // Redo
  history.redo();
  assert.equal(doc.globalAnnotations.length, 1);
  assert.equal(doc.globalAnnotations[0].id, 'sb');
});
