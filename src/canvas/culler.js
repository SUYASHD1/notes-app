// Viewport Frustum Culling Engine for high-performance canvas rendering

export class FrustumCuller {
  /**
   * Check if two 2D Axis-Aligned Bounding Boxes (AABB) intersect.
   */
  static intersects(a, b) {
    return (
      a.minX <= b.maxX &&
      a.maxX >= b.minX &&
      a.minY <= b.maxY &&
      a.maxY >= b.minY
    );
  }

  /**
   * Calculates the bounding box of a content block.
   */
  static getBlockBounds(block) {
    const x = block.x || 0;
    const y = block.y || 0;
    const width = typeof block.width === 'number' ? block.width : 320;
    const height = typeof block.height === 'number' ? block.height : (block.actualHeight || 800);

    return {
      minX: x,
      minY: y,
      maxX: x + width,
      maxY: y + height
    };
  }

  /**
   * Calculates the bounding box of an ink stroke.
   */
  static getStrokeBounds(stroke) {
    const points = stroke.points || [];
    if (points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const padding = (stroke.width || 2) * 2;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    };
  }

  /**
   * Filters blocks to only those visible within the viewport bounding box.
   */
  static cullBlocks(blocks, visibleBounds) {
    if (!visibleBounds || !Array.isArray(blocks)) return blocks || [];
    const culled = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const bounds = this.getBlockBounds(block);
      if (this.intersects(bounds, visibleBounds)) {
        culled.push(block);
      }
    }
    return culled;
  }

  /**
   * Filters ink strokes to only those visible within the viewport bounding box.
   */
  static cullStrokes(strokes, visibleBounds) {
    if (!visibleBounds || !Array.isArray(strokes)) return strokes || [];
    const culled = [];
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      const bounds = this.getStrokeBounds(stroke);
      if (this.intersects(bounds, visibleBounds)) {
        culled.push(stroke);
      }
    }
    return culled;
  }
}
