// Touch Gesture Recognizer (Double-tap to undo, Pinch-to-zoom, Pan)

import { GestureType } from '../core/types.js';

export class TouchGestureRecognizer {
  constructor(options = {}) {
    this.maxDoubleTapIntervalMs = options.maxDoubleTapIntervalMs || 300;
    this.maxDoubleTapDistancePx = options.maxDoubleTapDistancePx || 20;

    this.lastTap = null; // { time, x, y }
    this.initialPinchDistance = null;
    this.onDoubleTap = options.onDoubleTap || null;
    this.onPinchZoom = options.onPinchZoom || null;
    this.onPan = options.onPan || null;
  }

  /**
   * Process a single tap/touch release event.
   * Returns recognized gesture event or null.
   */
  processTap(x, y, timestamp = Date.now()) {
    const currentTap = { x, y, time: timestamp };

    if (this.lastTap) {
      const dt = currentTap.time - this.lastTap.time;
      const dist = Math.hypot(currentTap.x - this.lastTap.x, currentTap.y - this.lastTap.y);

      if (dt <= this.maxDoubleTapIntervalMs && dist <= this.maxDoubleTapDistancePx) {
        // Recognized double tap!
        this.lastTap = null; // Reset to prevent triple tap false trigger
        if (typeof this.onDoubleTap === 'function') {
          this.onDoubleTap({ x, y, timestamp });
        }
        return {
          type: GestureType.DOUBLE_TAP,
          x,
          y,
          interval: dt,
          distance: dist
        };
      }
    }

    this.lastTap = currentTap;
    return {
      type: GestureType.TAP,
      x,
      y
    };
  }

  /**
   * Process two-finger touch pinch/zoom gesture.
   */
  processTwoFingerMove(touch1, touch2) {
    const dist = Math.hypot(touch2.x - touch1.x, touch2.y - touch1.y);
    const center = {
      x: (touch1.x + touch2.x) / 2,
      y: (touch1.y + touch2.y) / 2
    };

    if (this.initialPinchDistance === null) {
      this.initialPinchDistance = dist;
      this.lastCenter = center;
      return null;
    }

    const scaleFactor = dist / Math.max(1, this.initialPinchDistance);
    this.initialPinchDistance = dist;

    let panDelta = { dx: 0, dy: 0 };
    if (this.lastCenter) {
      panDelta = {
        dx: center.x - this.lastCenter.x,
        dy: center.y - this.lastCenter.y
      };
    }
    this.lastCenter = center;

    if (typeof this.onPinchZoom === 'function') {
      this.onPinchZoom({ scaleFactor, center, panDelta });
    }

    return {
      type: GestureType.PINCH_ZOOM,
      scaleFactor,
      center,
      panDelta
    };
  }

  resetPinch() {
    this.initialPinchDistance = null;
    this.lastCenter = null;
  }
}

