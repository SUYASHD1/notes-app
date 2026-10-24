import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewport, FunctionPlotter, StrokeEngine, DocumentModel, createBlankDocument, createSampleDocument } from '../src/core.js';

test('Viewport transformation math', () => {
  const vp = new Viewport(100, 50, 2);
  const screen = vp.worldToScreen(10, 20);
  assert.equal(screen.x, 120);
  assert.equal(screen.y, 90);

  const world = vp.screenToWorld(120, 90);
  assert.equal(world.x, 10);
  assert.equal(world.y, 20);

  vp.pan(50, -20);
  assert.equal(vp.x, 150);
  assert.equal(vp.y, 30);
});

test('FunctionPlotter evaluation and point generation', () => {
  const valSin0 = FunctionPlotter.evaluateExpression('sin(x)', 0);
  assert.equal(valSin0, 0);

  const valSinHalfPi = FunctionPlotter.evaluateExpression('sin(x)', Math.PI / 2);
  assert.ok(Math.abs(valSinHalfPi - 1) < 1e-9);

  const valPoly = FunctionPlotter.evaluateExpression('x^2 - 4', 3);
  assert.equal(valPoly, 5);

  const points = FunctionPlotter.generatePlotPoints('x^2', -2, 2, 4);
  assert.equal(points.length, 5);
  assert.equal(points[0].x, -2);
  assert.equal(points[0].y, 4);
  assert.equal(points[2].x, 0);
  assert.equal(points[2].y, 0);
});

test('StrokeEngine smoothing and containment', () => {
  const raw = [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 10, y: 10, pressure: 0.8 },
    { x: 20, y: 0, pressure: 0.5 }
  ];
  const smoothed = StrokeEngine.smoothPoints(raw);
  assert.equal(smoothed.length, 3);
  assert.equal(smoothed[1].x, 15);
  assert.equal(smoothed[1].y, 5);

  const box = { x: 100, y: 100, width: 200, height: 150 };
  assert.equal(StrokeEngine.isPointInBox({ x: 150, y: 150 }, box), true);
  assert.equal(StrokeEngine.isPointInBox({ x: 50, y: 50 }, box), false);
});

test('DocumentModel state manipulation and serialization', () => {
  const doc = new DocumentModel({ title: 'Physics Notes' });
  const textBlock = doc.addBlock({
    type: 'text',
    x: 50,
    y: 100,
    width: 300,
    content: 'Newton laws of motion'
  });
  assert.ok(textBlock.id);
  assert.equal(doc.blocks.length, 1);

  doc.addAnnotation({
    color: '#ff0000',
    width: 3,
    points: [{ x: 5, y: 5 }, { x: 100, y: 100 }]
  });
  assert.equal(doc.globalAnnotations.length, 1);

  const json = doc.toJSON();
  assert.equal(json.title, 'Physics Notes');
  assert.equal(json.blocks.length, 1);
  assert.equal(json.globalAnnotations.length, 1);
});

test('Universal Note Container mixed-media items lifecycle', () => {
  const doc = new DocumentModel({ title: 'Universal Container Test' });
  const note = doc.addBlock({
    type: 'note_container',
    x: 100,
    y: 100,
    width: 500,
    items: [
      { id: 'i1', type: 'text', content: 'Intro' },
      { id: 'i2', type: 'table', data: [['A', 'B'], ['1', '2']] },
      { id: 'i3', type: 'plot', formula: 'cos(x)' },
      { id: 'i4', type: 'image', src: 'data:image/png;base64,sample', caption: 'Diagram.png' },
      { id: 'i5', type: 'pdf', title: 'Lecture_Slides.pdf', totalPages: 4 }
    ]
  });

  assert.equal(doc.blocks.length, 1);
  assert.equal(note.items.length, 5);
  assert.equal(note.items[0].type, 'text');
  assert.equal(note.items[1].type, 'table');
  assert.equal(note.items[2].type, 'plot');
  assert.equal(note.items[3].type, 'image');
  assert.equal(note.items[4].type, 'pdf');

  // Serialize and deserialize
  const serialized = JSON.stringify(doc.toJSON());
  const restored = DocumentModel.fromJSON(serialized);
  assert.equal(restored.blocks.length, 1);
  assert.equal(restored.blocks[0].items.length, 5);
  assert.equal(restored.blocks[0].items[1].data[0][0], 'A');
  assert.equal(restored.blocks[0].items[3].caption, 'Diagram.png');
  assert.equal(restored.blocks[0].items[4].totalPages, 4);
});

test('Sample notebook and blank document generation', () => {
  const blank = createBlankDocument('test_page_123');
  assert.equal(blank.id, 'test_page_123');
  assert.equal(blank.blocks.length, 0);

  const sample = createSampleDocument('nb_physics_demo_p1');
  assert.equal(sample.id, 'nb_physics_demo_p1');
  assert.equal(sample.blocks.length, 2);
  assert.equal(sample.blocks[0].title, 'Kinematics & Derivatives');
  assert.equal(sample.blocks[1].title, 'Lecture Slides & Materials');
});

