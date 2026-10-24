// Sample Starter Notebook Data & Blank Document Creator
import { DocumentModel } from './document.js';

/**
 * Creates a clean blank document for a page.
 * @param {string} pageId
 * @param {object} [hierarchy]
 * @returns {DocumentModel}
 */
export function createBlankDocument(pageId, hierarchy = null) {
  const currentHierarchy = hierarchy || (typeof window !== 'undefined' && window.state ? window.state.hierarchy : null);
  const pageMeta = currentHierarchy?.pages?.find(p => p.id === pageId);
  return new DocumentModel({
    id: pageId,
    title: pageMeta ? pageMeta.title : 'Untitled Page',
    blocks: [],
    globalAnnotations: []
  });
}

/**
 * Creates the initial sample notebook page (Kinematics, calculus, formulas, dynamic plot, table, and lecture slides).
 * @param {string} [pageId='nb_physics_demo_p1']
 * @returns {DocumentModel}
 */
export function createSampleDocument(pageId = 'nb_physics_demo_p1') {
  const doc = new DocumentModel({ id: pageId, title: 'Calculus & Physics Notes' });

  // Container 1: Kinematics & Derivatives (Mixed text, LaTeX math, table, and function plot)
  doc.addBlock({
    id: 'note_kinematics_1',
    type: 'note_container',
    x: 60,
    y: 60,
    width: 580,
    title: 'Kinematics & Derivatives',
    items: [
      {
        id: 'item_text_1',
        type: 'text',
        content: `# 1. Instantaneous Velocity
The derivative defines instantaneous rate of change:
$$v(t) = \\lim_{\\Delta t \\to 0} \\frac{x(t + \\Delta t) - x(t)}{\\Delta t} = \\frac{dx}{dt}$$
- [x] Limit definition reviewed
- [ ] Complete practice problems for tangent slopes`
      },
      {
        id: 'item_plot_1',
        type: 'plot',
        formula: 'sin(x) * exp(-0.15 * x)',
        xMin: -5,
        xMax: 15
      },
      {
        id: 'item_table_1',
        type: 'table',
        data: [
          ['Time t (s)', 'Position x (m)', 'Velocity v (m/s)'],
          ['0.0', '0.00', '10.0'],
          ['1.0', '8.50', '7.0'],
          ['2.0', '14.00', '4.0']
        ]
      }
    ]
  });

  // Container 2: Lecture Slides (PDF Printout)
  doc.addBlock({
    id: 'note_slides_2',
    type: 'note_container',
    x: 680,
    y: 60,
    width: 520,
    title: 'Lecture Slides & Materials',
    items: [
      {
        id: 'item_text_2',
        type: 'text',
        content: `### Reference Materials
Switch to **📱 iPad Ink** mode to draw annotations and diagrams directly over these slides.`
      },
      {
        id: 'item_pdf_1',
        type: 'pdf',
        title: 'Kinematics_Lecture_Week1.pdf',
        totalPages: 2
      }
    ]
  });

  return doc;
}
