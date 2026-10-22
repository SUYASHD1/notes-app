// Infinite Canvas Viewport Transformation Engine

export class Viewport {
  constructor(x = 0, y = 0, zoom = 1, minZoom = 0.2, maxZoom = 4.0) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
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
    const targetZoom = this.zoom * factor;
    const clampedZoom = Math.min(this.maxZoom, Math.max(this.minZoom, targetZoom));
    if (clampedZoom === this.zoom) return;

    const worldBefore = this.screenToWorld(screenX, screenY);
    this.zoom = clampedZoom;
    this.x = screenX - worldBefore.x * this.zoom;
    this.y = screenY - worldBefore.y * this.zoom;
  }

  /**
   * Returns the visible world coordinate bounding box with an optional margin/buffer.
   */
  getVisibleBounds(screenWidth, screenHeight, buffer = 100) {
    const topLeft = this.screenToWorld(-buffer, -buffer);
    const bottomRight = this.screenToWorld(screenWidth + buffer, screenHeight + buffer);

    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxX: Math.max(topLeft.x, bottomRight.x),
      maxY: Math.max(topLeft.y, bottomRight.y)
    };
  }
}
