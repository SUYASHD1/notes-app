// HTML to Markdown Converter Engine (< 350 lines)

export class HtmlToMarkdownConverter {
  /**
   * Converts pasted rich HTML (headings, bold, lists, images) into standard Markdown
   */
  static convert(html) {
    if (!html || typeof html !== 'string') return '';

    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        doc.querySelectorAll('table.sidebar, .sidebar, .navbox, .infobox, .mw-editsection, .mw-jump-link, .navbar, .magnify, .noprint, [role="navigation"], script, style').forEach(el => el.remove());

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

    if (tag === 'div' && node.classList && node.classList.contains('note-image-container')) {
      const img = node.querySelector('img');
      if (img) return this.nodeToMarkdown(img);
    }

    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (!src) return '';

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
        if (node.classList && (node.classList.contains('reference') || node.classList.contains('mw-ref'))) {
          return '';
        }
        return `<sup>${childrenText}</sup>`;
      case 'a': {
        const href = node.getAttribute('href') || '';
        const trimmed = childrenText.trim();
        if (!trimmed) return '';
        if (node.querySelector && node.querySelector('img')) {
          return trimmed + '\n';
        }
        if (href.startsWith('#cite') || href.startsWith('#ref') || (node.classList && node.classList.contains('mw-ref')) || /^\[\d+\]$/.test(trimmed)) {
          return '';
        }
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
