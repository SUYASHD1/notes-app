// OneNote-Style PDF Printout Layout Engine

export class PDFPrintoutManager {
  /**
   * Generates sequential coordinates for a multi-page PDF document
   * laid out vertically in OneNote printout style.
   */
  static layoutPages(options = {}) {
    const {
      baseX = 100,
      baseY = 100,
      totalPages = 1,
      pageWidth = 600,
      pageHeight = 800,
      pageGap = 24,
      pdfUrl = '',
      title = 'Lecture Slides'
    } = options;

    const pages = [];
    for (let i = 0; i < totalPages; i++) {
      const pageY = baseY + i * (pageHeight + pageGap);
      pages.push({
        id: `pdf_page_${i + 1}`,
        pageIndex: i,
        pageNumber: i + 1,
        title: `${title} - Page ${i + 1}`,
        pdfUrl,
        x: baseX,
        y: pageY,
        width: pageWidth,
        height: pageHeight,
        annotationLayerId: `layer_pdf_page_${i + 1}`
      });
    }

    return pages;
  }

  /**
   * Returns the overall bounding box enclosing all pages in the printout.
   */
  static getPrintoutBounds(pages) {
    if (!pages || pages.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    const minX = pages[0].x;
    const minY = pages[0].y;
    const last = pages[pages.length - 1];
    const maxX = last.x + last.width;
    const maxY = last.y + last.height;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Converts a world coordinate into local page-relative coordinate (0..1 normalized).
   */
  static worldToPageRelative(worldX, worldY, page) {
    return {
      relX: (worldX - page.x) / page.width,
      relY: (worldY - page.y) / page.height
    };
  }
}
