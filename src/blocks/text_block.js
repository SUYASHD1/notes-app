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

      // Check Markdown Images ![alt](url) or ![alt|wrap|width](url)
      const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        const props = this.parseImageProps(imgMatch[1], imgMatch[2]);
        tokens.push({
          type: 'image',
          alt: imgMatch[1],
          props,
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
   * Parses markdown image alt text with optional wrapping and sizing parameters.
   * Formats supported:
   * ![Alt](url) -> wrap: center
   * ![Alt|left](url) or ![Alt|wrap=left](url) -> wrap: left
   * ![Alt|right](url) or ![Alt|wrap=right](url) -> wrap: right
   * ![Alt|wrap=left|width=280px](url) -> wrap: left, width: 280px
   */
  static parseImageProps(rawAlt = '', rawSrc = '') {
    let alt = rawAlt || 'Pasted Image';
    let wrap = 'center';
    let width = '';

    if (rawAlt && rawAlt.includes('|')) {
      const parts = rawAlt.split('|');
      alt = parts[0].trim();
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim().toLowerCase();
        if (part === 'left' || part === 'wrap-left' || part === 'wrap=left') {
          wrap = 'left';
        } else if (part === 'right' || part === 'wrap-right' || part === 'wrap=right') {
          wrap = 'right';
        } else if (part === 'center' || part === 'wrap-center' || part === 'wrap=center') {
          wrap = 'center';
        } else if (part.startsWith('w=') || part.startsWith('width=')) {
          width = part.split('=')[1].trim();
          if (/^\d+$/.test(width)) width += 'px';
        } else if (/^\d+(px|%)?$/.test(part)) {
          width = part.endsWith('%') || part.endsWith('px') ? part : part + 'px';
        }
      }
    }

    return { alt, wrap, width, rawAlt, src: rawSrc };
  }

  /**
   * Renders content into clean HTML string.
   * If already rich HTML, it returns it directly without lossy markdown translation.
   */
  static renderToHtml(text) {
    if (!text || typeof text !== 'string') return '';

    // If the content is already HTML, return it directly
    if (text.includes('<p') || text.includes('<h1') || text.includes('<h2') || text.includes('<h3') || text.includes('<div') || text.includes('<ul') || text.includes('<ol') || text.includes('<strong') || text.includes('<b>') || text.includes('<i>') || text.includes('<span') || text.includes('<img')) {
      return text;
    }

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
        case 'image': {
          const props = token.props || this.parseImageProps(token.alt, token.src);
          const styleAttr = props.width ? ` style="width: ${props.width}; max-width: 100%;"` : '';
          htmlLines.push(`<div class="note-image-container wrap-${props.wrap}" data-raw-alt="${this.escapeHtml(token.alt || '')}" data-alt="${this.escapeHtml(props.alt)}" data-wrap="${props.wrap}" data-width="${props.width}" data-src="${token.src}"${styleAttr}><img class="note-embedded-image" src="${token.src}" alt="${this.escapeHtml(props.alt)}" loading="lazy" /></div>`);
          break;
        }
        case 'list_item': {
          const formatted = this.escapeHtml(token.content)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="note-link">$1</a>');
          htmlLines.push(`<li class="note-bullet-item">${formatted}</li>`);
          break;
        }
        case 'numbered_item': {
          const formatted = this.escapeHtml(token.content)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="note-link">$1</a>');
          htmlLines.push(`<li class="note-numbered-item" value="${token.number}">${formatted}</li>`);
          break;
        }
        case 'checklist':
          htmlLines.push(`<label class="checklist-item"><input type="checkbox" ${token.checked ? 'checked' : ''} disabled /> ${this.escapeHtml(token.content)}</label>`);
          break;
        case 'paragraph': {
          let renderedInlines = token.inlines.map(inLine => {
            if (inLine.type === 'math_inline') {
              if (inLine.parsed && inLine.parsed.isValid) {
                return this.renderLatex(inLine.formula, false);
              } else {
                return `<span class="latex-error">[Invalid LaTeX: ${inLine.formula}]</span>`;
              }
            }
            let text = this.escapeHtml(inLine.content)
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/~~(.*?)~~/g, '<del>$1</del>')
              .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, rawAlt, src) => {
                const props = this.parseImageProps(rawAlt, src);
                const styleAttr = props.width ? ` style="width: ${props.width}; max-width: 100%;"` : '';
                return `<div class="note-image-container wrap-${props.wrap}" data-raw-alt="${this.escapeHtml(rawAlt)}" data-alt="${this.escapeHtml(props.alt)}" data-wrap="${props.wrap}" data-width="${props.width}" data-src="${src}"${styleAttr}><img class="note-embedded-image" src="${src}" alt="${this.escapeHtml(props.alt)}" loading="lazy" /></div>`;
              });

            // Strip stray brackets from images wrapped in links: [ <div class="note-image-container"...</div> ](url)
            text = text.replace(/\[\s*(<div class="note-image-container[\s\S]*?<\/div>)\s*\]\([^)]*\)/g, '$1');

            // Render clickable hyperlinks
            text = text.replace(/(^|[^!])\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '$1<a href="$3" target="_blank" rel="noopener noreferrer" class="note-link">$2</a>');

            return text;
          }).join('');

          renderedInlines = renderedInlines.replace(/\[\s*(<div class="note-image-container[\s\S]*?<\/div>)\s*\]\([^)]*\)/g, '$1');
          htmlLines.push(`<p>${renderedInlines}</p>`);
          break;
        }
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
   * Sanitizes rich HTML from external sources (MS Word, Google Docs, web pages)
   * into clean, standardized semantic HTML without loss of headings, bold, links, or images.
   */
  static sanitizeRichHtml(html) {
    if (!html || typeof html !== 'string') return '';

    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 1. Strip dangerous tags and Word xml metadata
        doc.querySelectorAll('script, style, link, meta, iframe, object, embed, xml, o\\:p').forEach(el => el.remove());

        // 2. Strip Wikipedia chrome, sidebars, navboxes, and citation footnotes
        doc.querySelectorAll('table.sidebar, .sidebar, .navbox, .infobox, .mw-editsection, .mw-jump-link, .navbar, .magnify, .noprint, [role="navigation"]').forEach(el => el.remove());
        doc.querySelectorAll('sup.reference, .mw-ref').forEach(el => el.remove());

        // 3. Remove citations, empty links, and [v][t][e] links
        doc.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          const text = (a.textContent || '').trim();
          if (href.startsWith('#cite') || href.startsWith('#ref') || /^\[\d+\]$/.test(text)) {
            a.remove();
            return;
          }
          if (!text && !a.querySelector('img')) {
            a.remove();
            return;
          }
          if (['v', 't', 'e'].includes(text.toLowerCase()) && (href.includes('Template') || href.includes('Special:EditPage'))) {
            a.remove();
            return;
          }
          // If anchor only wraps an image, unwrap the anchor
          const img = a.querySelector('img');
          if (img && a.childNodes.length === 1) {
            a.replaceWith(img);
            return;
          }
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          a.classList.add('note-link');
        });

        // 4. Microsoft Word Normalization:
        // A. Unwrap Word's fake bold (b/strong with mso-bidi-font-weight: normal or font-weight: normal)
        doc.querySelectorAll('b, strong').forEach(b => {
          const style = (b.getAttribute('style') || '').toLowerCase();
          if (style.includes('mso-bidi-font-weight:normal') || style.includes('mso-bidi-font-weight: normal') || style.includes('font-weight:normal') || style.includes('font-weight: normal') || style.includes('font-weight:400') || style.includes('font-weight: 400')) {
            const parent = b.parentNode;
            if (parent) {
              while (b.firstChild) {
                parent.insertBefore(b.firstChild, b);
              }
              parent.removeChild(b);
            }
          }
        });

        // B. Word Headings: Convert MsoTitle, MsoHeading1, MsoHeading2, MsoHeading3, or large bold paragraphs
        doc.querySelectorAll('p, div').forEach(p => {
          const cls = (p.getAttribute('class') || '').toLowerCase();
          const style = (p.getAttribute('style') || '').toLowerCase();
          const text = (p.textContent || '').trim();
          if (!text) return;

          let headingLevel = 0;
          if (cls.includes('msotitle') || cls.includes('msoheading1') || style.includes('mso-outline-level:1') || style.includes('mso-outline-level: 1')) {
            headingLevel = 1;
          } else if (cls.includes('msoheading2') || style.includes('mso-outline-level:2') || style.includes('mso-outline-level: 2')) {
            headingLevel = 2;
          } else if (cls.includes('msoheading3') || style.includes('mso-outline-level:3') || style.includes('mso-outline-level: 3')) {
            headingLevel = 3;
          } else if ((style.includes('font-weight:bold') || style.includes('font-weight: bold') || style.includes('font-weight:700') || style.includes('font-weight: 700')) && (style.includes('font-size:18') || style.includes('font-size: 18') || style.includes('font-size:16') || style.includes('font-size: 16') || style.includes('font-size:20') || style.includes('font-size: 20') || style.includes('font-size:24') || style.includes('font-size: 24'))) {
            headingLevel = 2;
          }

          if (headingLevel > 0) {
            const h = document.createElement(`h${headingLevel}`);
            h.innerHTML = p.innerHTML;
            p.replaceWith(h);
          }
        });

        // 5. Clean external styles from headings & paragraphs so note typography is preserved
        doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span').forEach(el => {
          if (el.style) {
            el.style.fontSize = '';
            el.style.fontFamily = '';
            el.style.lineHeight = '';
            el.style.backgroundColor = '';
            el.style.color = '';
            if (el.getAttribute('style') && !el.getAttribute('style').trim()) {
              el.removeAttribute('style');
            }
          }
        });

        // 6. Image normalization: Wrap content images into note-image-container
        doc.querySelectorAll('img').forEach(img => {
          const w = parseInt(img.getAttribute('width') || img.style?.width || '0', 10);
          const h = parseInt(img.getAttribute('height') || img.style?.height || '0', 10);
          if ((w > 0 && w <= 32) || (h > 0 && h <= 32)) {
            img.remove();
            return;
          }

          if (!img.closest('.note-image-container')) {
            const container = document.createElement('div');
            container.className = 'note-image-container wrap-center';
            container.setAttribute('data-wrap', 'center');
            const alt = img.getAttribute('alt') || 'Pasted Image';
            const src = img.getAttribute('src') || '';
            container.setAttribute('data-alt', alt);
            container.setAttribute('data-src', src);

            img.classList.add('note-embedded-image');
            img.setAttribute('loading', 'lazy');

            img.replaceWith(container);
            container.appendChild(img);
          }
        });

        const clean = doc.body.innerHTML.trim();
        if (clean) return clean;
      } catch (err) {
        console.warn('sanitizeRichHtml fallback:', err);
      }
    }

    // RegEx based fallback for non-DOM / Node.js test environments
    let res = html
      .replace(/<(script|style|link|meta|iframe|object|embed|xml|o:p)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<table[^>]*class=["'][^"']*(sidebar|infobox|navbox)[^"']*["'][^>]*>[\s\S]*?<\/table>/gi, '')
      .replace(/<sup[^>]*class=["'][^"']*reference[^"']*["'][^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<(b|strong)[^>]*style=["'][^"']*(?:mso-bidi-font-weight:\s*normal|font-weight:\s*(?:normal|400))[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi, '$2')
      .replace(/<p[^>]*class=["'][^"']*(msotitle|msoheading1)[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi, '<h1>$2</h1>')
      .replace(/<p[^>]*class=["'][^"']*(msoheading2)[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi, '<h2>$2</h2>')
      .replace(/<p[^>]*class=["'][^"']*(msoheading3)[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi, '<h3>$2</h3>')
      .replace(/<a([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, text) => {
        if (match.includes('class="note-link"')) return match;
        return `<a${attrs} target="_blank" rel="noopener noreferrer" class="note-link">${text}</a>`;
      })
      .replace(/<img([^>]+)>/gi, (match, attrs) => {
        if (match.includes('note-embedded-image')) return match;
        const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
        const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
        const src = srcMatch ? srcMatch[1] : '';
        const alt = altMatch ? altMatch[1] : 'Pasted Image';
        return `<div class="note-image-container wrap-center" data-wrap="center" data-alt="${alt}" data-src="${src}"><img class="note-embedded-image" src="${src}" alt="${alt}" loading="lazy" /></div>`;
      });
    return res.trim();
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

        // Strip non-content navigation sidebars, infoboxes, and template chrome
        doc.querySelectorAll('table.sidebar, .sidebar, .navbox, .infobox, .mw-editsection, .mw-jump-link, .navbar, .magnify, .noprint, [role="navigation"], script, style').forEach(el => el.remove());

        // Unwrap Word's fake bold (mso-bidi-font-weight: normal)
        doc.querySelectorAll('b, strong').forEach(b => {
          const style = (b.getAttribute('style') || '').toLowerCase();
          if (style.includes('mso-bidi-font-weight:normal') || style.includes('mso-bidi-font-weight: normal') || style.includes('font-weight:normal') || style.includes('font-weight: normal')) {
            const parent = b.parentNode;
            if (parent) {
              while (b.firstChild) {
                parent.insertBefore(b.firstChild, b);
              }
              parent.removeChild(b);
            }
          }
        });

        // Word Headings
        doc.querySelectorAll('p, div').forEach(p => {
          const cls = (p.getAttribute('class') || '').toLowerCase();
          const style = (p.getAttribute('style') || '').toLowerCase();
          let headingLevel = 0;
          if (cls.includes('msotitle') || cls.includes('msoheading1') || style.includes('mso-outline-level:1')) {
            headingLevel = 1;
          } else if (cls.includes('msoheading2') || style.includes('mso-outline-level:2')) {
            headingLevel = 2;
          }
          if (headingLevel > 0) {
            const h = document.createElement(`h${headingLevel}`);
            h.innerHTML = p.innerHTML;
            p.replaceWith(h);
          }
        });

        const converted = this.nodeToMarkdown(doc.body).trim();
        if (converted) return converted;
      } catch (_) {}
    }

    // RegEx based fallback for non-DOM environments
    return html
      .replace(/<table[^>]*class=["'][^"']*(sidebar|infobox|navbox)[^"']*["'][^>]*>[\s\S]*?<\/table>/gi, '')
      .replace(/<div[^>]*class=["'][^"']*(sidebar|infobox|navbox|mw-editsection|navbar|magnify|noprint)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<sup[^>]*class=["'][^"']*reference[^"']*["'][^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<a[^>]*href=["']#cite[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/<a[^>]*>\s*(<img[^>]*>)\s*<\/a>/gi, '$1')
      .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
        const trimmed = text.trim();
        if (!trimmed) return '';
        if (href.startsWith('#cite') || href.startsWith('#ref') || /^\[\d+\]$/.test(trimmed)) {
          return '';
        }
        if (['v', 't', 'e'].includes(trimmed.toLowerCase()) && (href.includes('Template') || href.includes('Special:EditPage'))) {
          return '';
        }
        return `[${trimmed}](${href})`;
      })
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

    // Check if node is an embedded image container
    if (tag === 'div' && node.classList && node.classList.contains('note-image-container')) {
      const img = node.querySelector('img');
      if (img) return this.nodeToMarkdown(img);
    }

    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (!src) return '';

      // Skip tiny UI icons, badges, and decorative pixels (<= 32px)
      const width = parseInt(node.getAttribute('width') || node.style?.width || '0', 10);
      const height = parseInt(node.getAttribute('height') || node.style?.height || '0', 10);
      if ((width > 0 && width <= 32) || (height > 0 && height <= 32)) {
        return '';
      }

      const rawAlt = node.getAttribute('data-raw-alt') || node.getAttribute('alt') || 'Pasted Image';
      const container = node.closest ? node.closest('.note-image-container') : null;
      let wrap = '';
      let widthProp = '';
      if (container) {
        wrap = container.getAttribute('data-wrap') || '';
        widthProp = container.getAttribute('data-width') || container.style.width || '';
      }
      let finalAlt = rawAlt;
      if (wrap || widthProp) {
        const baseAlt = rawAlt.split('|')[0].trim() || 'Pasted Image';
        const parts = [baseAlt];
        if (wrap && wrap !== 'center') parts.push(`wrap=${wrap}`);
        if (widthProp) parts.push(`width=${widthProp}`);
        finalAlt = parts.join('|');
      }
      return `\n![${finalAlt}](${src})\n`;
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
      case 'blockquote': return `\n> ${childrenText.trim()}\n`;
      case 'code': return `\`${childrenText}\``;
      case 'pre': return `\n\`\`\`\n${childrenText}\n\`\`\`\n`;
      case 'li': return `\n- ${childrenText.trim()}`;
      case 'p': return `\n${childrenText}\n`;
      case 'br': return '\n';
      case 'div': return `\n${childrenText}\n`;
      case 'sup':
        // Strip Wikipedia citation footnote markers like [287], [288], [citation needed]
        if (node.classList && (node.classList.contains('reference') || node.classList.contains('mw-ref'))) {
          return '';
        }
        return `<sup>${childrenText}</sup>`;
      case 'a': {
        const href = node.getAttribute('href') || '';
        const trimmed = childrenText.trim();
        // Skip empty links without label
        if (!trimmed) return '';

        // If anchor wraps an image, return just the image without link brackets
        if (node.querySelector && node.querySelector('img')) {
          return trimmed + '\n';
        }
        // If anchor is an internal footnote reference (#cite, #ref, mw-ref, or [287])
        if (href.startsWith('#cite') || href.startsWith('#ref') || (node.classList && node.classList.contains('mw-ref')) || /^\[\d+\]$/.test(trimmed)) {
          return '';
        }
        // Skip template action links [v], [t], [e]
        if (['v', 't', 'e'].includes(trimmed.toLowerCase()) && (href.includes('Template') || href.includes('Special:EditPage'))) {
          return '';
        }
        return href ? `[${trimmed}](${href})` : trimmed;
      }
      default:
        return childrenText;
    }
  }
}
