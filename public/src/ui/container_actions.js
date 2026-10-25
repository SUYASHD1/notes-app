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
    saveAssetIDB,
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

  // Native Local Media File Input Handler
  if (mediaFileInput) {
    mediaFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        showToast(`🖼 Loading media "${file.name}"...`);
        const reader = new FileReader();
        reader.onload = async (loadEvt) => {
          const dataUrl = loadEvt.target.result;
          const targetContainer = getOrCreateActiveContainer();
          const itemId = 'item_img_' + Date.now();
          targetContainer.items.push({ id: itemId, type: 'image', src: dataUrl, caption: file.name });
          if (saveAssetIDB) await saveAssetIDB(itemId, dataUrl);
          saveActivePageDocument();
          renderAll();
          showToast(`🖼 Added media "${file.name}"`);
        };
        reader.readAsDataURL(file);
      }
      mediaFileInput.value = '';
    });
  }

  // Native Local PDF File Input Handler (OneNote Slide Printout)
  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        showToast(`⏳ Loading PDF "${file.name}"...`);
        const reader = new FileReader();
        reader.onload = async (loadEvt) => {
          const dataUrl = loadEvt.target.result;
          const targetContainer = getOrCreateActiveContainer();
          if ((targetContainer.width || 540) < 780) targetContainer.width = 780;
          const itemId = 'item_pdf_' + Date.now();
          targetContainer.items.push({ id: itemId, type: 'pdf', title: file.name, dataUrl: dataUrl, totalPages: 1 });
          if (saveAssetIDB) await saveAssetIDB(itemId, dataUrl);
          saveActivePageDocument();
          renderAll();
          showToast(`📑 Loaded PDF "${file.name}" (OneNote Printout)`);
        };
        reader.readAsDataURL(file);
      }
      pdfFileInput.value = '';
    });
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
