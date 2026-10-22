// Auto-Shape Detection Engine ("Draw and Hold")

import { ShapeType } from '../core/types.js';

export class ShapeDetector {
  /**
   * Evaluates a stroke's point trajectory to identify geometric shapes:
   * Straight Line, Circle, Rectangle, Arrow, or NONE.
   */
  static detectShape(points, holdDurationMs = 500) {
    if (!points || points.length < 8) {
      return { detected: false, type: ShapeType.NONE };
    }

    if (holdDurationMs < 400) {
      return { detected: false, type: ShapeType.NONE };
    }

    // Check Straight Line
    const lineCheck = this.checkStraightLine(points);
    if (lineCheck.isMatch) {
      return {
        detected: true,
        type: ShapeType.LINE,
        geometry: lineCheck.geometry
      };
    }

    // Check Arrow
    const arrowCheck = this.checkArrow(points);
    if (arrowCheck.isMatch) {
      return {
        detected: true,
        type: ShapeType.ARROW,
        geometry: arrowCheck.geometry
      };
    }

    // Check Circle / Ellipse
    const circleCheck = this.checkCircle(points);
    if (circleCheck.isMatch) {
      return {
        detected: true,
        type: ShapeType.CIRCLE,
        geometry: circleCheck.geometry
      };
    }

    // Check Rectangle
    // Check Triangle
    const triangleCheck = this.checkTriangle(points);
    if (triangleCheck.isMatch) {
      return {
        detected: true,
        type: ShapeType.TRIANGLE,
        geometry: triangleCheck.geometry
      };
    }

    // Check Rectangle
    const rectCheck = this.checkRectangle(points);
    if (rectCheck.isMatch) {
      return {
        detected: true,
        type: ShapeType.RECTANGLE,
        geometry: rectCheck.geometry
      };
    }

    // False-positive rejection: arbitrary handwriting or scribble
    return { detected: false, type: ShapeType.NONE };
  }

  static checkStraightLine(points) {
    const start = points[0];
    const end = points[points.length - 1];
    const chord = Math.hypot(end.x - start.x, end.y - start.y);

    let arc = 0;
    for (let i = 0; i < points.length - 1; i++) {
      arc += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }

    if (arc > 10 && chord / arc >= 0.90) {
      return {
        isMatch: true,
        geometry: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } }
      };
    }
    return { isMatch: false };
  }

  static checkCircle(points) {
    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < n; i++) {
      sumX += points[i].x;
      sumY += points[i].y;
    }
    const cx = sumX / n;
    const cy = sumY / n;

    const radii = [];
    let sumR = 0;
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(points[i].x - cx, points[i].y - cy);
      radii.push(r);
      sumR += r;
    }
    const meanR = sumR / n;
    if (meanR < 8) return { isMatch: false };

    let varianceSum = 0;
    for (let i = 0; i < n; i++) {
      varianceSum += Math.pow(radii[i] - meanR, 2);
    }
    const stdDev = Math.sqrt(varianceSum / n);
    const varianceRatio = stdDev / meanR;

    // Check if start and end are close enough for a closed loop
    const start = points[0];
    const end = points[n - 1];
    const closureDist = Math.hypot(end.x - start.x, end.y - start.y);

    if (closureDist / meanR > 0.6) return { isMatch: false };

    let perimeter = 0;
    for (let i = 0; i < n - 1; i++) {
      perimeter += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }
    const area = this.polygonArea(points);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

    if (varianceRatio <= 0.18 && circularity >= 0.75) {
      return {
        isMatch: true,
        geometry: { cx, cy, radius: meanR }
      };
    }
    return { isMatch: false };
  }

  static polygonArea(points) {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n - 1; i++) {
      area += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
    }
    area += points[n - 1].x * points[0].y - points[0].x * points[n - 1].y;
    return Math.abs(area) / 2;
  }

  static checkTriangle(points) {
    const n = points.length;
    const start = points[0];
    const end = points[n - 1];
    const closureDist = Math.hypot(end.x - start.x, end.y - start.y);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, points[i].x);
      minY = Math.min(minY, points[i].y);
      maxX = Math.max(maxX, points[i].x);
      maxY = Math.max(maxY, points[i].y);
    }
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 20 || height < 20) return { isMatch: false };

    if (closureDist / Math.max(width, height) > 0.45) return { isMatch: false };

    let arc = 0;
    for (let i = 0; i < n - 1; i++) {
      arc += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }

    const simplified = this.rdpSimplify(points, arc * 0.08);
    // Triangle should simplify to 4 points (3 corners + loop closure)
    if (simplified.length === 4) {
      return {
        isMatch: true,
        geometry: {
          p1: simplified[0],
          p2: simplified[1],
          p3: simplified[2]
        }
      };
    }

    return { isMatch: false };
  }

  static checkRectangle(points) {
    const n = points.length;
    const start = points[0];
    const end = points[n - 1];
    const closureDist = Math.hypot(end.x - start.x, end.y - start.y);

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, points[i].x);
      minY = Math.min(minY, points[i].y);
      maxX = Math.max(maxX, points[i].x);
      maxY = Math.max(maxY, points[i].y);
    }
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 20 || height < 20) return { isMatch: false };

    const maxDim = Math.max(width, height);
    if (closureDist / maxDim > 0.45) return { isMatch: false };

    const perimeter = 2 * (width + height);
    let arc = 0;
    for (let i = 0; i < n - 1; i++) {
      arc += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }

    // Check 1: RDP corner detection (4 unique vertices + loop closure = 5 points)
    const simplified = this.rdpSimplify(points, perimeter * 0.05);
    if (simplified.length >= 4 && simplified.length <= 6) {
      return {
        isMatch: true,
        geometry: { x: minX, y: minY, width, height }
      };
    }

    // Check 2: Perimeter proximity and edge distribution
    const perimeterRatio = Math.abs(arc - perimeter) / perimeter;
    if (perimeterRatio <= 0.32) {
      return {
        isMatch: true,
        geometry: { x: minX, y: minY, width, height }
      };
    }
    return { isMatch: false };
  }

  static rdpSimplify(points, epsilon) {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let index = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const d = this.perpendicularDistance(points[i], start, end);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left = this.rdpSimplify(points.slice(0, index + 1), epsilon);
      const right = this.rdpSimplify(points.slice(index), epsilon);
      return left.slice(0, -1).concat(right);
    } else {
      return [start, end];
    }
  }

  static perpendicularDistance(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const mag = Math.hypot(dx, dy);
    if (mag === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / mag;
  }

  static checkArrow(points) {
    const n = points.length;
    if (n < 10) return { isMatch: false };

    // An arrow drawn in one stroke typically has a shaft (first 70-80%)
    // and a quick backtrack hook (last 20-30%)
    const splitIdx = Math.floor(n * 0.75);
    const shaftPoints = points.slice(0, splitIdx);
    const tipPoints = points.slice(splitIdx);

    const shaftCheck = this.checkStraightLine(shaftPoints);
    if (!shaftCheck.isMatch) return { isMatch: false };

    // Tip points should sharply deviate from the shaft direction
    const shaftVec = {
      x: shaftPoints[shaftPoints.length - 1].x - shaftPoints[0].x,
      y: shaftPoints[shaftPoints.length - 1].y - shaftPoints[0].y
    };
    const shaftLen = Math.hypot(shaftVec.x, shaftVec.y);
    if (shaftLen < 20) return { isMatch: false };

    const tipVec = {
      x: tipPoints[tipPoints.length - 1].x - tipPoints[0].x,
      y: tipPoints[tipPoints.length - 1].y - tipPoints[0].y
    };
    const tipLen = Math.hypot(tipVec.x, tipVec.y);
    if (tipLen < 5) return { isMatch: false };

    // Dot product between normalized vectors
    const dot = (shaftVec.x * tipVec.x + shaftVec.y * tipVec.y) / (shaftLen * tipLen);
    // Backtrack angle corresponds to negative or sharp angle
    if (dot < 0.2) {
      return {
        isMatch: true,
        geometry: {
          start: shaftCheck.geometry.start,
          end: shaftCheck.geometry.end
        }
      };
    }
    return { isMatch: false };
  }
}
