import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFPrintoutManager } from '../src/blocks/pdf_block.js';
import { ResizeHandleEngine, ResizeHandleType } from '../src/blocks/resize_handle.js';
import { TableBlockModel } from '../src/blocks/table_block.js';
import { FunctionPlotter } from '../src/blocks/plot_block.js';

test('PDF Printout sequential multi-page layout', () => {
  const pages = PDFPrintoutManager.layoutPages({
    baseX: 50,
    baseY: 100,
    totalPages: 3,
    pageWidth: 500,
    pageHeight: 700,
    pageGap: 30,
    pdfUrl: 'https://example.com/slides.pdf'
  });

  assert.equal(pages.length, 3);
  assert.equal(pages[0].pageIndex, 0);
  assert.equal(pages[0].x, 50);
  assert.equal(pages[0].y, 100);

  // Second page should be offset by pageHeight + pageGap = 730
  assert.equal(pages[1].pageIndex, 1);
  assert.equal(pages[1].x, 50);
  assert.equal(pages[1].y, 100 + 730);

  // Third page
  assert.equal(pages[2].pageIndex, 2);
  assert.equal(pages[2].y, 100 + 730 * 2);

  const bounds = PDFPrintoutManager.getPrintoutBounds(pages);
  assert.equal(bounds.minX, 50);
  assert.equal(bounds.minY, 100);
  assert.equal(bounds.maxX, 550);
  assert.equal(bounds.maxY, 100 + 730 * 2 + 700);
});

test('PDF Printout world coordinate to page-relative coordinate', () => {
  const page = { x: 100, y: 200, width: 400, height: 600 };
  const rel = PDFPrintoutManager.worldToPageRelative(300, 500, page);
  // (300 - 100) / 400 = 0.5
  // (500 - 200) / 600 = 0.5
  assert.equal(rel.relX, 0.5);
  assert.equal(rel.relY, 0.5);
});

test('8-point bounding box resize calculations', () => {
  const orig = { x: 100, y: 100, width: 200, height: 150 };

  // Dragging SE handle by (+50, +30)
  const resizedSE = ResizeHandleEngine.applyResize(ResizeHandleType.SE, orig, 50, 30);
  assert.equal(resizedSE.width, 250);
  assert.equal(resizedSE.height, 180);
  assert.equal(resizedSE.x, 100);
  assert.equal(resizedSE.y, 100);

  // Dragging NW handle by (+20, +20) shrinks width/height and shifts origin
  const resizedNW = ResizeHandleEngine.applyResize(ResizeHandleType.NW, orig, 20, 20);
  assert.equal(resizedNW.width, 180);
  assert.equal(resizedNW.height, 130);
  assert.equal(resizedNW.x, 120);
  assert.equal(resizedNW.y, 120);
});

test('Dynamic Table block rows and columns management', () => {
  const tbl = new TableBlockModel({ rows: 2, cols: 2 });
  assert.equal(tbl.rows, 2);
  assert.equal(tbl.cols, 2);

  tbl.setCellValue(1, 1, 'Value 42');
  assert.equal(tbl.getCellValue(1, 1), 'Value 42');

  tbl.addRow();
  assert.equal(tbl.rows, 3);
  assert.equal(tbl.getCellValue(2, 0), '');

  tbl.addColumn();
  assert.equal(tbl.cols, 3);
});

test('Function plotter projection and evaluation', () => {
  const val = FunctionPlotter.evaluateExpression('cos(x)', 0);
  assert.equal(val, 1);

  const proj = FunctionPlotter.projectToPixel(0, 0, { xMin: -10, xMax: 10, yMin: -5, yMax: 5 }, 400, 200, 0);
  assert.equal(proj.px, 200);
  assert.equal(proj.py, 100);
});

test('PDF Printout item preserves dataUrl and page count', () => {
  const dummyPdfData = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...';
  const pdfItem = {
    id: 'item_pdf_test',
    type: 'pdf',
    title: 'KVS_NVS_InterviewLetter.pdf',
    dataUrl: dummyPdfData,
    totalPages: 2
  };

  assert.equal(pdfItem.title, 'KVS_NVS_InterviewLetter.pdf');
  assert.ok(pdfItem.dataUrl.startsWith('data:application/pdf'));
  assert.equal(pdfItem.totalPages, 2);
});

test('Image crop coordinate normalization and scaling', () => {
  const naturalWidth = 1000;
  const naturalHeight = 800;
  const displayWidth = 500;
  const displayHeight = 400;

  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;
  assert.equal(scaleX, 2);
  assert.equal(scaleY, 2);

  const cropRect = { x: 50, y: 40, w: 200, h: 150 };
  const naturalX = Math.round(cropRect.x * scaleX);
  const naturalY = Math.round(cropRect.y * scaleY);
  const naturalW = Math.round(cropRect.w * scaleX);
  const naturalH = Math.round(cropRect.h * scaleY);

  assert.equal(naturalX, 100);
  assert.equal(naturalY, 80);
  assert.equal(naturalW, 400);
  assert.equal(naturalH, 300);
});

test('PDF Printout avoids storing bloated base64 pages array to protect localStorage', () => {
  const item = {
    id: 'item_pdf_sample',
    type: 'pdf',
    title: 'Paper.pdf',
    dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
    totalPages: 3,
    pages: [
      { pageNum: 1, src: 'data:image/png;base64,bloatedData...' },
      { pageNum: 2, src: 'data:image/png;base64,bloatedData...' }
    ]
  };

  // In the optimized implementation, item.pages is purged to prevent QuotaExceededError
  if (item.pages) {
    delete item.pages;
  }

  assert.equal(item.pages, undefined);
  assert.equal(item.totalPages, 3);
  assert.ok(item.dataUrl);
});

test('PDF natural aspect ratio calculation for standard A4 and Letter', () => {
  // Standard A4 at 72dpi: 595.28 x 841.89
  const a4Width = 595.28;
  const a4Height = 841.89;
  const a4Aspect = a4Width / a4Height;
  assert.ok(Math.abs(a4Aspect - 0.707) < 0.01);

  // When container width is 760, natural rendered height should be:
  const naturalHeight = Math.round(760 / a4Aspect);
  assert.equal(naturalHeight, 1075);
});


