// Multi-Page PDF Printout Rendering Engine with Natural Sizing & High-DPI Vector Crispness

// PDF Document Cache: In-memory parsed documents so binaries are parsed once without memory leaks
const pdfDocCache = new Map();

export function renderPDFItem(parentEl, item, deps = {}) {
  const getAssetIDB = deps.getAssetIDB || (async (key) => (window.state?.vault ? window.state.vault.getAsset(key) : null));

  // Purge any legacy bloated base64 pages from localStorage to prevent QuotaExceededError
  if (item.pages) {
    delete item.pages;
  }

  const pdfCard = document.createElement('div');
  pdfCard.className = 'pdf-printout-card';

  const header = document.createElement('div');
  header.className = 'pdf-printout-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="font-weight:600; color:#1e293b;">📄 ${item.title || 'PDF Document'}</span>
      <span class="badge" style="font-size:10px;">${item.totalPages ? `${item.totalPages} Page${item.totalPages > 1 ? 's' : ''}` : 'Loading...'}</span>
    </div>
    <div style="display:flex; align-items:center; gap:6px;">
      ${item.dataUrl ? `<a href="${item.dataUrl}" download="${item.title || 'Document.pdf'}" class="mini-tool-btn" style="text-decoration:none; color:#2563eb;" title="Download or open original PDF file">💾 Original PDF</a>` : ''}
    </div>
  `;
  pdfCard.appendChild(header);

  const pagesContainer = document.createElement('div');
  pagesContainer.className = 'pdf-pages-container';

  if (!item.dataUrl) {
    // Check if large PDF dataUrl is cached in IndexedDB
    getAssetIDB(item.id).then(cachedUrl => {
      if (cachedUrl) {
        item.dataUrl = cachedUrl;
        renderPDFItem(parentEl, item, deps);
      }
    }).catch(() => {});

    pagesContainer.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #475569; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📑</div>
        <div style="font-weight: 600; margin-bottom: 4px; color: #1e293b;">${item.title || 'Sample Document'}</div>
        <div style="font-size: 0.8rem; color: #64748b; max-width: 320px; margin: 0 auto;">
          To view and annotate an actual PDF, click <b>📑 PDF</b> in the toolbar above and select any PDF from your computer or iPad.
        </div>
      </div>
    `;
    pdfCard.appendChild(pagesContainer);
    parentEl.appendChild(pdfCard);
    return;
  }

  pagesContainer.innerHTML = `<div class="pdf-loading"><div>⏳ Rendering PDF pages at natural resolution...</div></div>`;
  pdfCard.appendChild(pagesContainer);
  parentEl.appendChild(pdfCard);

  // Render via PDF.js on demand
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    try {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      } catch (_) {}

      const docKey = item.id || (item.dataUrl ? item.dataUrl.slice(0, 100) : 'default_pdf');
      let docPromise = pdfDocCache.get(docKey);

      if (!docPromise) {
        const base64 = item.dataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        docPromise = window.pdfjsLib.getDocument({ data: bytes }).promise.catch(async () => {
          // Fallback if cross-origin Web Worker fails on Mobile Safari
          return window.pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
        });
        pdfDocCache.set(docKey, docPromise);
      }

      docPromise.then(async (pdf) => {
        item.totalPages = pdf.numPages;
        const badgeEl = header.querySelector('.badge');
        if (badgeEl) badgeEl.textContent = `${pdf.numPages} Page${pdf.numPages > 1 ? 's' : ''}`;
        pagesContainer.innerHTML = '';

        // Determine default aspect ratio from first page
        let defaultAspect = 595 / 842;
        try {
          const firstPage = await pdf.getPage(1);
          const vp1 = firstPage.getViewport({ scale: 1.0 });
          defaultAspect = vp1.width / vp1.height;
        } catch (_) {}

        // Lazy renderer: renders only pages visible on screen or near viewport
        const renderPageOnDemand = async (pageNum, canvas, canvasWrapper) => {
          if (canvas.dataset.rendered === 'true') return;
          canvas.dataset.rendered = 'true';
          try {
            const page = await pdf.getPage(pageNum);
            const unscaledVp = page.getViewport({ scale: 1.0 });
            canvasWrapper.style.aspectRatio = `${unscaledVp.width} / ${unscaledVp.height}`;

            const dpr = window.devicePixelRatio || 1;
            // High-DPI Vector Scale: optimal 2.0x max on Retina prevents iPad graphics memory stalls
            const targetScale = Math.min(2.0, Math.max(1.2, dpr));
            const viewport = page.getViewport({ scale: targetScale });

            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            canvas.style.width = '100%';
            canvas.style.height = 'auto';

            await page.render({
              canvasContext: canvas.getContext('2d'),
              viewport: viewport
            }).promise;
          } catch (pageErr) {
            console.error(`Error rendering page ${pageNum}:`, pageErr);
            canvasWrapper.innerHTML = `<div class="pdf-error">Page ${pageNum} failed to render.</div>`;
          }
        };

        const pageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const slide = entry.target;
              const pageNum = parseInt(slide.dataset.pageNum, 10);
              const canvas = slide.querySelector('.pdf-page-canvas');
              const wrapper = slide.querySelector('.pdf-canvas-wrapper');
              if (canvas && wrapper) {
                renderPageOnDemand(pageNum, canvas, wrapper);
              }
            }
          });
        }, { root: null, rootMargin: '400px 0px' });

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const slideCard = document.createElement('div');
          slideCard.className = 'pdf-slide-card';
          slideCard.dataset.pageNum = pageNum;

          const slideHeader = document.createElement('div');
          slideHeader.className = 'pdf-slide-header';
          slideHeader.textContent = `Page ${pageNum} of ${pdf.numPages}`;
          slideCard.appendChild(slideHeader);

          const canvasWrapper = document.createElement('div');
          canvasWrapper.className = 'pdf-canvas-wrapper';
          canvasWrapper.style.aspectRatio = `${defaultAspect}`;

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          canvasWrapper.appendChild(canvas);
          slideCard.appendChild(canvasWrapper);
          pagesContainer.appendChild(slideCard);

          if (pageNum === 1) {
            renderPageOnDemand(1, canvas, canvasWrapper);
          }

          pageObserver.observe(slideCard);
        }
      }).catch(err => {
        console.error('PDF.js render error:', err);
        pdfDocCache.delete(docKey);
        pagesContainer.innerHTML = `
          <div class="pdf-error">Failed to load PDF document: ${err.message || 'Unknown error'}</div>
        `;
      });
    } catch (err) {
      console.error('PDF setup error:', err);
      pagesContainer.innerHTML = `
        <div class="pdf-error">Error setting up PDF: ${err.message}</div>
      `;
    }
  } else {
    pagesContainer.innerHTML = `
      <div class="pdf-error">PDF.js library not available.</div>
    `;
  }
}
