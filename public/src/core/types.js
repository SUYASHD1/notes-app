// Core Document Types & Constants

export const BlockType = Object.freeze({
  NOTE_CONTAINER: 'note_container',
  TEXT: 'text',
  PDF_PRINTOUT: 'pdf_printout',
  PLOT: 'plot',
  TABLE: 'table',
  MEDIA: 'media',
  INBOX_CANVAS: 'inbox_canvas',
  SKETCH: 'sketch'
});

export const ShapeType = Object.freeze({
  LINE: 'line',
  CIRCLE: 'circle',
  RECTANGLE: 'rectangle',
  TRIANGLE: 'triangle',
  ARROW: 'arrow',
  NONE: 'none'
});

export const GestureType = Object.freeze({
  DOUBLE_TAP: 'double_tap',
  PINCH_ZOOM: 'pinch_zoom',
  PAN: 'pan',
  TAP: 'tap'
});

export function createNoteContainer(options = {}) {
  return {
    id: options.id || 'note_' + Math.random().toString(36).substr(2, 9),
    type: BlockType.NOTE_CONTAINER,
    x: options.x ?? 60,
    y: options.y ?? 60,
    width: options.width ?? 540,
    height: options.height ?? 'auto',
    title: options.title || 'Note',
    items: options.items || [
      { id: 'item_1', type: 'text', content: '# Note\nType notes here with $inline$ or $$block$$ math...' }
    ]
  };
}

export function createTextBlock(options = {}) {
  return {
    id: options.id || 'block_text_' + Math.random().toString(36).substr(2, 9),
    type: BlockType.TEXT,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 320,
    height: options.height ?? 'auto',
    content: options.content || '',
    fontSize: options.fontSize || 14,
    fontFamily: options.fontFamily || 'Segoe UI',
    color: options.color || '#1e293b'
  };
}

export function createPDFPrintoutBlock(options = {}) {
  return {
    id: options.id || 'block_pdf_' + Math.random().toString(36).substr(2, 9),
    type: BlockType.PDF_PRINTOUT,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 600,
    height: options.height ?? 800,
    title: options.title || 'Printout',
    pdfUrl: options.pdfUrl || '',
    pageIndex: options.pageIndex ?? 0,
    totalPages: options.totalPages ?? 1,
    pageGap: options.pageGap ?? 24
  };
}

export function createPlotBlock(options = {}) {
  return {
    id: options.id || 'block_plot_' + Math.random().toString(36).substr(2, 9),
    type: BlockType.PLOT,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 400,
    height: options.height ?? 260,
    formula: options.formula || 'sin(x)',
    xMin: options.xMin ?? -10,
    xMax: options.xMax ?? 10,
    yMin: options.yMin ?? -2,
    yMax: options.yMax ?? 2
  };
}

export function createTableBlock(options = {}) {
  return {
    id: options.id || 'block_tbl_' + Math.random().toString(36).substr(2, 9),
    type: BlockType.TABLE,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 420,
    height: options.height ?? 200,
    rows: options.rows ?? 3,
    cols: options.cols ?? 3,
    data: options.data || [
      ['Header 1', 'Header 2', 'Header 3'],
      ['Row 1, Col 1', 'Row 1, Col 2', 'Row 1, Col 3'],
      ['Row 2, Col 1', 'Row 2, Col 2', 'Row 2, Col 3']
    ]
  };
}

export function createMediaBlock(options = {}) {
  return {
    id: options.id || 'block_media_' + Math.random().toString(36).substr(2, 9),
    type: BlockType.MEDIA,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 350,
    height: options.height ?? 240,
    url: options.url || '',
    caption: options.caption || ''
  };
}

export function createStroke(options = {}) {
  return {
    id: options.id || 'stroke_' + Math.random().toString(36).substr(2, 9),
    color: options.color || '#0f172a',
    width: options.width ?? 2.5,
    points: options.points || [], // Array of { x, y, pressure, time }
    isAutoShape: options.isAutoShape ?? false,
    shapeType: options.shapeType || ShapeType.NONE,
    shapeData: options.shapeData || null
  };
}
