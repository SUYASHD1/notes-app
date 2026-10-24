// HTML Sanitizer for MS Word, Wikipedia, Google Docs paste cleaning (< 350 lines)

export class HtmlSanitizer {
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
    const res = html
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
}
