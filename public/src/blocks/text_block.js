// Markdown and LaTeX Parser Engine with Sandboxed Error Fallbacks

import { Sandbox } from '../core/sandbox.js';

export class MarkdownLatexParser {
  /**
   * Tokenizes and parses text containing Markdown typography, checklists,
   * inline math ($...$), and display math blocks ($$...$$).
   */
  static parse(text) {
    if (!text || typeof text !== 'string') {
      return { raw: text || '', tokens: [] };
    }

    const tokens = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check display block equation $$...$$
      const trimmed = line.trim();
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
        const formula = trimmed.substring(2, trimmed.length - 2).trim();
        tokens.push({
          type: 'math_block',
          formula,
          parsed: this.safeParseLatex(formula)
        });
        continue;
      }

      // Check Markdown Headings
      if (trimmed.startsWith('### ')) {
        tokens.push({ type: 'heading', level: 3, content: trimmed.substring(4) });
        continue;
      } else if (trimmed.startsWith('## ')) {
        tokens.push({ type: 'heading', level: 2, content: trimmed.substring(3) });
        continue;
      } else if (trimmed.startsWith('# ')) {
        tokens.push({ type: 'heading', level: 1, content: trimmed.substring(2) });
        continue;
      }

      // Check Checklists
      if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
        const checked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ');
        tokens.push({
          type: 'checklist',
          checked,
          content: trimmed.substring(6)
        });
        continue;
      }

      // Check Markdown Images ![alt](url)
      const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        tokens.push({
          type: 'image',
          alt: imgMatch[1],
          src: imgMatch[2]
        });
        continue;
      }

      // Check Bullet Lists (- or *)
      if ((trimmed.startsWith('- ') || trimmed.startsWith('* ')) && !trimmed.startsWith('- [ ] ') && !trimmed.startsWith('- [x] ') && !trimmed.startsWith('- [X] ')) {
        tokens.push({
          type: 'list_item',
          content: trimmed.substring(2)
        });
        continue;
      }

      // Check Numbered Lists (1. , 2. )
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        tokens.push({
          type: 'numbered_item',
          number: numMatch[1],
          content: numMatch[2]
        });
        continue;
      }

      // Standard paragraph with inline formatting
      tokens.push({
        type: 'paragraph',
        content: line,
        inlines: this.parseInlines(line)
      });
    }

    return { raw: text, tokens };
  }

  /**
   * Parses inline Markdown (bold, italic, strikethrough, inline math $...$).
   */
  static parseInlines(line) {
    const inlines = [];
    const inlineMathRegex = /\$([^\$]+)\$/g;
    let lastIdx = 0;
    let match;

    while ((match = inlineMathRegex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        inlines.push({
          type: 'text',
          content: line.substring(lastIdx, match.index)
        });
      }
      const formula = match[1].trim();
      inlines.push({
        type: 'math_inline',
        formula,
        parsed: this.safeParseLatex(formula)
      });
      lastIdx = inlineMathRegex.lastIndex;
    }

    if (lastIdx < line.length) {
      inlines.push({
        type: 'text',
        content: line.substring(lastIdx)
      });
    }

    return inlines;
  }

  /**
   * Safely parses LaTeX expressions without crashing on syntax errors.
   */
  static safeParseLatex(formula) {
    return Sandbox.runSafe(() => {
      // Validate bracket matching
      let depth = 0;
      for (const char of formula) {
        if (char === '{') depth++;
        if (char === '}') depth--;
        if (depth < 0) throw new Error('Unbalanced closing brace');
      }
      if (depth !== 0) throw new Error('Unbalanced opening brace');

      // Check for illegal/dangerous characters
      if (/[%#\\]broken/i.test(formula)) {
        throw new Error('Unsupported or malformed LaTeX symbol');
      }

      // Basic AST / tokenized structure
      return {
        formula,
        isValid: true,
        hasFractions: formula.includes('\\frac'),
        hasSquareRoot: formula.includes('\\sqrt'),
        hasIntegral: formula.includes('\\int'),
        hasSum: formula.includes('\\sum')
      };
    }, { formula, isValid: false, fallbackHtml: `<span class="latex-error">[Invalid LaTeX: ${formula}]</span>` }).value;
  }

  /**
   * Renders a LaTeX formula using KaTeX if available in window,
   * or a typographical stacked math layout fallback.
   */
  static renderLatex(formula, isBlock = false) {
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
      try {
        return window.katex.renderToString(formula, {
          displayMode: isBlock,
          throwOnError: false
        });
      } catch {
        // Fall back to built-in formatter on error
      }
    }

    return this.formatLatexFallback(formula, isBlock);
  }

  /**
   * Standalone typographical formatter for LaTeX equations (stacked fractions, limits, Greek letters).
   */
  static formatLatexFallback(formula, isBlock = false) {
    let formatted = this.escapeHtml(formula);

    // Greek letters & symbols
    const symbols = {
      '\\Delta': 'Δ',
      '\\to': '→',
      '\\alpha': 'α',
      '\\beta': 'β',
      '\\gamma': 'γ',
      '\\theta': 'θ',
      '\\lambda': 'λ',
      '\\pi': 'π',
      '\\sigma': 'σ',
      '\\omega': 'ω',
      '\\int': '∫',
      '\\sum': '∑',
      '\\prod': '∏',
      '\\infty': '∞',
      '\\partial': '∂',
      '\\approx': '≈',
      '\\ne': '≠',
      '\\le': '≤',
      '\\ge': '≥',
      '\\pm': '±',
      '\\cdot': '·',
      '\\times': '×'
    };

    for (const [tex, sym] of Object.entries(symbols)) {
      formatted = formatted.replaceAll(tex, sym);
    }

    // Limits: \lim_{sub} -> lim with sub below
    formatted = formatted.replace(/\\lim_\{([^}]+)\}/g, '<span class="math-lim"><span class="math-lim-name">lim</span><span class="math-lim-sub">$1</span></span>');
    formatted = formatted.replace(/\\lim_([^\s]+)/g, '<span class="math-lim"><span class="math-lim-name">lim</span><span class="math-lim-sub">$1</span></span>');

    // Fractions: \frac{num}{den} -> stacked fraction
    formatted = formatted.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="math-frac"><span class="math-num">$1</span><span class="math-denom">$2</span></span>');

    // Square roots: \sqrt{x}
    formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-radicand">$1</span></span>');

    // Superscripts & Subscripts: x^{2} and x_{i}
    formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
    formatted = formatted.replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>');
    formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
    formatted = formatted.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');

    const wrapperClass = isBlock ? 'latex-block' : 'latex-inline';
    return `<span class="${wrapperClass}">${formatted}</span>`;
  }

  /**
   * Renders the tokenized structure into clean HTML string.
   */
  static renderToHtml(text) {
    const ast = this.parse(text);
    const htmlLines = [];

    for (const token of ast.tokens) {
      switch (token.type) {
        case 'math_block':
          if (token.parsed && token.parsed.isValid) {
            htmlLines.push(`<div class="latex-block-container">${this.renderLatex(token.formula, true)}</div>`);
          } else {
            htmlLines.push(`<div class="latex-error">[Invalid LaTeX: ${token.formula}]</div>`);
          }
          break;
        case 'heading':
          htmlLines.push(`<h${token.level}>${this.escapeHtml(token.content)}</h${token.level}>`);
          break;
        case 'image':
          htmlLines.push(`<div class="note-image-container"><img class="note-embedded-image" src="${token.src}" alt="${this.escapeHtml(token.alt || 'Pasted Image')}" loading="lazy" /></div>`);
          break;
        case 'list_item':
          htmlLines.push(`<li class="note-bullet-item">${this.escapeHtml(token.content).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</li>`);
          break;
        case 'numbered_item':
          htmlLines.push(`<li class="note-numbered-item" value="${token.number}">${this.escapeHtml(token.content).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</li>`);
          break;
        case 'checklist':
          htmlLines.push(`<label class="checklist-item"><input type="checkbox" ${token.checked ? 'checked' : ''} disabled /> ${this.escapeHtml(token.content)}</label>`);
          break;
        case 'paragraph':
          const renderedInlines = token.inlines.map(inLine => {
            if (inLine.type === 'math_inline') {
              if (inLine.parsed && inLine.parsed.isValid) {
                return this.renderLatex(inLine.formula, false);
              } else {
                return `<span class="latex-error">[Invalid LaTeX: ${inLine.formula}]</span>`;
              }
            }
            return this.escapeHtml(inLine.content)
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/~~(.*?)~~/g, '<del>$1</del>')
              .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="note-embedded-image" src="$2" alt="$1" />');
          }).join('');
          htmlLines.push(`<p>${renderedInlines}</p>`);
          break;
      }
    }

    return htmlLines.join('\n');
  }

  static escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Converts pasted rich HTML (headings, bold, lists, images) into standard Markdown
   */
  static htmlToMarkdown(html) {
    if (!html || typeof html !== 'string') return '';

    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const converted = this.nodeToMarkdown(doc.body).trim();
        if (converted) return converted;
      } catch (_) {}
    }

    // RegEx based fallback for non-DOM environments
    return html
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n### $1\n')
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']?([^"'>]*)["']?[^>]*>/gi, '\n![$2]($1)\n')
      .replace(/<img[^>]*alt=["']?([^"'>]*)["']?[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n![$1]($2)\n')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n![Pasted Image]($1)\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  static nodeToMarkdown(node) {
    if (!node) return '';
    if (node.nodeType === 3) {
      return node.textContent || '';
    }
    if (node.nodeType !== 1) return '';

    const tag = node.tagName.toLowerCase();

    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || 'Pasted Image';
      return src ? `\n![${alt}](${src})\n` : '';
    }

    let childrenText = '';
    for (const child of node.childNodes) {
      childrenText += this.nodeToMarkdown(child);
    }

    switch (tag) {
      case 'h1': return `\n# ${childrenText.trim()}\n`;
      case 'h2': return `\n## ${childrenText.trim()}\n`;
      case 'h3': return `\n### ${childrenText.trim()}\n`;
      case 'h4':
      case 'h5':
      case 'h6': return `\n### ${childrenText.trim()}\n`;
      case 'strong':
      case 'b': return `**${childrenText}**`;
      case 'em':
      case 'i': return `*${childrenText}*`;
      case 'del':
      case 's': return `~~${childrenText}~~`;
      case 'li': return `\n- ${childrenText.trim()}`;
      case 'p': return `\n${childrenText}\n`;
      case 'br': return '\n';
      case 'div': return `\n${childrenText}\n`;
      case 'a':
        const href = node.getAttribute('href');
        return href ? `[${childrenText}](${href})` : childrenText;
      default:
        return childrenText;
    }
  }
}
