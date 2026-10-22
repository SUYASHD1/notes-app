const fs = require('fs');
const path = require('path');

// 1. src/core.js
const coreContent = `// Core Mathematical & Document Models for Notes App

export class Viewport {
  constructor(x = 0, y = 0, zoom = 1) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = 0.2;
    this.maxZoom = 4.0;
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.x) / this.zoom,
      y: (screenY - this.y) / this.zoom
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.zoom + this.x,
      y: worldY * this.zoom + this.y
    };
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  zoomAt(screenX, screenY, factor) {
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    if (newZoom === this.zoom) return;
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.zoom = newZoom;
    this.x = screenX - worldBefore.x * this.zoom;
    this.y = screenY - worldBefore.y * this.zoom;
  }
}

export class FunctionPlotter {
  static evaluateExpression(expr, x) {
    const sanitized = expr
      .replace(/\\^/g, '**')
      .replace(/\\bsin\\b/g, 'Math.sin')
      .replace(/\\bcos\\b/g, 'Math.cos')
      .replace(/\\btan\\b/g, 'Math.tan')
      .replace(/\\bexp\\b/g, 'Math.exp')
      .replace(/\\bln\\b/g, 'Math.log')
      .replace(/\\bsqrt\\b/g, 'Math.sqrt')
      .replace(/\\bpi\\b/gi, 'Math.PI')
      .replace(/\\be\\b/g, 'Math.E')
      .replace(/\\babs\\b/g, 'Math.abs');

    try {
      const fn = new Function('x', 'Math', 'return ' + sanitized + ';');
      const val = fn(x, Math);
      return Number.isFinite(val) ? val : null;
    } catch {
      return null;
    }
  }

  static generatePlotPoints(expr, xMin = -10, xMax = 10, steps = 200) {
    const points = [];
    const stepSize = (xMax - xMin) / steps;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * stepSize;
      const y = this.evaluateExpression(expr, x);
      points.push({ x, y });
    }
    return points;
  }
}

export class StrokeEngine {
  static smoothPoints(rawPoints) {
    if (!rawPoints || rawPoints.length < 2) return rawPoints || [];
    const smoothed = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length - 1; i++) {
      const p1 = rawPoints[i];
      const p2 = rawPoints[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const midPressure = ((p1.pressure || 0.5) + (p2.pressure || 0.5)) / 2;
      smoothed.push({ x: midX, y: midY, pressure: midPressure });
    }
    smoothed.push(rawPoints[rawPoints.length - 1]);
    return smoothed;
  }

  static isPointInBox(point, box) {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  }
}

export class DocumentModel {
  constructor(data = {}) {
    this.id = data.id || 'doc_' + Date.now();
    this.title = data.title || 'Untitled Note';
    this.viewport = data.viewport || { x: 0, y: 0, zoom: 1 };
    this.blocks = data.blocks || [];
    this.globalAnnotations = data.globalAnnotations || [];
  }

  addBlock(block) {
    if (!block.id) block.id = 'block_' + Math.random().toString(36).substr(2, 9);
    this.blocks.push(block);
    return block;
  }

  removeBlock(id) {
    this.blocks = this.blocks.filter(b => b.id !== id);
  }

  updateBlock(id, updates) {
    const block = this.blocks.find(b => b.id === id);
    if (block) Object.assign(block, updates);
    return block;
  }

  addAnnotation(stroke) {
    if (!stroke.id) stroke.id = 'stroke_' + Math.random().toString(36).substr(2, 9);
    this.globalAnnotations.push(stroke);
    return stroke;
  }

  clearAnnotations() {
    this.globalAnnotations = [];
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      viewport: this.viewport,
      blocks: this.blocks,
      globalAnnotations: this.globalAnnotations
    };
  }
}
`;

// 2. tests/core.test.js
const testContent = `import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewport, FunctionPlotter, StrokeEngine, DocumentModel } from '../src/core.js';

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
`;

fs.writeFileSync(path.join(__dirname, 'src', 'core.js'), coreContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'tests', 'core.test.js'), testContent, 'utf8');
console.log('Core files generated successfully!');
