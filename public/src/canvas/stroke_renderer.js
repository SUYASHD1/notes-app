// Vector Ink Engine with Bézier Spline Interpolation & Velocity/Pressure Tapering

export class StrokeRenderer {
  /**
   * Smooths raw sampled points using mid-point averaging.
   */
  static smoothPoints(rawPoints) {
    if (!rawPoints || rawPoints.length < 3) return rawPoints ? [...rawPoints] : [];
    const smoothed = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length - 1; i++) {
      const p1 = rawPoints[i];
      const p2 = rawPoints[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const midPressure = ((p1.pressure ?? 0.5) + (p2.pressure ?? 0.5)) / 2;
      const time = p2.time || (p1.time ? p1.time + 16 : 0);
      smoothed.push({ x: midX, y: midY, pressure: midPressure, time });
    }
    smoothed.push(rawPoints[rawPoints.length - 1]);
    return smoothed;
  }

  /**
   * Computes dynamic tapered stroke widths along a sequence of points
   * based on movement velocity and stylus pressure.
   */
  static computeTaperedWidths(points, baseWidth = 3, minFactor = 0.4, maxFactor = 1.6) {
    if (!points || points.length === 0) return [];
    if (points.length === 1) return [baseWidth * (points[0].pressure ?? 0.5) * 2];

    const widths = [];
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const dist = Math.hypot(dx, dy);
      const dt = Math.max(1, (next.time || (i + 1) * 16) - (prev.time || (i - 1) * 16));
      const velocity = dist / dt; // pixels per millisecond

      // Fast stroke -> thinner width; slow stroke -> thicker width
      const velocityFactor = Math.max(0.6, Math.min(1.4, 1.0 - (velocity - 0.5) * 0.3));
      const pressure = curr.pressure !== undefined ? curr.pressure : 0.5;
      const pressureFactor = 0.5 + pressure; // 0.5 to 1.5

      let width = baseWidth * velocityFactor * pressureFactor;
      width = Math.max(baseWidth * minFactor, Math.min(baseWidth * maxFactor, width));
      widths.push(width);
    }
    return widths;
  }

  /**
   * Generates SVG path data string using smooth cubic Bézier curves.
   */
  static pointsToSvgPath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const pCurr = points[i];
      const pNext = points[i + 1];
      const midX = (pCurr.x + pNext.x) / 2;
      const midY = (pCurr.y + pNext.y) / 2;
      d += ` Q ${pCurr.x} ${pCurr.y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }
}
