import test from 'node:test';
import assert from 'node:assert/strict';
import { StrokeRenderer } from '../src/canvas/stroke_renderer.js';

test('Stroke smoothing produces midpoint-interpolated points', () => {
  const raw = [
    { x: 0, y: 0, pressure: 0.2 },
    { x: 20, y: 40, pressure: 0.8 },
    { x: 40, y: 0, pressure: 0.4 }
  ];
  const smoothed = StrokeRenderer.smoothPoints(raw);

  assert.equal(smoothed.length, 3);
  assert.equal(smoothed[0].x, 0);
  assert.equal(smoothed[1].x, 30); // mid of (20, 40) is 30
  assert.equal(smoothed[1].y, 20); // mid of (40, 0) is 20
  assert.ok(Math.abs(smoothed[1].pressure - 0.6) < 1e-6);
  assert.equal(smoothed[2].x, 40);
});

test('Dynamic velocity & pressure tapering modulates width', () => {
  const points = [
    { x: 0, y: 0, pressure: 0.2, time: 0 },
    // Fast stroke: 100px in 10ms -> high velocity
    { x: 100, y: 0, pressure: 0.3, time: 10 },
    // Slow stroke: 10px in 100ms -> low velocity, high pressure
    { x: 110, y: 0, pressure: 0.9, time: 110 }
  ];

  const widths = StrokeRenderer.computeTaperedWidths(points, 4.0);
  assert.equal(widths.length, 3);
  // High pressure, low velocity should produce a thicker stroke than low pressure, high velocity
  assert.ok(widths[2] > widths[0], `Expected width[2] (${widths[2]}) > width[0] (${widths[0]})`);
});

test('SVG path command generation from points', () => {
  const points = [
    { x: 10, y: 10 },
    { x: 50, y: 80 },
    { x: 90, y: 20 }
  ];
  const svgPath = StrokeRenderer.pointsToSvgPath(points);
  assert.ok(svgPath.startsWith('M 10 10'));
  assert.ok(svgPath.includes('Q 50 80'));
  assert.ok(svgPath.endsWith('L 90 20'));
});
