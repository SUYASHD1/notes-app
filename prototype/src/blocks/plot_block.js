// Sandboxed Math Function Plotter Engine

import { Sandbox } from '../core/sandbox.js';

export class FunctionPlotter {
  /**
   * Safely evaluates mathematical expression at coordinate x.
   */
  static evaluateExpression(expr, x) {
    return Sandbox.safeMathEval(expr, x);
  }

  /**
   * Generates sample points for plotting the curve y = f(x).
   */
  static generatePlotPoints(expr, xMin = -10, xMax = 10, steps = 200) {
    const points = [];
    const stepSize = (xMax - xMin) / steps;

    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * stepSize;
      const y = this.evaluateExpression(expr, x);
      points.push({ x, y });
    }

    return points;
  }

  /**
   * Projects mathematical coordinates (x, y) into block pixel space (pixelWidth, pixelHeight).
   */
  static projectToPixel(mathX, mathY, bounds, pixelWidth, pixelHeight, padding = 20) {
    const usableW = pixelWidth - padding * 2;
    const usableH = pixelHeight - padding * 2;

    const normX = (mathX - bounds.xMin) / (bounds.xMax - bounds.xMin);
    const normY = (mathY - bounds.yMin) / (bounds.yMax - bounds.yMin);

    return {
      px: padding + normX * usableW,
      py: pixelHeight - (padding + normY * usableH) // Invert Y for screen coords
    };
  }
}
