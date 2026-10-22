// 8-Point Bounding Box Resize Engine with 1:1 Zoom Compensation

export const ResizeHandleType = Object.freeze({
  NW: 'nw',
  N: 'n',
  NE: 'ne',
  E: 'e',
  SE: 'se',
  S: 's',
  SW: 'sw',
  W: 'w'
});

export class ResizeHandleEngine {
  /**
   * Calculates new bounding box coordinates when dragging a specific handle.
   * Enforces minimum width and height.
   */
  static applyResize(handle, origBox, dx, dy, minWidth = 50, minHeight = 40) {
    let { x, y, width, height } = origBox;

    switch (handle) {
      case ResizeHandleType.SE:
        width = Math.max(minWidth, width + dx);
        height = Math.max(minHeight, height + dy);
        break;
      case ResizeHandleType.E:
        width = Math.max(minWidth, width + dx);
        break;
      case ResizeHandleType.S:
        height = Math.max(minHeight, height + dy);
        break;
      case ResizeHandleType.NW: {
        const newW = Math.max(minWidth, width - dx);
        const newH = Math.max(minHeight, height - dy);
        x += (width - newW);
        y += (height - newH);
        width = newW;
        height = newH;
        break;
      }
      case ResizeHandleType.W: {
        const newW = Math.max(minWidth, width - dx);
        x += (width - newW);
        width = newW;
        break;
      }
      case ResizeHandleType.N: {
        const newH = Math.max(minHeight, height - dy);
        y += (height - newH);
        height = newH;
        break;
      }
      case ResizeHandleType.NE: {
        width = Math.max(minWidth, width + dx);
        const newH = Math.max(minHeight, height - dy);
        y += (height - newH);
        height = newH;
        break;
      }
      case ResizeHandleType.SW: {
        const newW = Math.max(minWidth, width - dx);
        x += (width - newW);
        width = newW;
        height = Math.max(minHeight, height + dy);
        break;
      }
    }

    return { x, y, width, height };
  }

  /**
   * Compensates handle visual size based on zoom so handles remain physically 10px on screen.
   */
  static getHandleSizeWorld(zoom, baseSizePx = 10) {
    return baseSizePx / Math.max(0.1, zoom);
  }
}
