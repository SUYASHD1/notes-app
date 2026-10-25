# 🏗️ Notes App — Code Organization & Maintenance Philosophy

> **Target Audience:** Any developer or assistant maintaining, debugging, or adding features to this app.  
> **Core Principle:** Keep the code predictable, easy to patch, and protected by automated safety tests so that **nothing ever breaks**.

---

## 🌟 1. The Core Architecture Philosophy

Our app is built on **pure web standards (HTML, CSS, JavaScript)** with zero heavy frameworks (no React, Angular, or Vue). This gives us lightning-fast startup speeds and guarantees the app will still run 10 years from now. 

To keep this system clean and maintainable as it grows, we follow **Four Golden Rules**:

```
               [ index.html & styles.css ]
                            │
                      [ app.js ]  (The Conductor: Only wires things together)
                            │
       ┌──────────────┬─────┴────────┬──────────────┐
       ▼              ▼              ▼              ▼
   [ src/ui/ ]  [ src/canvas/ ] [ src/blocks/ ] [ src/storage/ ]
  (Buttons,      (Camera,       (Text, Math,    (Hard Drive,
   Ribbons,       Scrollbars,    Images, PDF,    Local Vault,
   Toolbars)      Boundaries)    Tables, Plots)  One-Click Backup)
```

---

## 📜 2. The Six Golden Rules

### Rule 1: The Pragmatic "Buffer Zone" (Target ~350 Lines, Max 450 Buffer)
- **Primary Target: Aim for ~350 Lines per file.**
- **The Buffer Zone (Option A):** A grace buffer up to **450 lines** is permitted if a component has a single, cohesive responsibility (for example, `sidebar.js` at 398 lines or `indexed_db.js` at 425 lines).
- **Hard Ceiling: 450 Lines Maximum.** Zero files across the codebase may ever exceed 450 lines.
- **Why this rule exists:**
  - When files grow past 450 lines, finding a simple button or color requires searching through thousands of lines.
  - Old and new code start fighting each other, creating duplicate styles and difficult-to-trace bugs.
  - At 200–350 lines, you or an AI assistant can read and understand the entire file in just 2 mouse scrolls.
  - The buffer zone prevents *artificial over-fragmentation* (splitting a single cohesive component into tiny unnatural pieces), while strictly banning oversized multi-responsibility files.
- **The 30-Second Test:** If you cannot find where a visual style, button, or calculation lives within 30 seconds, the file is officially too big and must be split.

### Rule 2: Zero Hardcoded Colors (The Single Source of Truth for Design)
- **Never write raw color codes** (like `#ffffff`, `#f8fafc`, or `#0f172a`) directly inside component styles.
- Every color, background, and border **must point to a CSS theme variable** (e.g. `var(--card-bg)`, `var(--topbar-bg)`, `var(--border-color)`).
- **The Benefit:** Changing an entire palette, adding a new dark mode, or tweaking a button takes 5 seconds because every element draws from one central theme definition.

### Rule 3: The Two-Door House (`src/` and `public/src/`)
Our project has two twin engine folders that work hand-in-hand:
1. `src/`: Used by our **automated test runner** (`node --test`) to test logic in isolation.
2. `public/src/`: Delivered directly to the **web browser and iPad**.

> **Whenever you add or update an engine helper in `src/`, make sure the matching file in `public/src/` is updated as well!** This guarantees our automated tests always reflect the exact code running on your iPad and PC.

### Rule 4: Test Before You Ship (The 76-Test Shield: Logic + Puppeteer Visual)
- We have an automated test suite of **76 tests** in the `tests/` directory.
- Running `node --test tests/*.test.js` takes **~3 seconds** and checks:
  - 75 Unit Tests: Handwriting, bounding boxes, storage, backups, PDF layout, LaTeX math, dark mode, and canvas boundaries.
  - 1 Puppeteer Visual Safety Net (`tests/visual_smoke.test.js`): Headless Microsoft Edge/Chrome test verifying that flyouts stay closed by default, transparent drawing layers don't block clicks, and note boundary resize cursors trigger on hover.
- **Rule:** Before any change is marked as complete, you must run the tests and verify that `76 / 76 tests passed (100%)`.

### Rule 5: Always Bump the Version Number (The Anti-Cache Guarantee)
- Web browsers and Apple's iPad Safari aggressively cache files on disk to save data.
- If you change a `.js` or `.css` file without updating the version query, the user's iPad will keep running the old cached code.
- **Whenever you make a visual or logic update:**
  1. Bump the query in `public/index.html` (e.g. `styles.css?v=4.7.6` and `app.js?v=4.7.6`).
  2. Bump `CACHE_NAME` in `public/sw.js` (e.g. `notes-app-cache-v4.7.6`).
  3. Update `PRECACHE_ASSETS` in `public/sw.js` with the new version string.
  This forces the browser to discard outdated files and download the fresh update immediately.

### Rule 6: The "Permanent Shell" Architecture (`public/index.html`)
- **`index.html` holds strictly the permanent layout frame:**
  - Top Master App Bar (always visible)
  - Navigation Sidebar (always visible)
  - 2D Canvas Workspace & Scrollbars (always visible)
  - Ribbon Formatting Bar (always visible)
  - Bottom Status Bar (always visible)
- **Target Size:** `index.html` must remain under **~350 lines** permanently.
- **The Scalability Law for Popups & Dialogs:**
  - Never paste 100–200 lines of modal markup directly into `index.html`.
  - Every popup dialog, flyout card, or floating tool (like the Storage Hub, future Audio Recorder, PDF Export, or Page Recovery) must live in its own self-contained component module (e.g., `src/ui/storage_settings_template.js`) and mount itself dynamically on startup or on demand.
  - **The Long-Term Benefit:** As the app grows from 5 features to 50 features, `index.html` stays permanently lightweight (~300 lines) with zero dead or ghost code.

---

## 📁 3. Directory Anatomy: Where Does My Code Go?

| Folder | What Belongs Here | Real Examples in Our Codebase |
| :--- | :--- | :--- |
| `src/core/` | Fundamental data models, types, commands, and undo/redo history. | `document.js`, `history.js`, `types.js`, `sandbox.js` |
| `src/canvas/` | Math, infinite viewport camera, spatial scrollbars, boundaries, gestures, and handwriting smoothing. | `viewport.js`, `viewport_bounds.js`, `scrollbar_controller.js`, `gestures.js`, `stroke_renderer.js` |
| `src/blocks/` | Specific note content types and their interactive behaviours. | `text_block.js`, `pdf_block.js`, `media_block.js`, `table_block.js`, `plot_block.js` |
| `src/storage/` | Data persistence, local device vaults, hard drive mirroring, and cloud sync. | `indexed_db.js`, `file_system_access.js`, `r2_sync.js`, `hierarchy.js` |
| `src/ui/` | Visual controls, navigation bars, theme controller, popovers, and settings menus. | `theme_controller.js`, `ribbon_controller.js`, `sidebar.js`, `layout_puck.js`, `ink_palette.js` |
| `public/` | The live website root served to the browser. | `index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js` |
| `tests/` | Automated unit tests covering all math, storage, themes, and logic. | `core.test.js`, `theme.test.js`, `viewport_bounds.test.js` |

---

## 🛠️ 4. The 4-Step Recipe for Fixing Bugs & Adding Features

When a user reports a bug or requests a new feature, follow this exact recipe:

### Step 1: Identify the Layer
- **Visual styling bug?** Check `public/styles.css` (or modular stylesheets).
- **Navigation or camera jumping?** Check `src/canvas/viewport_bounds.js` or `src/canvas/gestures.js`.
- **Note creation or content formatting?** Check `src/blocks/`.
- **Theme or color issue?** Check `src/ui/theme_controller.js`.
- **Saving or file loss issue?** Check `src/storage/indexed_db.js`.

### Step 2: Keep Styles Scoped & Respect the 350-Line Limit
- Never write global `!important` rules on broad classes.
- Scope rules strictly by container and mode (e.g. `body[data-theme="dark"] #ribbon-bar`).
- If a file is approaching 350 lines, split off helpers before adding more code.

### Step 3: Verify the 74 Tests
- Run `node --test tests/*.test.js` in your terminal.
- If you introduced new logic (e.g. a new shape, theme, or boundary rule), add a small test in `tests/` to lock that behavior in forever.

### Step 4: Version Bump & Production Push
- Bump the version in `public/index.html` and `public/sw.js`.
- Commit with a clear, descriptive message (e.g. `git commit -m "fix: smooth out iPad palm rejection near ribbon"`).
- Push to GitHub `main` for instant deployment.

---

---

## 🛡️ 5. Reorganization Guardrails & Lessons Learned (Zero-Breakage Shield)

During our codebase modularization, we identified crucial lessons to guarantee that splitting large files never inadvertently breaks the application:

### Lesson 1: The "Zero-Dropped-Rules" Verification
- When splitting a massive file into smaller files, **never rely on manual copy-pasting alone**.
- Always run an automated comparison script (`scratch/find_missing.cjs`) comparing the original file against the new split files to guarantee that **zero rules, selectors, or exports are left behind**.

### Lesson 2: The Master Visibility Trap (`.hidden`)
- A single missing utility rule like `.hidden { display: none !important; }` can trigger a cascade of visual bugs:
  - Hidden flyouts (like the Zoom menu) stay permanently popped open.
  - Transparent drawing canvases (`#active-draw-canvas`) remain active on top of the workspace with a high `z-index`, blocking user mouse events from reaching notes and buttons underneath.
- **Rule:** Foundational utilities (`.hidden`, `.btn-ghost`, etc.) must live in the primary `theme.css` so they are available universally before any component renders.

### Lesson 3: CSS Containment vs. Protruding Handles
- `contain: paint` strictly clips any visual element that extends outside its parent's bounding box.
- Because our boundary resize handles protrude 6px to 8px outside the note box to catch user mouse hovers, setting `contain: paint` shaves off the handles and prevents cursor change.
- **Rule:** Use `contain: layout;` instead of `contain: layout paint;` for note containers so boundary handles and selection markers are never clipped.

### Lesson 4: Mandatory Browser Visual Verification
- Automated unit tests (`node --test`) test data logic and calculations in isolation, but cannot verify mouse hover states, cursor changes, or visual layering.
- **Rule:** After every reorganization step, run a visual browser inspection check (checking flyouts, edge hover cursors, and button states) before committing and pushing.

---

## 🗺️ 6. Reorganization Phases & Roadmap

We are systematically restructuring all files that exceed the **350-line limit**:

### ✅ Phase 1: CSS Modularization (COMPLETED — v4.7.2)
- Modularized the monolithic 4,348-line stylesheet into **18 scoped, single-responsibility files** in `public/css/`:
  - `theme.css` (275 lines) — Design tokens, master variables, `.hidden` utility.
  - `topbar.css` (316 lines) — Master navigation bar, notebook selector.
  - `ribbon.css` (291 lines) — Home and Insert tab formatting ribbons.
  - `ink_tools.css` (189 lines) — Pen, highlighter, and eraser tools.
  - `sidebar.css` (230 lines) — 2-tier section and page hierarchy navigation.
  - `explorer_tree.css` (273 lines) — Storage hub folder manager and page tree.
  - `canvas.css` (231 lines) — Infinite spatial canvas and scrollbar tracks.
  - `status_bar.css` (159 lines) — Bottom bar, zoom flyout menu, and view shortcuts.
  - `notes.css` (254 lines) — Universal note containers and card headers.
  - `notes_typography.css` (168 lines) — Rich headings, lists, quotes, and links.
  - `resize_handles.css` (334 lines) — 8-point and full-boundary resize zones.
  - `math_blocks.css` (177 lines) — LaTeX math blocks, tables, and function plots.
  - `media_pdf.css` (303 lines) — Multi-page PDF printouts and media cards.
  - `media_crop.css` (103 lines) — Image cropping modal and handles.
  - `storage_hub.css` (276 lines) — Storage vault settings flyout and metrics.
  - `storage_hub_dark.css` (120 lines) — Dark mode overrides for storage settings.
  - `storage_cloud.css` (174 lines) — Cloudflare R2 sync drawer and iOS install guide.
  - `layout_modes.css` (193 lines) — Layout B (Notion), Layout C (Excalidraw), and iPad touch adaptations.
- Master `public/styles.css` reduced to 24 lines of clean `@import` statements.
- **Status:** 100% compliant with the 350-line ceiling (0 files over 350 lines).

### ✅ Phase 2: Text Block Modularization (COMPLETED — v4.7.1)
- Modularized `src/blocks/text_block.js` (originally 720 lines) into 4 focused sub-engines:
  - `src/blocks/text_block.js` (97 lines) — Clean facade coordinating the block.
  - `src/blocks/latex_parser.js` (331 lines) — Pure LaTeX delimiter parsing and KaTeX rendering.
  - `src/blocks/html_sanitizer.js` (161 lines) — MS Word and web paste sanitization.
  - `src/blocks/html_to_markdown.js` (182 lines) — DOM-to-markdown conversion and image link extraction.
- Fully mirrored in `public/src/blocks/` (Two-Door House pattern).
- **Status:** 100% compliant with the 350-line ceiling.

### ✅ Phase 3: Master Orchestrator `public/app.js` Modularization (COMPLETED — v4.7.4)
- Modularized the monolithic 4,028-line `public/app.js` down to **699 lines** (a **3,329-line / 82.6% reduction**):
  - **✅ Phase 3D:** Starter notes and blank page generation in `src/core/sample_notebook.js` (92 lines).
  - **✅ Phase 3C:** Topbar, Ribbon & Keyboard dispatchers in `src/ui/container_actions.js` (110 lines), `src/ui/ribbon_actions.js` (316 lines), and `src/ui/keyboard_shortcuts.js` (201 lines).
  - **✅ Phase 3B:** Viewport & Inking interactions in `src/canvas/kinetic_pan.js` (176 lines), `src/canvas/viewport_interaction.js` (303 lines), `src/canvas/stroke_creator.js` (94 lines), and `src/canvas/inking_interaction.js` (323 lines).
  - **✅ Phase 3A:** Note container blocks rendering in 8 focused sub-engines:
    - `src/blocks/block_drag_resize.js` (198 lines)
    - `src/blocks/math_table_renderer.js` (166 lines)
    - `src/blocks/pdf_renderer.js` (186 lines)
    - `src/blocks/image_cropper.js` (208 lines)
    - `src/blocks/media_renderer.js` (286 lines)
    - `src/blocks/text_renderer.js` (323 lines)
    - `src/blocks/sketch_renderer.js` (319 lines)
    - `src/blocks/container_renderer.js` (295 lines)
- Fully mirrored across `src/` and `public/src/` (Two-Door House pattern).
- All 16 newly created files strictly adhere to the ≤ 350-line ceiling.
- All 76 tests passing (100%).

### ✅ Phase 5: Final Polish & Buffer Zone Alignment (COMPLETED — v4.7.5)
- Applied the **Option A Buffer Zone** (≤ 450 lines maximum buffer, majority ≤ 350 lines):
  - **`src/ui/storage_settings_modal.js`:** Shrunk from 590 lines down to **246 lines** by extracting the folder tree explorer to `src/ui/explorer_tree.js` (371 lines).
  - **`src/storage/indexed_db.js`:** Shrunk from 591 lines down to **425 lines** by extracting:
    - `src/storage/vault_backup.js` (62 lines) — JSON full backup export and restoration.
    - `src/storage/vault_folder_sync.js` (56 lines) — Hard drive folder file migration.
    - `src/storage/vault_metrics.js` (84 lines) — Live device storage calculation & persistent safe-lock.
  - **`public/app.js`:** Shrunk from 700 lines down to **416 lines** (from original 4,028 lines, total reduction of **89.7%**) by extracting:
    - `src/canvas/viewport_camera.js` (115 lines) — Smooth glide camera, boundary clamping & fit-all-content.
    - `src/storage/page_storage.js` (140 lines) — Active page loading, idle disk saving & debounced autosave.
  - **`src/ui/sidebar.js`:** Maintained intact at 398 lines as an approved single-responsibility navigation module safely within the grace buffer.
- **Two-Door House Parity:** All new modules mirrored 100% character-for-character between `src/` and `public/src/` (56 total files verified).
- **Zero Violations:** Zero files exceed 450 lines in the entire project.
### ✅ Phase 6: HTML Modularization & Permanent Shell Architecture (COMPLETED — v4.7.6)
- **`public/index.html`:** Reduced from 560 lines down to **337 lines** (comfortably under the 350-line ceiling).
  - Adopted the **"Permanent Shell"** architectural standard: `index.html` holds strictly the permanent layout (Top Bar, Ribbon, Canvas, Sidebar).
  - Extracted the 224-line Storage & Data Hub settings flyout into a self-contained component template in `src/ui/storage_settings_template.js` (224 lines) and mirrored in `public/src/ui/storage_settings_template.js`.
  - Popups and modal dialogs are dynamically mounted upon startup by their feature modules, establishing a scalable pattern for all future features (Audio note recorder, export dialogs, tag managers).
- **Two-Door House Parity:** 57 of 57 files matched character-for-character with 0 mismatches.
- **Verification:** All 76 automated tests passing at 100%.

---

## 🎯 Summary Checklist Before Every Release
- [x] No file exceeds the **450-line maximum buffer** (target ≤ 350 lines).
- [x] Code is modularized into its own file in `src/` and mirrored in `public/src/`.
- [x] Zero hardcoded colors in styles — all colors point to CSS theme variables.
- [x] Two-Door House parity verification script passes with 0 mismatches.
- [x] All 77 automated tests pass (`node --test tests/*.test.js`).
- [x] Visual browser verification performed (no stuck menus, boundary cursors active).
- [x] Version number bumped in `index.html` and `sw.js` (v4.8.1).
- [x] Changes logged clearly into `CURRENT_STATE.md`.


