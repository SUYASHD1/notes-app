// Core Mathematical & Document Models for Notes App (Aggregator & Facade)

export { BlockType, ShapeType, GestureType, createNoteContainer, createTextBlock, createPDFPrintoutBlock, createPlotBlock, createTableBlock, createMediaBlock, createStroke } from './core/types.js';
export { Sandbox, SandboxError } from './core/sandbox.js';
export { HistoryManager, Command, AddBlockCommand, RemoveBlockCommand, AddStrokeCommand, EraseStrokesCommand } from './core/history.js';
export { DocumentModel } from './core/document.js';
export { createBlankDocument, createSampleDocument } from './core/sample_notebook.js';

export { Viewport } from './canvas/viewport.js';
export { FrustumCuller } from './canvas/culler.js';
export { StrokeRenderer } from './canvas/stroke_renderer.js';
export { ShapeDetector } from './canvas/shape_detector.js';
export { TouchGestureRecognizer } from './canvas/gestures.js';
export { EraserEngine } from './canvas/eraser_engine.js';
export { getCanvasContentBounds, clampViewportBounds } from './canvas/viewport_bounds.js';
export { updateScrollbars, setupScrollbarDragging, setupEdgeAutoScroll, registerActiveDragCallback, unregisterActiveDragCallback } from './canvas/scrollbar_controller.js';
export { setupKineticPan } from './canvas/kinetic_pan.js';
export { setupViewportInteractions } from './canvas/viewport_interaction.js';
export { finalizeStroke } from './canvas/stroke_creator.js';
export { setupInkingInteractions } from './canvas/inking_interaction.js';

export { MarkdownLatexParser } from './blocks/text_block.js';
export { PDFPrintoutManager } from './blocks/pdf_block.js';
export { FunctionPlotter } from './blocks/plot_block.js';
export { TableBlockModel } from './blocks/table_block.js';
export { MediaBlockModel } from './blocks/media_block.js';
export { ResizeHandleEngine, ResizeHandleType } from './blocks/resize_handle.js';
export { attachResizeHandle, makeDraggable } from './blocks/block_drag_resize.js';
export { renderTableItem, renderPlotItem, drawPlot } from './blocks/math_table_renderer.js';
export { renderPDFItem } from './blocks/pdf_renderer.js';
export { openImageCropper } from './blocks/image_cropper.js';
export { vaultExternalImage, vaultImagesInTextItem, dockImageIntoContainer, renderMediaItem } from './blocks/media_renderer.js';
export { renderTextItem } from './blocks/text_renderer.js';
export { renderSketchItem } from './blocks/sketch_renderer.js';
export { renderBlocks } from './blocks/container_renderer.js';

export { HierarchyManager } from './storage/hierarchy.js';
export { CloudflareR2Sync } from './storage/r2_sync.js';
export { LocalVault } from './storage/indexed_db.js';

export { showToast } from './ui/toast.js';
export { setupStorageSettingsModal } from './ui/storage_settings_modal.js';
export { initHierarchy, saveHierarchy, renderHierarchyUI, setupSidebarControls, createDefaultHierarchy } from './ui/sidebar.js';
export { setupInkPaletteControls } from './ui/ink_palette.js';
export { setupLayoutSwitcher, setMode, setupFloatingModePuck } from './ui/layout_puck.js';
export { setupInstallPrompt, registerServiceWorker, showIOSInstallModal, isStandaloneMode, isIOSDevice } from './ui/install_prompt.js';
export { setupRibbonTabs } from './ui/ribbon_controller.js';
export { createContainerActions } from './ui/container_actions.js';
export { setupRibbonControls } from './ui/ribbon_actions.js';
export { setupKeyboardAndClipboard } from './ui/keyboard_shortcuts.js';
export { getPreferredTheme, applyTheme, toggleTheme, setupThemeController, THEME_DARK, THEME_LIGHT } from './ui/theme_controller.js';


// Backward compatibility alias for StrokeEngine
import { StrokeRenderer } from './canvas/stroke_renderer.js';
export class StrokeEngine {
  static smoothPoints(rawPoints) {
    return StrokeRenderer.smoothPoints(rawPoints);
  }

  static isPointInBox(point, box) {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  }
}
