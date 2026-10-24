// Unified Container Item Creation & Insertion Actions

/**
 * Creates actions for inserting notes, tables, plots, sketches, math formulas, and media.
 */
export function createContainerActions(options) {
  const {
    state,
    container,
    mediaFileInput,
    pdfFileInput,
    showToast,
    renderAll,
    saveActivePageDocument,
    createNewNoteContainer,
    getOrCreateActiveContainer,
    AddBlockCommand
  } = options;

  function actionAddNote() {
    const center = state.viewport.screenToWorld(container.clientWidth / 2, container.clientHeight / 2);
    const newNote = createNewNoteContainer(center.x - 290, center.y - 120);
    state.history.execute(new AddBlockCommand(state.doc, newNote));
    state.selectedBlockIds.clear();
    state.selectedBlockIds.add(newNote.id);
    state.activeContainerId = newNote.id;
    saveActivePageDocument();
    renderAll();
    showToast('📝 Created Universal Note Box');
  }

  function actionBrowseMedia() {
    if (mediaFileInput) {
      mediaFileInput.value = '';
      mediaFileInput.click();
    }
  }

  function actionBrowsePdf() {
    if (pdfFileInput) {
      pdfFileInput.value = '';
      pdfFileInput.click();
    }
  }

  function actionInsertTable() {
    const target = getOrCreateActiveContainer();
    target.items.push({
      id: 'item_tbl_' + Date.now(),
      type: 'table',
      data: [
        ['Parameter', 'Initial', 'Final'],
        ['Position x', '0.00 m', '15.4 m'],
        ['Velocity v', '0.00 m/s', '8.2 m/s']
      ]
    });
    saveActivePageDocument();
    renderAll();
    showToast('⊞ Added Table to Note');
  }

  function actionInsertPlot() {
    const target = getOrCreateActiveContainer();
    target.items.push({
      id: 'item_plot_' + Date.now(),
      type: 'plot',
      formula: 'cos(x)',
      xMin: -10,
      xMax: 10
    });
    saveActivePageDocument();
    renderAll();
    showToast('📈 Added Math Plot to Note');
  }

  function actionInsertSketch() {
    const target = getOrCreateActiveContainer();
    target.items.push({
      id: 'item_sketch_' + Date.now(),
      type: 'sketch',
      height: 260,
      strokes: []
    });
    saveActivePageDocument();
    renderAll();
    showToast('✍ Added Handwriting Canvas to Note');
  }

  function actionInsertMath() {
    const target = getOrCreateActiveContainer();
    target.items.push({
      id: 'item_math_' + Date.now(),
      type: 'text',
      content: '$$\\int_{a}^{b} f(x) dx = F(b) - F(a)$$\nLinear approximation: $f(x) \\approx f(a) + f\'(a)(x - a)$'
    });
    saveActivePageDocument();
    renderAll();
    showToast('$fx Added LaTeX Equation to Note');
  }

  return {
    actionAddNote,
    actionBrowseMedia,
    actionBrowsePdf,
    actionInsertTable,
    actionInsertPlot,
    actionInsertSketch,
    actionInsertMath
  };
}
