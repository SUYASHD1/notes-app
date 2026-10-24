import test from 'node:test';
import assert from 'node:assert';
import { Viewport } from '../src/canvas/viewport.js';
import { getCanvasContentBounds, clampViewportBounds } from '../src/canvas/viewport_bounds.js';

test('getCanvasContentBounds computes correct default and expanded dimensions', () => {
  const emptyDoc = { blocks: [] };
  const bounds1 = getCanvasContentBounds(emptyDoc);
  assert.strictEqual(bounds1.minX, 40);
  assert.strictEqual(bounds1.minY, 40);
  assert.strictEqual(bounds1.width, 2600 + 800);
  assert.strictEqual(bounds1.height, 1800 + 800);

  const docWithBlocks = {
    blocks: [
      { x: 100, y: 150, width: 400, height: 300 },
      { x: 3000, y: 2200, width: 500, height: 400 }
    ]
  };
  const bounds2 = getCanvasContentBounds(docWithBlocks);
  assert.strictEqual(bounds2.width, 3500 + 800);
  assert.strictEqual(bounds2.height, 2600 + 800);
});

test('clampViewportBounds prevents panning into void and rescues negative content', () => {
  const vp = new Viewport(100, 100, 1.0);
  const doc = { blocks: [{ x: 40, y: 40, width: 500, height: 400 }] };

  // Viewport at (100, 100) should be clamped to max origin of 40
  clampViewportBounds({ viewport: vp, doc, containerWidth: 1200 });
  assert.strictEqual(vp.x, 40);
  assert.strictEqual(vp.y, 40);

  // If a block exists at negative coordinate y = -100, safety allows scrolling up to view it
  const strandedDoc = { blocks: [{ x: -20, y: -100, width: 500, height: 400 }] };
  vp.y = 80;
  clampViewportBounds({ viewport: vp, doc: strandedDoc, containerWidth: 1200 });
  assert.ok(vp.y <= 140);
});
