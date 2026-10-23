// Core Mathematical & Document Models for Notes App (Aggregator & Facade)

export { BlockType, ShapeType, GestureType, createNoteContainer, createTextBlock, createPDFPrintoutBlock, createPlotBlock, createTableBlock, createMediaBlock, createStroke } from './core/types.js';
export { Sandbox, SandboxError } from './core/sandbox.js';
export { HistoryManager, Command, AddBlockCommand, RemoveBlockCommand, AddStrokeCommand, EraseStrokesCommand } from './core/history.js';
export { DocumentModel } from './core/document.js';

export { Viewport } from './canvas/viewport.js';
export { FrustumCuller } from './canvas/culler.js';
export { StrokeRenderer } from './canvas/stroke_renderer.js';
export { ShapeDetector } from './canvas/shape_detector.js';
export { TouchGestureRecognizer } from './canvas/gestures.js';
export { EraserEngine } from './canvas/eraser_engine.js';

export { MarkdownLatexParser } from './blocks/text_block.js';
export { PDFPrintoutManager } from './blocks/pdf_block.js';
export { FunctionPlotter } from './blocks/plot_block.js';
export { TableBlockModel } from './blocks/table_block.js';
export { MediaBlockModel } from './blocks/media_block.js';
export { ResizeHandleEngine, ResizeHandleType } from './blocks/resize_handle.js';

export { HierarchyManager } from './storage/hierarchy.js';
export { CloudflareR2Sync } from './storage/r2_sync.js';
export { LocalVault } from './storage/indexed_db.js';

export { showToast } from './ui/toast.js';
export { setupStorageSettingsModal } from './ui/storage_settings_modal.js';
export { initHierarchy, saveHierarchy, renderHierarchyUI, setupSidebarControls, createDefaultHierarchy } from './ui/sidebar.js';
export { setupInkPaletteControls } from './ui/ink_palette.js';
export { setupLayoutSwitcher, setMode, setupFloatingModePuck } from './ui/layout_puck.js';
export { setupInstallPrompt, registerServiceWorker, showIOSInstallModal, isStandaloneMode, isIOSDevice } from './ui/install_prompt.js';

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
