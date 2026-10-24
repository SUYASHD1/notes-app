// Markdown and LaTeX Parser Engine & Text Block Controller (< 350 lines)
// Orchestrates tokenization, math expressions, KaTeX rendering, paste sanitization, and markdown conversion.

import { LatexParser } from './latex_parser.js';
import { HtmlSanitizer } from './html_sanitizer.js';
import { HtmlToMarkdownConverter } from './html_to_markdown.js';

export { LatexParser } from './latex_parser.js';
export { HtmlSanitizer } from './html_sanitizer.js';
export { HtmlToMarkdownConverter } from './html_to_markdown.js';

/**
 * Unified facade providing 100% backwards-compatible API for all text, math,
 * and HTML manipulation in the Notes App.
 */
export class MarkdownLatexParser {
  /**
   * Tokenizes and parses text containing Markdown headings, checklists,
   * inlines, and LaTeX formulas.
   */
  static parse(text) {
    return LatexParser.parse(text);
  }

  /**
   * Parses inline Markdown (bold, italic, strikethrough, inline math $...$).
   */
  static parseInlines(line) {
    return LatexParser.parseInlines(line);
  }

  /**
   * Safely parses LaTeX expressions without crashing on syntax errors.
   */
  static safeParseLatex(formula) {
    return LatexParser.safeParseLatex(formula);
  }

  /**
   * Renders a LaTeX formula using KaTeX if available in window,
   * or a typographical stacked math layout fallback.
   */
  static renderLatex(formula, isBlock = false) {
    return LatexParser.renderLatex(formula, isBlock);
  }

  /**
   * Standalone typographical formatter for LaTeX equations (stacked fractions, limits, Greek letters).
   */
  static formatLatexFallback(formula, isBlock = false) {
    return LatexParser.formatLatexFallback(formula, isBlock);
  }

  /**
   * Parses markdown image alt text with optional wrapping and sizing parameters.
   */
  static parseImageProps(rawAlt = '', rawSrc = '') {
    return LatexParser.parseImageProps(rawAlt, rawSrc);
  }

  /**
   * Renders content into clean HTML string.
   */
  static renderToHtml(text) {
    return LatexParser.renderToHtml(text);
  }

  /**
   * Escapes HTML entities (&, <, >).
   */
  static escapeHtml(str) {
    return LatexParser.escapeHtml(str);
  }

  /**
   * Sanitizes rich HTML from external sources (MS Word, Google Docs, web pages)
   * into clean, standardized semantic HTML without loss of headings, bold, links, or images.
   */
  static sanitizeRichHtml(html) {
    return HtmlSanitizer.sanitizeRichHtml(html);
  }

  /**
   * Converts pasted rich HTML (headings, bold, lists, images) into standard Markdown
   */
  static htmlToMarkdown(html) {
    return HtmlToMarkdownConverter.convert(html);
  }

  /**
   * Recursively traverses DOM node tree and converts into Markdown syntax.
   */
  static nodeToMarkdown(node) {
    return HtmlToMarkdownConverter.nodeToMarkdown(node);
  }
}
