// Pure Vector Eraser Engine for Freeform Ink Annotations

export class EraserEngine {
  /**
   * Calculates minimum distance from point (px, py) to line segment (x1, y1) -> (x2, y2).
   */
  static distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      const dpx = px - x1;
      const dpy = py - y1;
      return Math.sqrt(dpx * dpx + dpy * dpy);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const diffX = px - projX;
    const diffY = py - projY;

    return Math.sqrt(diffX * diffX + diffY * diffY);
  }

  /**
   * Checks whether a stroke intersects an eraser circle at (worldX, worldY) with radius.
   */
  static strokeIntersectsCircle(stroke, worldX, worldY, radius) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return false;

    // Single point test
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      const dx = p.x - worldX;
      const dy = p.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= radius + (stroke.width || 2) / 2;
    }

    const effectiveRadius = radius + (stroke.width || 2) / 2;

    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      const dist = this.distanceToSegment(worldX, worldY, p1.x, p1.y, p2.x, p2.y);
      if (dist <= effectiveRadius) {
        return true;
      }
    }

    return false;
  }

  /**
   * OneNote-style Full Stroke Eraser:
   * Touching any part of a stroke removes the entire stroke.
   * Returns { remainingStrokes, removedStrokes }
   */
  static eraseFullStrokes(strokes, worldX, worldY, radius) {
    if (!Array.isArray(strokes) || strokes.length === 0) {
      return { remainingStrokes: [], removedStrokes: [] };
    }

    const remainingStrokes = [];
    const removedStrokes = [];

    for (const stroke of strokes) {
      if (this.strokeIntersectsCircle(stroke, worldX, worldY, radius)) {
        removedStrokes.push(stroke);
      } else {
        remainingStrokes.push(stroke);
      }
    }

    return { remainingStrokes, removedStrokes };
  }

  /**
   * Partial Stroke Eraser:
   * Slices out the points and segments within the eraser circle.
   * Splits the stroke into separate remaining sub-strokes.
   * Returns { updatedStrokes, modified }
   */
  static erasePartialStrokes(strokes, worldX, worldY, radius) {
    if (!Array.isArray(strokes) || strokes.length === 0) {
      return { updatedStrokes: [], modified: false };
    }

    let anyModified = false;
    const updatedStrokes = [];

    for (const stroke of strokes) {
      if (!this.strokeIntersectsCircle(stroke, worldX, worldY, radius)) {
        updatedStrokes.push(stroke);
        continue;
      }

      anyModified = true;
      const effectiveRadius = radius + (stroke.width || 2) / 2;

      // Group points into continuous segments outside the eraser radius
      const subSegments = [];
      let currentSegment = [];

      for (const pt of stroke.points) {
        const dx = pt.x - worldX;
        const dy = pt.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > effectiveRadius) {
          currentSegment.push(pt);
        } else {
          if (currentSegment.length >= 2) {
            subSegments.push(currentSegment);
          }
          currentSegment = [];
        }
      }

      if (currentSegment.length >= 2) {
        subSegments.push(currentSegment);
      }

      // Create new sub-strokes from remaining segments
      subSegments.forEach((pts, idx) => {
        updatedStrokes.push({
          id: `${stroke.id}_part_${idx}_${Date.now()}`,
          color: stroke.color,
          width: stroke.width,
          points: pts,
          shapeType: stroke.shapeType || 'none'
        });
      });
    }

    return { updatedStrokes, modified: anyModified };
  }
}
