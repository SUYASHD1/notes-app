// Sandboxed execution boundary to prevent malformed equations,
// syntax errors, or untrusted expressions from crashing the canvas.

export class SandboxError extends Error {
  constructor(message, originalError = null, blockId = null) {
    super(message);
    this.name = 'SandboxError';
    this.originalError = originalError;
    this.blockId = blockId;
    this.timestamp = Date.now();
  }
}

export class Sandbox {
  /**
   * Safely execute an arbitrary function within an isolated error boundary.
   * If it throws, returns the fallback value instead of propagating uncaught errors.
   */
  static runSafe(fn, fallback = null, blockId = null) {
    try {
      const result = fn();
      return { success: true, value: result, error: null };
    } catch (err) {
      return {
        success: false,
        value: fallback,
        error: new SandboxError(err.message || 'Execution failed in sandbox', err, blockId)
      };
    }
  }

  /**
   * Evaluates a mathematical function y = f(x) with strict sanitization,
   * symbol whitelist, and safety bounds (NaN/Infinity suppression).
   */
  static safeMathEval(expr, x) {
    if (!expr || typeof expr !== 'string') return null;

    // Reject dangerous keywords
    if (/[\{\}\[\];=><\$\'\"`\\]|process|require|import|window|document|global|eval|Function|this|constructor/i.test(expr)) {
      return null;
    }

    const sanitized = expr
      .replace(/\^/g, '**')
      .replace(/\bsin\b/gi, 'Math.sin')
      .replace(/\bcos\b/gi, 'Math.cos')
      .replace(/\btan\b/gi, 'Math.tan')
      .replace(/\basinh\b/gi, 'Math.asinh')
      .replace(/\bacosh\b/gi, 'Math.acosh')
      .replace(/\batanh\b/gi, 'Math.atanh')
      .replace(/\bsinh\b/gi, 'Math.sinh')
      .replace(/\bcosh\b/gi, 'Math.cosh')
      .replace(/\btanh\b/gi, 'Math.tanh')
      .replace(/\basin\b/gi, 'Math.asin')
      .replace(/\bacos\b/gi, 'Math.acos')
      .replace(/\batan\b/gi, 'Math.atan')
      .replace(/\bexp\b/gi, 'Math.exp')
      .replace(/\bln\b/gi, 'Math.log')
      .replace(/\blog\b/gi, 'Math.log10')
      .replace(/\bsqrt\b/gi, 'Math.sqrt')
      .replace(/\bcbrt\b/gi, 'Math.cbrt')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\babs\b/gi, 'Math.abs');

    try {
      const fn = new Function('x', 'Math', `"use strict"; return (${sanitized});`);
      const val = fn(x, Math);
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return null;
      }
      return val;
    } catch {
      return null;
    }
  }

  /**
   * Safely parses JSON with fallback, avoiding syntax errors.
   */
  static parseJSON(raw, fallback = null) {
    if (typeof raw !== 'string') return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
}
