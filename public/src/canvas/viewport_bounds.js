// Canvas Boundary Clamping & Dynamic Spatial Extension Engine

export function getCanvasContentBounds(doc) {
  let minX = 40;
  let minY = 40;
  let maxX = 2600; // comfortable multi-column initial width
  let maxY = 1800; // comfortable initial height

  if (doc && doc.blocks) {
    for (const b of doc.blocks) {
      const bx = b.x || 0;
      const by = b.y || 0;
      const right = bx + (b.width || 520);
      const bottom = by + (b.height || 400);

      if (bx < minX) minX = bx;
      if (by < minY) minY = by;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
  }

  return {
    minX,
    minY,
    width: maxX + 800, // 800px breathing room
    height: maxY + 800
  };
}

export function clampViewportBounds({ viewport, doc, containerWidth = window.innerWidth }) {
  if (!viewport) return;
  const bounds = getCanvasContentBounds(doc);

  // Dynamic safety: if content exists above y=40, allow camera to reach it; otherwise lock at y=40
  const maxCameraY = bounds.minY < 40 ? Math.max(40, 40 - bounds.minY * viewport.zoom) : 40;
  viewport.y = Math.min(maxCameraY, viewport.y);

  // Left boundary locked so you cannot scroll into the void past left origin
  const maxCameraX = bounds.minX < 40 ? Math.max(40, 40 - bounds.minX * viewport.zoom) : 40;
  const minX = Math.min(maxCameraX, containerWidth - bounds.width * viewport.zoom);
  viewport.x = Math.max(minX, Math.min(maxCameraX, viewport.x));
}
