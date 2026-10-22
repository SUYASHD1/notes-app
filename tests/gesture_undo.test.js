import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchGestureRecognizer } from '../src/canvas/gestures.js';
import { GestureType } from '../src/core/types.js';
import { HistoryManager, AddBlockCommand } from '../src/core/history.js';
import { DocumentModel } from '../src/core/document.js';

test('Recognize double-tap within <=300ms and <=20px', () => {
  let doubleTapFired = false;
  const recognizer = new TouchGestureRecognizer({
    onDoubleTap: () => {
      doubleTapFired = true;
    }
  });

  const now = 1000;
  // First tap
  const res1 = recognizer.processTap(100, 100, now);
  assert.equal(res1.type, GestureType.TAP);
  assert.equal(doubleTapFired, false);

  // Second tap 150ms later, 5px away
  const res2 = recognizer.processTap(104, 103, now + 150);
  assert.equal(res2.type, GestureType.DOUBLE_TAP);
  assert.equal(doubleTapFired, true);
});

test('Reject double-tap when time interval exceeds threshold (>300ms)', () => {
  let doubleTapFired = false;
  const recognizer = new TouchGestureRecognizer({
    onDoubleTap: () => {
      doubleTapFired = true;
    }
  });

  const now = 1000;
  recognizer.processTap(100, 100, now);
  // Second tap 450ms later (>300ms)
  const res2 = recognizer.processTap(100, 100, now + 450);
  assert.equal(res2.type, GestureType.TAP);
  assert.equal(doubleTapFired, false);
});

test('Reject double-tap when distance exceeds threshold (>20px)', () => {
  let doubleTapFired = false;
  const recognizer = new TouchGestureRecognizer({
    onDoubleTap: () => {
      doubleTapFired = true;
    }
  });

  const now = 1000;
  recognizer.processTap(100, 100, now);
  // Second tap 100ms later, but 50px away
  const res2 = recognizer.processTap(150, 100, now + 100);
  assert.equal(res2.type, GestureType.TAP);
  assert.equal(doubleTapFired, false);
});

test('Double-tap triggers Document undo via HistoryManager', () => {
  const doc = new DocumentModel();
  const history = new HistoryManager();

  const recognizer = new TouchGestureRecognizer({
    onDoubleTap: () => {
      history.undo();
    }
  });

  // Execute add block command
  history.execute(new AddBlockCommand(doc, { id: 'block_1', type: 'text', content: 'Test Note' }));
  assert.equal(doc.blocks.length, 1);
  assert.ok(history.canUndo());

  // Trigger double-tap
  const now = 2000;
  recognizer.processTap(200, 200, now);
  recognizer.processTap(202, 201, now + 120);

  // Undo should have been executed
  assert.equal(doc.blocks.length, 0);
  assert.ok(history.canRedo());

  // Redo test
  history.redo();
  assert.equal(doc.blocks.length, 1);
  assert.equal(doc.blocks[0].id, 'block_1');
});

test('Process two-finger move computes pinch-to-zoom scale and panDelta', () => {
  let zoomResult = null;
  const recognizer = new TouchGestureRecognizer({
    onPinchZoom: (res) => {
      zoomResult = res;
    }
  });

  const t1_start = { x: 100, y: 200 };
  const t2_start = { x: 200, y: 200 };
  // Initial distance = 100, center = (150, 200)
  const init = recognizer.processTwoFingerMove(t1_start, t2_start);
  assert.equal(init, null); // Initial anchor establishes baseline

  // Fingers spread apart (distance 200) and shift right by 50px (center 200, 200)
  const t1_spread = { x: 100, y: 200 };
  const t2_spread = { x: 300, y: 200 };
  const move1 = recognizer.processTwoFingerMove(t1_spread, t2_spread);

  assert.ok(move1);
  assert.equal(move1.type, GestureType.PINCH_ZOOM);
  assert.equal(move1.scaleFactor, 2); // 200 / 100 = 2x zoom
  assert.equal(move1.center.x, 200);
  assert.equal(move1.panDelta.dx, 50); // 200 - 150 = 50px pan
  assert.equal(zoomResult.panDelta.dx, 50);

  // Reset pinch clears initial distance and center
  recognizer.resetPinch();
  assert.equal(recognizer.initialPinchDistance, null);
  assert.equal(recognizer.lastCenter, null);
});

