# Implementation Plan: Ultra-Lightweight Portable Notes App

An ultra-lightweight, portable OneNote-alternative note-taking application engineered for high performance, tiny binary footprint (<15 MB), instant cold boot (<200ms), local-first storage with optional Cloudflare R2 cloud sync, PDF printouts, LaTeX math rendering, aesthetic vector handwriting with dynamic pressure tapering, auto-shape detection, and an industrial-grade performance & crash-resilience framework.

## Key Architectural Principles
1. **Local-First & Portable**: Runs from a single folder/executable without external dependencies; all data resides locally on the user's machine.
2. **Ultra-Low Footprint & Zippy Response**: Sub-15 MB binary, <50 MB idle RAM, sub-200ms cold startup, 60/120 FPS panning and zooming. Avoids heavy runtimes like Electron.
3. **Cross-Platform Core**: Shared TypeScript/Canvas2D/WebGL rendering engine compatible across Windows and iPadOS.
4. **Asymmetric UX**:
   - **Windows**: Focused on keyboard productivity, rich text editing with LaTeX math, PDF printouts, images, GIFs, tables, function plots, and razor-sharp vector ink viewing (no stylus input clutter).
   - **iPadOS**: Equipped with Apple Pencil digitizer for Global Annotations (Mode 1), In-Box Handwriting Canvas (Mode 2), touch gesture shortcuts (double-tap to undo), and auto-shape detection.
5. **Zero-Crash Resilience & Atomic Safety**: Fail-safe sandboxed blocks prevent syntax errors or corrupt assets from crashing the canvas; atomic file writes prevent document corruption on unexpected shutdown.
6. **Headless Development & Testing**: All modules, math plotting algorithms, document schemas, gesture recognizers, shape detection algorithms, and stress suites are tested headlessly via automated CLI test harnesses.

---

## High-Level Architecture

```
+-------------------------------------------------------------------------------+
|                             APPLICATION SHELL                                 |
|   - Desktop (Windows): Tauri v2 (Rust shell + native WebView2)                |
|   - Mobile (iPadOS): Capacitor / Native WebKit container (Apple Pencil ready) |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                      PERFORMANCE & RENDERING ENGINE                           |
|   - Hardware 3D Transforms (translate3d, scale) on requestAnimationFrame      |
|   - Viewport Frustum Culler: Only renders elements visible on screen          |
|   - High-DPI Resolution Buffer Scaling (devicePixelRatio compensation)       |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                     CORE CANVAS & SANDBOXED BLOCKS                            |
|                                                                               |
|  [ LAYER 1: Spatial 2D Block Plane - Isolated Sandboxes ]                     |
|   - Text & LaTeX Blocks ($inline$ & $$block$$ with error boundary fallbacks)  |
|   - PDF Printout Blocks (OneNote style: multi-page layout, arrange & annotate)|
|   - Interactive Grid Tables                                                   |
|   - Media & Animated GIF Blocks                                               |
|   - Math Function Plotter Engine (y = f(x), coordinate axes, curve rendering) |
|   - Embedded In-Box Canvas (Mode 2: Handwriting confined to text flow)        |
|                                                                               |
|  [ LAYER 2: Vector Ink & Auto-Shape Plane ]                                   |
|   - Bézier Spline Interpolation with Velocity/Pressure Tapering               |
|   - Auto-Shape Detection Engine ("Draw & Hold" -> Line, Circle, Rect, Arrow) |
|   - Touch Gesture Recognizer (Double-tap to Undo, 2-finger zoom/pan)          |
|   - Razor-sharp vector path rendering at any zoom scale (20% to 400%)         |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                   DATA PERSISTENCE & FAULT-TOLERANT SYNC                      |
|   - Atomic File Storage: Staging writes (.tmp) + checksums (Zero corruption)  |
|   - Asset Manager: Hash-addressed deduplication for PDFs, images, and GIFs    |
|   - Immutable History Stack: Transactional Undo/Redo commands                 |
|   - Cloud Sync (Optional): Cloudflare R2 (S3 REST API) with local-first cache |
+-------------------------------------------------------------------------------+
```

---

## Finalized UI Architecture: Layout A ("Modern OneNote")

Following user evaluation and dummy testing, **Layout A (Modern OneNote)** is finalized as the core design standard for the application.

```
+---------------------------------------------------------------------------------------------------------+
| [TOP BAR: APP & WORKSPACE HEADER]                                                                       |
| [≡ Menu]  [Notebook: Physics 101 ▼]   |  Sync: [● Local Saved]  |  [💻 Win View] [📱 iPad Ink]  | [☁ R2] |
+---------------------------------------------------------------------------------------------------------+
| [ZONE 1: PERMANENT TYPOGRAPHY & TOOLS RIBBON]                                                           |
| [Segoe UI ▼] [14pt ▼] [H1▼] | [B] [I] [U] [S] [Color▼] [🖍] | [$fx Math] | [+Text +Table +Plot +PDF]   |
+-----------------------+-----------------------+---------------------------------------------------------+
| [ZONE 2: SECTIONS]    | [ZONE 3: PAGES INDEX] | [ZONE 4: INFINITE 2D CANVAS WORKSPACE]                  |
| (Collapsible)         | (Collapsible)         |                                                         |
|                       | [Search pages...]     |  Double-click anywhere to place text.                   |
| 🟣 Limits & Continuity| 📄 Intro & Derivatives|                                                         |
| 🔵 Derivative Rules   |   ↳ Epsilon-Delta     |   +-------------------+      +-----------------------+  |
| 🟢 Integrals & Area   |   ↳ Critical Points   |   | [TEXT & LATEX]    |      | [PDF PRINTOUT PAGE 1] |  |
| 🟡 Kinematics Lab     | 📄 Chain Rule         |   | \int_a^b f(x) dx  |      | [Lecture_Slides.pdf]  |  |
|                       |                       |   | [Rendered Math]   |      | [Annotate on top]     |  |
|                       |                       |   +-------------------+      +-----------------------+  |
|                       |                       |                                                         |
|                       |                       |      [Auto-Shape: Draw & Hold 400ms -> Clean Line/Circle]|
|                       |                       |      [Touch: Double-tap = Undo ↺]                       |
| [+ New Section]       | [+ New Page]          |                                                         |
+-----------------------+-----------------------+---------------------------------------------------------+
| [STATUS BAR: Physics 101 > Limits > Derivatives Intro | Zoom: 100% (- / +) | Synced to Cloudflare R2]  |
+---------------------------------------------------------------------------------------------------------+
```

---

## Performance & Zero-Crash Resilience Framework

### 1. Viewport Frustum Culling (Sub-50MB RAM with Thousands of Objects)
* **Problem**: Pages with hundreds of notes, 50 PDF slides, and thousands of ink strokes bog down DOM and GPU memory.
* **Architecture**:
  * An automated spatial index tracks block and stroke bounding boxes in world coordinates.
  * The engine calculates the active screen viewport rectangle: `[x_min, y_min, x_max, y_max]`.
  * Off-screen blocks are culled from DOM rendering; only elements within the visible frustum (+ a 100px buffer for smooth panning) are rendered.
  * Ensures memory and CPU load remain flat regardless of document scale.

### 2. Zero Layout Thrashing (Hardware-Accelerated GPU Transforms)
* Panning and zooming modify zero DOM dimensions or box offsets.
* The entire canvas plane moves via `transform: translate3d(x, y, 0) scale(zoom)` running directly on the GPU at 60/120 FPS.
* Coordinate updates are debounced and synchronized with `window.requestAnimationFrame`.

### 3. Isolated Block Sandboxes (Crash-Proof Architecture)
* Every content block (LaTeX equations, Math function plotter, Table, PDF printout) runs inside an isolated execution boundary.
* If a user writes an invalid LaTeX expression (e.g. `$$\int \broken%#$$`) or provides an invalid math formula (`y = 1 / (x - x)`), the error is caught inside the block.
* The block displays a clean inline alert without throwing unhandled exceptions, ensuring the main canvas, navigation, and auto-save are never disrupted.

### 4. Atomic Persistence & Corruption-Proof Storage
* Saves are executed atomically: document data is serialized and written to a temporary staging file (`page_id.json.tmp`).
* The engine verifies file integrity and hash checksums, then performs an atomic rename to the target file (`page_id.json`).
* If a machine abruptly loses power or is closed mid-save, the existing document is preserved with zero data corruption.

---

## Detailed Feature Specifications

### 1. Aesthetic Vector Ink Engine
* **Bézier Spline Smoothing**: Converts raw discrete stylus points into smooth cubic Bézier curves.
* **Dynamic Velocity & Pressure Tapering**: Modulates line width based on drawing speed and Apple Pencil pressure for natural pen physics.
* **High-DPI Sub-Pixel Sharpness**: Vector paths scale with device pixel ratio, staying razor-sharp from 20% to 400% zoom.

### 2. Auto-Shape Detection Engine ("Draw and Hold")
* User draws a rough shape in a single stroke and pauses for $\ge 400\text{ms}$ at the endpoint.
* **Straight Lines**: Chord-to-arc length ratio $\ge 0.93$.
* **Circles & Ellipses**: Centroid radial variance $\le 15\%$.
* **Rectangles**: 4-corner orthogonal angle detection ($90^\circ \pm 20^\circ$).
* **Arrows**: Shaft line with backtrack $V$-tip detection.
* **False-Positive Rejection**: Arbitrary handwriting and scribbles are strictly preserved as normal ink.

### 3. OneNote-Style PDF Printout Blocks
* Multi-page PDF import laying out sequential page blocks on the infinite canvas.
* Each page block allows drawing highlights and ink notes directly on top or taking rich text notes alongside.
* Viewport frustum culling to keep memory footprint minimal.

### 4. Rich Text with LaTeX Math & Markdown
* Inline math (`$formula$`) and display block equations (`$$formula$$`).
* Fast, self-contained LaTeX parser rendering into clean mathematical typography.
* Click to edit raw formula; defocus to render.

### 5. Touch Screen Double-Tap to Undo
* Two consecutive taps within $\le 300\text{ms}$ and $\le 20\text{px}$ trigger `HistoryManager.undo()`.
* Distinct separation from single-finger pan, two-finger pinch-zoom, and stylus drawing.

---

## Proposed Changes & File Layout

### 1. Project Scaffolding & Configuration
* **`package.json`**: Minimal dependencies, ES module configuration, test runner script.
* **`tsconfig.json` & `vite.config.ts`**: TypeScript setup with headless test runner integration.

### 2. Core Document Model & State (`src/core/`)
* **`src/core/types.ts`**:
  * Schemas for: `Block`, `TextBlock`, `PDFPrintoutBlock`, `PlotBlock`, `TableBlock`, `Stroke`, `DetectedShape`.
* **`src/core/document.ts`**: Document serialization including vector ink, shapes, and PDF assets.
* **`src/core/history.ts`**: Immutable Undo/Redo command stack.
* **`src/core/sandbox.ts`**: [NEW] Error-boundary wrapper protecting blocks from malformed user input.

### 3. Infinite Freeform Canvas & Performance Engine (`src/canvas/`)
* **`src/canvas/viewport.ts`**: Pan, zoom, and hardware GPU coordinate transforms.
* **`src/canvas/culler.ts`**: [NEW] Viewport frustum culling and spatial bounding box index.
* **`src/canvas/stroke_renderer.ts`**: Bézier spline smoothing with velocity/pressure tapering.
* **`src/canvas/shape_detector.ts`**: Pure geometric shape recognizer (Lines, Circles, Rectangles, Arrows).
* **`src/canvas/gestures.ts`**: Touch gesture recognizer (Double-tap to undo, pinch-to-zoom).

### 4. Block Components (`src/blocks/`)
* **`src/blocks/text_block.ts`**: Rich text editing with Markdown formatting and inline/block LaTeX parser.
* **`src/blocks/pdf_block.ts`**: OneNote-style PDF printout manager.
* **`src/blocks/plot_block.ts`**: Math function plotter for $y = f(x)$ with error sandboxing.
* **`src/blocks/table_block.ts`**: Dynamic grid tables.
* **`src/blocks/media_block.ts`**: Images and animated GIFs.
* **`src/blocks/resize_handle.ts`**: 8-point bounding box drag handles with 1:1 zoom compensation.

### 5. Storage & Cloudflare R2 Sync (`src/storage/`)
* **`src/storage/hierarchy.ts`**: Notebooks $\rightarrow$ Sections $\rightarrow$ Pages & Subpages.
* **`src/storage/local_store.ts`**: Atomic disk persistence (`.tmp` write + verify + rename) with PDF asset caching.
* **`src/storage/r2_sync.ts`**: Cloudflare R2 S3 REST API integration.

---

## Headless Development & Testing Strategy

Per user rule: **"always perform headless development and testing do not use visual method"**.

All test verification is executed purely via automated CLI test harnesses:

1. **Document, Hierarchy & Math Tests (`tests/core.test.ts`)**:
   - Coordinate transforms between screen and infinite canvas space.
   - Notebook $\rightarrow$ section $\rightarrow$ page hierarchy CRUD operations.
   - Math expression parser and function curve generation.

2. **Auto-Shape Recognition Tests (`tests/shape_detector.test.ts`)**:
   - Straight line, circle, rectangle, and arrow recognition from noisy coordinate streams.
   - Rejection of non-shapes (scribbles, arbitrary handwriting).

3. **Stroke Smoothing & Velocity Tapering Tests (`tests/strokes.test.ts`)**:
   - Cubic Bézier control point calculations.
   - Velocity-based stroke width modulation under variable speeds.

4. **LaTeX & Markdown Parsing Tests (`tests/latex_markdown.test.ts`)**:
   - Inline `$math$` and display `$$math$$` extraction and AST generation.
   - Markdown checklists and typography tokenization.

5. **PDF Printout Model Tests (`tests/pdf_printout.test.ts`)**:
   - Multi-page PDF layout positioning and bounding box calculation.

6. **Touch Gesture & Undo Tests (`tests/gesture_undo.test.ts`)**:
   - Synthetic touch event streams testing double-tap recognition within $\le 300\text{ms}$.

7. **Performance & Stress / Chaos Harness (`tests/stress_culling.test.ts`) [NEW]**:
   - Spawns 2,000 blocks and 10,000 strokes; verifies that viewport culling selects $\le 10$ active blocks for any screen viewport.
   - Injects corrupt LaTeX formulas, divide-by-zero math curves, and malformed JSON to prove the app never throws unhandled crashes.
   - Atomic file write verification: tests simulated power abort mid-save to confirm zero corruption.

8. **Storage & Sync Harness (`tests/sync.test.ts`)**:
   - Mock S3 / R2 endpoints testing offline delta queuing and asset synchronization.

---

## Implementation Stages

1. **Stage 1**: Scaffold schemas, error-boundary sandboxes, and headless test suites. [COMPLETED - 100%]
2. **Stage 2**: Implement Viewport Culler and hardware transform engine (`tests/stress_culling.test.js`). [COMPLETED - 100%]
3. **Stage 3**: Implement Bézier curve smoothing, velocity tapering, and Auto-Shape Detection (`tests/shape_detector.test.js`, `tests/strokes.test.js`). [COMPLETED - 100%]
4. **Stage 4**: Implement LaTeX and Markdown parser engine with sandboxed error fallbacks (`tests/latex_markdown.test.js`). [COMPLETED - 100%]
5. **Stage 5**: Implement OneNote-style PDF Printout page layout manager (`tests/pdf_printout.test.js`). [COMPLETED - 100%]
6. **Stage 6**: Implement Touch Gesture Recognizer (Double-tap to undo) and History Stack (`tests/gesture_undo.test.js`). [COMPLETED - 100%]
7. **Stage 7**: Implement Atomic local persistence and Cloudflare R2 S3 sync client (`tests/sync.test.js`). [COMPLETED - 100%]
8. **Stage 8**: Run full automated CLI test suite (including stress & chaos suites) to verify 100% test pass rate. [COMPLETED - 100%]
9. **Stage 9**: Complete Web UI Integration & Universal Note Container (OneNote model) - Wire all core engine modules to `public/app.js` and `public/index.html`. [COMPLETED - 100%]

---

## Progress & Verification Log (September 2026)

### Milestone 1: Core Engine & Resilience Framework
- [x] **`src/core/types.js`**: Universal `NOTE_CONTAINER`, mixed-media item schemas, geometric shapes, gesture types, and schema factories.
- [x] **`src/core/sandbox.js`**: Fail-safe execution boundaries; sanitized math evaluator (`safeMathEval`), non-throwing JSON parser (`parseJSON`), and block error wrapper (`runSafe`).
- [x] **`src/core/document.js`**: Full `DocumentModel` with block & annotation CRUD, metadata timestamp tracking, and safe serialization.
- [x] **`src/core/history.js`**: Transactional `HistoryManager` with `AddBlockCommand`, `RemoveBlockCommand`, `AddStrokeCommand`, and bounded undo/redo stack.
- [x] **`src/core.js`**: Aggregated module facade preserving 100% backward-compatibility with existing code.

### Milestone 2: Viewport, Culling & Vector Ink
- [x] **`src/canvas/viewport.js`**: Hardware GPU coordinate mapper, zoom clamping ($20\%$ to $400\%$), and dynamic frustum bounding box calculator.
- [x] **`src/canvas/culler.js`**: Spatial Axis-Aligned Bounding Box (AABB) culler. Culls 2,000 blocks in $<3\text{ms}$ and 10,000 ink strokes in $<23\text{ms}$.
- [x] **`src/canvas/stroke_renderer.js`**: Cubic Bézier midpoint smoothing, dynamic velocity/pressure tapering, and smooth SVG path data generator.
- [x] **`src/canvas/shape_detector.js`**: "Draw & Hold" ($\ge 400\text{ms}$) recognition for straight lines, circles, rectangles, and arrows, with false-positive rejection for arbitrary handwriting.
- [x] **`src/canvas/gestures.js`**: Touch recognizer for double-tap undo ($\le 300\text{ms}$, $\le 20\text{px}$) and 2-finger pinch-to-zoom.

### Milestone 3: Content Blocks & Persistence
- [x] **`src/blocks/text_block.js`**: Tokenizer and parser for Markdown headings, checklists, inline `$math$`, display `$$math$$`, and graceful fallback alerts.
- [x] **`src/blocks/pdf_block.js`**: Multi-page PDF sequential layout engine with per-page annotation coordinate mapping.
- [x] **`src/blocks/plot_block.js`**: Sandboxed math function evaluator ($y = f(x)$) and pixel-space projector with division-by-zero protection.
- [x] **`src/blocks/table_block.js`**: Dynamic grid table model with row/column insertion and cell updates.
- [x] **`src/blocks/media_block.js`** & **`src/blocks/resize_handle.js`**: Aspect-ratio constrained media blocks and 8-point zoom-compensated drag handles.
- [x] **`src/storage/hierarchy.js`**: Notebook $\rightarrow$ Section $\rightarrow$ Page & Subpage hierarchical tree manager with cascade deletion.
- [x] **`src/storage/local_store.js`**: Atomic filesystem storage (`.tmp` write $\rightarrow$ SHA-256 verify $\rightarrow$ atomic rename) ensuring zero corruption on power drop, plus hash-addressed asset deduplication.
- [x] **`src/storage/r2_sync.js`**: Cloudflare R2 S3 REST client with offline delta queuing and last-write-wins conflict resolution.

### Milestone 4: Frictionless Universal Note Container & Multi-Layout Synchronization
- [x] **Universal Note Container (OneNote Model)**:
  - Replaced fragmented single-purpose boxes (`text`, `media`, `table`) with a single unified container (`NOTE_CONTAINER`).
  - Supports mixed-media within a single box: Markdown text, KaTeX LaTeX formulas (`$inline$` and `$$block$$`), browsed local media/images, PDF printouts, interactive editable tables, and live function plotters ($y = f(x)$).
  - 8-point bounding box resize handles (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`) with active container detection and zoom compensation.
  - Container activation & selection: clicking anywhere inside a note immediately focuses it as `state.activeContainerId` and applies `.selected`.
- [x] **Native Local Storage Browsing & Drag/Paste Ingestion**:
  - `🖼 Media`: Launches native file dialog (`accept="image/*,video/*"`) and inserts selected media directly into the active container (or spawns one at the canvas center).
  - `📑 PDF`: Launches native file dialog (`accept=".pdf"`) and inserts multi-page printout slides into the active container.
  - Drag-and-Drop: Dragging images or PDF documents from Windows File Explorer onto the canvas creates a universal note box at drop coordinates.
  - Clipboard (`Ctrl+V`): Pastes screenshot images directly from clipboard into the active container.
- [x] **Dynamic Tables & Math Function Plotter**:
  - `⊞ Table`: Dynamic tabular grids with `+ Row` and `+ Column` controls and live cell editing.
  - `📈 Plot`: Coordinate axes, curve rendering with singularity protection, and formula input (`y = f(x)`).
  - `$fx Math`: KaTeX-rendered equations with typographical stacked fractions and centered limits.
- [x] **Layout Synchronization**:
  - Unified tools wired consistently across all 3 layouts:
    - **Layout A (Modern OneNote)**: Full ribbon with typography, font family/size, heading styles, and unified insert cluster.
    - **Layout B (Minimalist)**: Floating capsule bar with unified action buttons (`+ Note`, `🖼 Media`, `📑 PDF`, `⊞ Table`, `📈 Plot`, `$fx Math`).
    - **Layout C (Tool Palette)**: Floating tool palette with selection tool and unified insertion buttons.
  - CSS display rules to toggle ribbons, capsules, and palettes seamlessly on layout change.
  - Formatting toolbar protection: `mousedown` `e.preventDefault()` prevents focus loss on contentEditable text during styling operations.

### Headless Test Results (All 33 Tests Passing)
```text
✔ tests/core.test.js (5 tests)
✔ tests/stress_culling.test.js (3 tests)
✔ tests/shape_detector.test.js (5 tests)
✔ tests/strokes.test.js (3 tests)
✔ tests/latex_markdown.test.js (3 tests)
✔ tests/pdf_printout.test.js (5 tests)
✔ tests/gesture_undo.test.js (4 tests)
✔ tests/sync.test.js (5 tests)
Total: 33 passed, 0 failed, 298ms duration
```

