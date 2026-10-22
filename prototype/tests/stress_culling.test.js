import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewport } from '../src/canvas/viewport.js';
import { FrustumCuller } from '../src/canvas/culler.js';
import { Sandbox } from '../src/core/sandbox.js';

test('Viewport Frustum Culling with 2,000 blocks', () => {
  const blocks = [];
  // Distribute 2,000 blocks across a 50,000 x 50,000 world plane
  for (let i = 0; i < 2000; i++) {
    blocks.push({
      id: 'block_' + i,
      x: (i % 50) * 1000,
      y: Math.floor(i / 50) * 1000,
      width: 200,
      height: 150
    });
  }

  // Position viewport at origin with 1920x1080 screen size
  const vp = new Viewport(0, 0, 1.0);
  const visibleBounds = vp.getVisibleBounds(1920, 1080, 100);

  const visibleBlocks = FrustumCuller.cullBlocks(blocks, visibleBounds);

  // In a 1920x1080 screen with 1000px spacing, only a handful of blocks should be visible (<= 10)
  assert.ok(visibleBlocks.length <= 10, `Expected <= 10 visible blocks, got ${visibleBlocks.length}`);
  assert.ok(visibleBlocks.length >= 1, `Expected at least 1 visible block near (0,0), got ${visibleBlocks.length}`);
});

test('Viewport Frustum Culling with 10,000 ink strokes', () => {
  const strokes = [];
  for (let i = 0; i < 10000; i++) {
    const baseX = (i % 100) * 500;
    const baseY = Math.floor(i / 100) * 500;
    strokes.push({
      id: 'stroke_' + i,
      width: 2,
      points: [
        { x: baseX, y: baseY, pressure: 0.5 },
        { x: baseX + 50, y: baseY + 50, pressure: 0.8 }
      ]
    });
  }

  const vp = new Viewport(0, 0, 1.0);
  const visibleBounds = vp.getVisibleBounds(1280, 720, 50);

  const visibleStrokes = FrustumCuller.cullStrokes(strokes, visibleBounds);
  // Only strokes intersecting [ -50, -50, 1330, 770 ] should be returned
  assert.ok(visibleStrokes.length < 25, `Expected < 25 visible strokes, got ${visibleStrokes.length}`);
  for (const s of visibleStrokes) {
    const b = FrustumCuller.getStrokeBounds(s);
    assert.ok(FrustumCuller.intersects(b, visibleBounds));
  }
});

test('Zero-Crash Sandboxing under malformed / chaos inputs', () => {
  // Test divide-by-zero expression
  const resDivZero = Sandbox.safeMathEval('1 / 0', 0);
  assert.equal(resDivZero, null, 'Division by zero must safely evaluate to null');

  // Test illegal token injection
  const resScriptInject = Sandbox.safeMathEval('process.exit(1)', 5);
  assert.equal(resScriptInject, null, 'Forbidden identifiers must safely evaluate to null');

  // Test malformed syntax
  const resBadSyntax = Sandbox.safeMathEval('sin(x ++-***)', 1);
  assert.equal(resBadSyntax, null, 'Syntax error must safely evaluate to null without throwing');

  // Test malformed JSON recovery
  const resBadJSON = Sandbox.parseJSON('{ not: valid: json }', { fallback: true });
  assert.deepEqual(resBadJSON, { fallback: true });

  // Test runSafe with error thrown
  const crashFn = () => { throw new Error('Simulated internal component fault'); };
  const safeRes = Sandbox.runSafe(crashFn, { recovered: true }, 'faulty_block_1');
  assert.equal(safeRes.success, false);
  assert.deepEqual(safeRes.value, { recovered: true });
  assert.equal(safeRes.error.blockId, 'faulty_block_1');
});
