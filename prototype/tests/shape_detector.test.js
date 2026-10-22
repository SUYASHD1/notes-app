import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeDetector } from '../src/canvas/shape_detector.js';
import { ShapeType } from '../src/core/types.js';

test('Straight Line detection with minor noise', () => {
  const points = [];
  for (let i = 0; i <= 20; i++) {
    // Almost straight line with slight jitter
    const jitter = (i % 2 === 0 ? 0.3 : -0.3);
    points.push({ x: i * 10, y: i * 5 + jitter });
  }

  const result = ShapeDetector.detectShape(points, 500);
  assert.equal(result.detected, true);
  assert.equal(result.type, ShapeType.LINE);
  assert.equal(result.geometry.start.x, 0);
  assert.equal(result.geometry.end.x, 200);
});

test('Circle detection from closed circular path', () => {
  const points = [];
  const cx = 100, cy = 100, r = 50;
  for (let i = 0; i <= 36; i++) {
    const angle = (i / 36) * 2 * Math.PI;
    const jitter = (i % 3 === 0 ? 1 : -1);
    points.push({
      x: cx + (r + jitter) * Math.cos(angle),
      y: cy + (r + jitter) * Math.sin(angle)
    });
  }

  const result = ShapeDetector.detectShape(points, 600);
  assert.equal(result.detected, true);
  assert.equal(result.type, ShapeType.CIRCLE);
  assert.ok(Math.abs(result.geometry.cx - 100) < 5);
  assert.ok(Math.abs(result.geometry.cy - 100) < 5);
  assert.ok(Math.abs(result.geometry.radius - 50) < 5);
});

test('Rectangle detection from 4-side perimeter path', () => {
  const points = [];
  // Top edge (0,0) -> (100,0)
  for (let x = 0; x <= 100; x += 10) points.push({ x, y: 0 });
  // Right edge (100,0) -> (100,60)
  for (let y = 10; y <= 60; y += 10) points.push({ x: 100, y });
  // Bottom edge (100,60) -> (0,60)
  for (let x = 90; x >= 0; x -= 10) points.push({ x, y: 60 });
  // Left edge (0,60) -> (0,0)
  for (let y = 50; y >= 0; y -= 10) points.push({ x: 0, y });

  const result = ShapeDetector.detectShape(points, 450);
  assert.equal(result.detected, true);
  assert.equal(result.type, ShapeType.RECTANGLE);
  assert.equal(result.geometry.width, 100);
  assert.equal(result.geometry.height, 60);
});

test('Rejection of arbitrary handwriting scribbles', () => {
  const scribble = [];
  for (let i = 0; i < 30; i++) {
    scribble.push({
      x: i * 5,
      y: Math.sin(i * 0.8) * 40 + (i % 5) * 10
    });
  }

  const result = ShapeDetector.detectShape(scribble, 500);
  assert.equal(result.detected, false);
  assert.equal(result.type, ShapeType.NONE);
});

test('Rejection when hold duration is below threshold (<400ms)', () => {
  const linePoints = [];
  for (let i = 0; i <= 20; i++) {
    linePoints.push({ x: i * 10, y: i * 5 });
  }

  const result = ShapeDetector.detectShape(linePoints, 200); // 200ms < 400ms
  assert.equal(result.detected, false);
  assert.equal(result.type, ShapeType.NONE);
});

test('Triangle detection from 3-side closed path', () => {
  const points = [];
  // Side 1: (50, 0) -> (100, 80)
  for (let t = 0; t <= 10; t++) points.push({ x: 50 + t * 5, y: t * 8 });
  // Side 2: (100, 80) -> (0, 80)
  for (let t = 1; t <= 10; t++) points.push({ x: 100 - t * 10, y: 80 });
  // Side 3: (0, 80) -> (50, 0)
  for (let t = 1; t <= 10; t++) points.push({ x: t * 5, y: 80 - t * 8 });

  const result = ShapeDetector.detectShape(points, 500);
  assert.equal(result.detected, true);
  assert.equal(result.type, ShapeType.TRIANGLE);
  assert.ok(result.geometry.p1);
  assert.ok(result.geometry.p2);
  assert.ok(result.geometry.p3);
});

