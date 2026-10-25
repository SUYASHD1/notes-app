# 📓 Notes App — Current State & Knowledge Log

> **Last Updated:** 25 October 2026 (v4.7.6)  
> **Status:** Fully Functional, PWA Standalone Enabled, Deployed to Production (Vercel)  
> **Live Web Application:** [https://notes-app-topaz-six.vercel.app/](https://notes-app-topaz-six.vercel.app/)  
> **Automated Test Suite:** `76 / 76 tests passed (100%)`

---

## 🌟 1. Project Overview & Vision
This application is a freeform, ultra-fast note-taking system designed to combine the spatial freedom of **Microsoft OneNote** with the fluid, paper-like handwriting experience of **Notability** on iPad and Desktop.

* **Desktop Experience:** Rich text typing, MS Word-style ribbon formatting, mouse/keyboard navigation, equation insertion, PDF annotations, multi-block management, hard drive folder mirroring, and one-click backups.
* **iPad Experience:** Zero-latency Apple Pencil inking, pressure-sensitive strokes, true palm rejection, smooth floating-toggle mode switching, and full touch-gesture navigation.
* **Storage Independence:** Your notes belong to you. Data is stored on your device, with live storage breakdown, browser safe-lock, hard drive folder mirroring, and one-click file backups.

---

## 🔍 2. Breakthroughs, Bug Fixes & Lessons Learned

### 1. The 300ms Safari Delay & Rapid Writing Fix
* **The Symptom:** In cursive writing (e.g. *"hii"*), lifting the Apple Pencil to place a dot on the *"i"* or cross a *"t"* would often fail unless the user paused briefly.
* **The Root Cause:** Mobile Safari pauses for ~300ms on touch lift to ask: *"Is the user about to double-tap to zoom?"*
* **The Solution:** Added non-passive `touchstart`, `touchmove`, and `touchend` handlers with `e.preventDefault()` on the drawing canvas, and locked viewport zoom. Immediate single-tap dots now register the millisecond the stylus touches down.

### 2. Ghost Clicks on Stylus Lift
* **The Problem:** Safari synthesizes fake mouse click events when a stylus lifts off the screen.
* **The Solution:** Canceled mouse-emulation in `pointerup` handlers, eliminating phantom marks and unwanted focus jumps.

### 3. Vercel Static Hosting & Client-Side Architecture
* **The Problem:** Deploying to Vercel initially failed because a server file named `server.js` caused Vercel to look for serverless Node.js backend endpoints rather than serving the static web app cleanly.
* **The Solution:**
  1. Renamed local dev runner to `dev-server.js` and dedicated the `public/` directory as the clean website root.
  2. Maintained relative client paths (`./styles.css`, `./app.js`, `./src/core.js`) so the application loads instantly anywhere.
  3. Enabled automated deployment through GitHub repository `SUYASHD1/notes-app`, successfully running at `https://notes-app-topaz-six.vercel.app/`.

### 4. Preventing Browser History Cleanup from Deleting Notes
* **The Concern:** If a user clears their browser history or cookies, could all their notes be lost?
* **The Solution — Multi-Layered Protection:**
  1. **Storage Safe-Lock (`navigator.storage.persist()`):** We request persistent storage from the browser. Once granted, the browser will never automatically delete the app's database, even during disk cleanup routines.
  2. **Direct Hard Drive Folder Mirroring:** Users on desktop can choose any folder on their computer's hard drive. All notes are saved directly to that folder in standard, human-readable files.
  3. **Automatic Safe Migration:** When choosing a folder, the app automatically copies all existing notebooks, sections, and pages into the new folder first so not a single character or stroke is ever lost.
  4. **One-Click Backup (.notes):** Users can download their complete notebook collection into a portable `.notes` file with a single click anytime.

### 5. Native App Settings Experience (Storage & Data Hub)
* **The Learning:** Replacing a raw browser popup with an integrated, frosted-glass settings flyout makes the website feel like a true native desktop application.
* **What We Built:**
  * Replaced the top-bar cloud icon with a clean storage drive icon.
  * Clicking it opens the **Storage & Data Hub flyout card** anchored gracefully from the top-right.
  * Shows live counts of Notebooks, Sections, Pages, Handwritten Strokes, Images/PDFs, and total size (e.g. `8.2 KB Used`).
  * Provides one-click buttons for Hard Drive Folder Selection, Safe-Lock, Full Backup Download, and Backup Restoration.

### 6. Zero-Distraction Fullscreen: Progressive Web App (PWA) & Airplane Mode
* **The Problem:** Writing in a web browser means dealing with URL bars, browser tabs, and navigation buttons that waste precious screen space and distract from note-taking. Furthermore, if you take an iPad onto a flight with no Wi-Fi, typical web apps fail to load.
* **The Solution:**
  1. **Web App Manifest (`public/manifest.json`):** Sets the display to `standalone`, removing browser chrome completely.
  2. **Offline-First Service Worker (`public/sw.js`):** Automatically pre-caches the app shell, styles, scripts, KaTeX math engine, PDF viewer, and icons. Notes open and run smoothly in 100% Airplane Mode.
  3. **High-Resolution App Icons:** Created 180x180 (iPad Retina Home Screen), 192x192, and 512x512 icons for desktop and mobile docks.
  4. **Smart Installation Flow (`install_prompt.js`):** On Windows/Mac/Android, an install button triggers native installation to the taskbar/desktop. On iPadOS Safari, an interactive visual guide shows the user exactly how to tap "Share ➔ Add to Home Screen".

### 7. iPad Safe Areas, Pure Ink Lock & Interface Decluttering
* **The Problem:** In iPad standalone mode, Apple's clock/battery bar sat over top buttons making them unclickable, and the home swipe-line cut off the bottom bar. Also, resting a palm on the glass could accidentally trigger "Fit All" and cause notes to jump.
* **The Solution:**
  1. **iPad Safe Area Insets:** Added automatic top/bottom cushions (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`) and dynamic screen height (`100dvh`). The top bar extends cleanly behind the clock while buttons sit in the clear touch zone.
  2. **Pure Ink Mode Lock:** In ✏️ Ink Mode, navigation is 100% disabled. The canvas is stationary and bottom bar buttons are touch-immune. Palms and wrists can rest anywhere without causing accidental view jumps.
  3. **Sleek Zoom Popover:** Replaced four exposed buttons with a single compact `100%` pill that only opens controls when deliberately tapped.
  4. **Decluttered Top Bar:** Responsive icon-only mode toggle and subtle green status dot on mobile and tablets.

### 8. Clean Blank Page Guarantee, Notebook Management & File Explorer
* **The Problem:** Every time a new section or page was created, it loaded with sample "Physics and Calculus 101" notes instead of a clean, blank sheet. Also, there was no way to delete or add notebooks, or reorganize pages like a real folder manager.
* **The Solution:**
  1. **Clean Blank Canvas Guarantee:** Separated sample demo notes from newly created pages. Empty and newly created pages now load as 100% fresh, blank canvases.
  2. **Notebook Management:** Added `+` (Create Notebook), `✏️` (Rename Notebook), and `🗑️` (Delete Notebook) directly into the notebook header selector with safety confirmation dialogs.
  3. **Quick Inline Renaming:** Double-clicking any section or page in the sidebar opens an instant renaming prompt.
  4. **True File Manager Tree in Storage Hub:** Inside the Storage & Data Hub settings flyout, an interactive folder explorer allows users to browse notebooks, sections, and pages, drag and drop pages between sections/notebooks, duplicate pages with a single click, and rename or delete any item.

### 9. Rich Formatting & Embedded Image Paste + Stationary Pinch-Zoom
* **The Problem:** Pasting rich web/document content (headings, bold, lists, and images) initially showed images, but clicking on the canvas caused all formatting and images to vanish, leaving only plain text. Large images also broke outside note boundaries. Additionally, pinching to zoom in/out scrolled/drifted the canvas simultaneously.
* **The Solution:**
  1. **Rich Paste & Image Preservation:** Added an HTML-to-Markdown parser and DOM serializer that captures rich formatting (`# Headings`, `**Bold**`, `- Lists`, and `![Images](src)`) so nothing is stripped on blur/click away.
  2. **Smart Boundary Fitting:** Styled all embedded images with `max-width: 100%`, `height: auto`, and rounded borders so they never burst outside note containers.
  3. **Decoupled Pinch-Zooming:** During pinch-to-zoom gestures, pan-drift vectors are suppressed. Zooming remains perfectly stationary centered right beneath the user's fingertips.
  4. **Multi-Touch Window Scroll Prevention:** Prevented browser background scrolling during multi-finger gestures on the canvas.

### 10. Permanent Offline Image Vaulting, Text Wrapping, Pop-Out & Docking
* **The Goal:**
  1. Automatically download and cache pasted external web images into the local device vault (`LocalVault`) so images never break offline or if external websites go down.
  2. Adapt pasted rich text (headings, bold, lists, quotes) so it matches the app's clean typography and color system without messy website background colors or strange fonts.
  3. Interactive embedded image controls with 3 text wrapping modes: **Wrap Left** (`float: left`), **Wrap Right** (`float: right`), and **Block Center** (`clear: both`).
  4. Interactive freeform resizing of embedded images inside notes.
  5. **Pop Out / Detach to Canvas (🪟):** Detach an embedded image from a note box into an independent floating canvas card.
  6. **Dock In (📥):** Drag a canvas image card and drop it onto any note container (or click the Dock button) to embed it back into the note.
* **The Solution:**
  1. **Permanent Offline Image Vaulting:** Added `vaultExternalImage(src)` and `vaultImagesInTextItem()` which asynchronously download external web images, store them inside IndexedDB (`state.vault.storeAsset()`), and replace external URLs with permanent local data URLs.
  2. **Harmonious Formatting Adaptation:** In `MarkdownLatexParser.htmlToMarkdown()`, inline styles (such as website background colors, inline fonts, and fixed widths) are stripped away, cleanly mapping semantic HTML into standard markdown that inherits the app's native dark/light design system.
  3. **Embedded Image Floating Toolbar & Wrapping:** Clicking any image inside a note selects it and displays a sleek glassmorphic mini-toolbar: `⬅️ Left`, `⏸️ Center`, `➡️ Right`, `🪟 Pop Out`, and `🗑️ Delete`.
  4. **Corner Drag Handle for Resizing:** Embedded images feature an interactive bottom-right drag handle for smooth resizing.
  5. **Pop Out to Canvas:** Clicking `🪟 Pop Out` removes the image from the note and creates an independent canvas note card right next to the original note.
  6. **Docking (Drag & Drop + Button):** Canvas image cards have an `📥 Dock` toolbar button and can also be dragged and dropped onto any note container to embed them back in.

### 11. OneNote-Grade 60–120 FPS Architecture, 0ms Typing Latency & Instant Shortcuts
* **The Problem:** In long notes (thousands of words or multiple photos), typing a letter caused stuttering because the app was recursively reading and re-translating the entire document on every keystroke. High-frequency mouse wheel/trackpad scrolling also triggered layout recalculations and disk saves hundreds of times per second.
* **The Solution:**
  1. **Zero-Overhead Typing:** Keystrokes update the screen immediately without full-document tree scans. Data synchronization is deferred until natural pauses in typing or when clicking away.
  2. **Smart Notion-Style Formatting Shortcuts:** Typing `#` + Space, `##` + Space, `-` + Space, or `1.` + Space instantly transforms the line into a heading or list without background translation penalties.
  3. **Display-Synced 60–120 FPS Wheel Loop:** Fast trackpad pinch and wheel events accumulate into a smooth buffer and update the screen precisely once per display refresh cycle (`requestAnimationFrame`). Synchronous disk saves during scroll streams are eliminated.
  4. **CSS Paint Containment & GPU Layering:** Added `contain: layout paint` and GPU composite layering (`translate3d`) to `.universal-note-container`, ensuring changes in one note never trigger reflows in other notes on the canvas.
  5. **Idle-Time Storage:** Disk writes are scheduled during natural idle moments (`requestIdleCallback`), preventing the browser interface from pausing.
  6. **Edge + Puppeteer Stress Test:** Verified typing latency down to ~3ms/char and 0 errors during rapid wheel scrolling in Microsoft Edge.

### 12. Clean Web/Wikipedia Article Paste, Link Rendering & Distinct Multi-Image Vaulting
* **The Problem:** Pasting articles from Wikipedia resulted in stray brackets `[` and `](url)` around pictures because Wikipedia wraps photos in links to file pages. Footnote citation numbers like `[287]` cluttered the text, hyperlinks appeared as raw bracketed markdown, and multiple images in a pasted article were mistakenly replaced with copies of the first image.
* **The Solution:**
  1. **Clean Image Link Unwrapping:** When an image is wrapped in a link tag, the parser extracts just the picture cleanly without trailing brackets or markdown URL clutter.
  2. **Citation Footnote Stripping:** Automatically removes Wikipedia-style reference footnote markers (e.g. `[287]`, `[citation needed]`, `#cite_note`), keeping the article text clean and readable.
  3. **Visual Link Rendering:** Markdown links are converted directly into clean, clickable styled blue links (`.note-link`) instead of showing raw brackets and URLs on screen.
  4. **1-to-1 Image URL Vaulting:** Replaced token-scanning in `vaultImagesInTextItem` with an exact URL-to-data-URL map. Every pasted image retains its own unique graphic.

### 13. MS Word-Style Formatting Ribbon (Home vs. Insert Tabs)
* **The Problem:** The top toolbar had become cluttered with text formatting and note creation buttons sitting side-by-side. On smaller displays, buttons overflowed off screen or crossed borders.
* **The Solution:**
  1. **Dual-Tab Ribbon (`#ribbon-bar`):**
     * **Home Tab:** Houses all text formatting, typography controls, font family/size selectors, style buttons (B, I, U, S, color, highlight), and paragraph alignment/list tools.
     * **Insert Tab:** Houses note and content generation tools: `+ New Note`, `🖼 Media`, `📑 PDF`, `✍ Sketch`, `⊞ Table`, `📈 Plot`, and `$fx Math`.
  2. **Automatic Context Switching:** Clicking or typing inside any note text box automatically switches the ribbon to the **Home** tab so typography tools are immediately at hand.
  3. **Attribute-Driven Tab Display:** Powered by `data-tab="home"` and `data-tab="insert"` attributes on `#ribbon-bar` with strict CSS rules, ensuring clean tab switching with zero layout collision.

### 14. Infinite Canvas Boundaries & Spatial Containment
* **The Problem:** In an unrestricted infinite canvas, arranging notes was difficult because content could wander endlessly to the left or top into negative coordinate voids.
* **The Solution:**
  1. **Fixed Left Margin ($x = 40\text{px}$):** The viewport is bounded so you cannot pan into the negative space to the left of your notes.
  2. **Dynamic Right Boundary:** Provides a comfortable multi-column initial width ($2600\text{px} + 800\text{px}$ padding) that automatically expands when new notes are added towards the right.
  3. **Endless Downward Scrolling:** Downward navigation is 100% infinite and unrestricted, behaving like a continuous physical notebook.

### 15. Interactive & Draggable Spatial Scrollbars
* **The Problem:** Users on a vast canvas had no sense of where they were located, and previous scrollbar implementations lacked physical handle thickness, making them invisible and unclickable.
* **The Solution:**
  1. **High-Contrast Visible Handles:** Added solid slate handles (`.canvas-scroll-thumb`) with rounded corners, proper cross-axis dimensions ($12\text{px}$ track height/width, $36\text{px}$ minimum thumb size), and grab/grabbing cursors.
  2. **120fps Real-Time Dragging:** Dragging either handle moves the canvas smoothly with pointer capture and zero jitter. An `isDraggingScrollbar` guard prevents internal recalculations from fighting the user's drag gesture.
  3. **Click-to-Jump Track Navigation:** Clicking anywhere along the empty track immediately centers the thumb and canvas view at that exact position.
  4. **Mouse Wheel & Window Resize Synchronization:** Handles smoothly track mouse wheel scrolling and adjust their dimensions dynamically when the window is resized.
  5. **Ink Mode Security Lock:** In Pen/Stylus mode, scrollbars are dimmed and completely disabled (`pointer-events: none`) so resting palms never trigger accidental movement.

### 16. Edge Auto-Scrolling
* **The Solution:** Moving the pointer near the outer edges ($60\text{px}$ margin) of the viewport while selecting text or dragging elements smoothly glides the canvas in that direction, making navigation effortless across large multi-block pages.

### 17. Executive Dark Mode (#282828 Palette) & Inking Contrast Adaptation
* **The Goal:** A dark mode designed for hours of fatigue-free writing, centered on a warm charcoal base (`#282828`) instead of glaring, high-strain pure black (`#000000`).
* **The Solution:**
  1. **Harmonious Palette System:**
     - **Canvas Paper:** Deep warm charcoal `#282828` with subtle micro-dot alignment grid (`rgba(255, 255, 255, 0.08)`).
     - **Top Ribbon & Sidebar:** Elevated deep slate `#1e1e1e` and `#222222` with clean `#3f3f3f` borders.
     - **Floating Note Cards:** Gentle elevated `#323232` with high-contrast text (`#ededed` / `#d1d5db`), dark headers (`#3a3a3a`), and blue formula containers.
  2. **Smart Inking Adaptation:**
     - When dark mode is active, the primary pen swatch automatically switches from black (`#0f172a`) to soft cream white (`#f5f5f5`) so handwritten notes stand out with zero manual color tweaking.
     - Highlighters and colored pens remain luminous and vibrant over dark notes.
  3. **Modular Theme Controller:** Implemented in `src/ui/theme_controller.js` (and mirrored in `public/src/ui/theme_controller.js`). Supports instant toggling via the `🌙` / `☀️` button in the top bar, persists the user's choice to the device vault settings store, and updates system `theme-color` meta tags.
  4. **Automated Verification:** Verified across all 74 unit tests and profiled directly in Microsoft Edge using Puppeteer with 0 console errors.

### 18. Codebase Organization & 350-Line Limit (Phase 1 & Phase 2)
* **The Goal:** Prevent cognitive overload, speed up searches, and eliminate regressions caused by giant monolithic files by enforcing a hard ceiling of ≤ 350 lines per file (as documented in `CodeORG.md`).
* **The Solution:**
  1. **Phase 1 (Styles Modularization):** Split the monolithic 4,348-line `public/styles.css` into 18 clean, single-responsibility files in `public/css/` (each ≤ 334 lines) and reduced `public/styles.css` to 24 lines of clean `@import` rules.
  2. **Phase 2 (Text Block Modularization):** Split `src/blocks/text_block.js` (720 lines) into 4 focused engines (`text_block.js`, `latex_parser.js`, `html_sanitizer.js`, `html_to_markdown.js`), all ≤ 331 lines, mirrored in `public/src/blocks/` (Two-Door House).

### 19. Full-Boundary Resize & Master Visibility Regression Resolution (v4.7.2)
* **The Problem:** Following stylesheet modularization, the Zoom flyout became permanently popped out, and mouse hovering over note boundaries failed to show resize arrows (`↔`, `↕`, `⤡`).
* **The Root Causes:**
  1. Omission of `.hidden { display: none !important; }` in the CSS split: left `#zoom-flyout` open, and left the full-screen transparent ink canvas (`#active-draw-canvas`) active with `z-index: 60`, which acted like a pane of glass intercepting mouse hover events before they could reach note boundaries.
  2. `contain: layout paint;` on `.universal-note-container`: CSS paint containment clipped the 6px-8px negative protrusion of the interactive resize handle zones.
* **The Solution:**
  1. Restored `.hidden { display: none !important; }` globally in `theme.css` and `.zoom-flyout.hidden` in `status_bar.css`.
  2. Replaced `contain: layout paint;` with `contain: layout;` on `.universal-note-container` so boundary hit zones are fully active.
  3. Added full boundary hover rules for `.handle-e`, `.handle-w`, `.handle-n`, `.handle-s`, and corners in `resize_handles.css`.
  4. Created `layout_modes.css`, `notes_typography.css`, `media_crop.css`, and `storage_hub_dark.css` to hold all remaining styles while guaranteeing 100% of files stay ≤ 334 lines.
  5. Verified live in Microsoft Edge: Zoom flyout is hidden by default and opens/closes on click; moving mouse near any note boundary immediately displays the resize cursor.

### 20. Master Orchestrator Modularization (Phase 3 Completed — v4.7.4)
* **The Goal:** Modularize the monolithic 4,028-line `public/app.js` into focused, single-responsibility engines, strictly enforcing the ≤ 350 lines limit per file and the Two-Door House pattern (`src/` and `public/src/`).
* **What We Completed in this Release:**
  1. **Phase 3D (Sample Notebook & Blank Canvas Engine):** Extracted starter physics notes, sample math plots, tables, and blank page generators into `src/core/sample_notebook.js` (92 lines), mirrored in `public/src/core/`.
  2. **Phase 3C (Topbar, Ribbon & Keyboard Action Dispatchers):** Extracted container actions into `src/ui/container_actions.js` (110 lines), format tools into `src/ui/ribbon_actions.js` (316 lines), and hotkeys into `src/ui/keyboard_shortcuts.js` (201 lines).
  3. **Phase 3B (Canvas Viewport & Touch/Inking Interactions):** Extracted kinetic momentum into `src/canvas/kinetic_pan.js` (176 lines), viewport events into `src/canvas/viewport_interaction.js` (303 lines), stroke creators into `src/canvas/stroke_creator.js` (94 lines), and ink gesture bridges into `src/canvas/inking_interaction.js` (323 lines).
  4. **Phase 3A (Note Container Block Rendering & Docking Engine):** Extracted all note block renderers into 8 focused engines (each strictly ≤ 323 lines):
     - `src/blocks/block_drag_resize.js` (198 lines) — Dragging and 8-point boundary resize handles.
     - `src/blocks/math_table_renderer.js` (166 lines) — Interactive tables and 2D math function plots.
     - `src/blocks/pdf_renderer.js` (186 lines) — High-DPI multi-page PDF documents.
     - `src/blocks/image_cropper.js` (208 lines) — Interactive image cropping modal.
     - `src/blocks/media_renderer.js` (286 lines) — Mixed media, image docking, and IndexedDB offline caching.
     - `src/blocks/text_renderer.js` (323 lines) — Rich text, WYSIWYG formatting, and paste sanitization.
     - `src/blocks/sketch_renderer.js` (319 lines) — In-note handwriting canvas and shape recognition.
     - `src/blocks/container_renderer.js` (295 lines) — Master note container frames and child dispatch.
  5. **Massive Orchestrator Reduction:** `public/app.js` reduced from **4,028 lines down to 699 lines** (a total reduction of **3,329 lines / 82.6%**).
  6. **Automated Test Shield:** 100% of all automated tests passing (**76 / 76 tests**), including unit tests and the live Puppeteer visual browser test.

### 21. Prototype & Redundant Assets Archive (Phase 4 Completed — v4.7.4)
* **The Goal:** Remove old experimental files that cause search friction and confusion during development, keeping only production files in the main workspace.
* **The Solution:**
  1. Ran dependency safety scan to guarantee no production files in `public/` or `src/` import or depend on `prototype/`.
  2. Safely compressed `prototype/` into `archive/prototype_legacy.zip` (83.7 KB) so early development experiments remain preserved in storage.
  3. Cleaned up the loose `prototype/` folder from the root workspace.
  4. Verified all 76 automated tests pass with 100% success.

---

## 🚀 3. Features & Capabilities

### ✍️ A. Fluid Drawing & Annotation Engine
* **Instruments:**
  * **Ballpoint Pen:** Natural pressure-modulated width and midpoint smoothing.
  * **Highlighter:** Semi-transparent multiply blending that highlights underneath text.
  * **Smart Eraser:** Full-stroke eraser and precision segment slice eraser.
* **240Hz Coalesced Sampling:** Captures all intermediate points from Apple Pencil hardware.
* **Shape Snapping:** Draw a line, circle, rectangle, or triangle and pause 400ms to snap into a geometric shape.
* **Instant Single Dots:** Guaranteed capture for punctuation, decimal points, and dots on *"i"*.

### 🧭 B. Navigation & Workspace
* **Dual-Mode Workflow:** Quick-switch between **Navigate / Desktop Mode** and **✏️ Ink Mode** with the floating puck.
* **Spatial Scrollbars:** Draggable horizontal and vertical track-bars indicating canvas position.
* **Boundary Clamping:** Anchored left margin ($x \ge 40$) with endless downward canvas extension.
* **Smooth Panning & Zooming:** Mouse wheel zoom, touchpad pinch, and Shift+1 zoom-to-fit.
* **Executive Dark Mode:** One-click toggle between crisp daylight mode and eye-comfort `#282828` charcoal dark mode.

### 📦 C. Universal Note Containers (Blocks)
* **Freeform Placement:** Double-click anywhere on the canvas to place a note.
* **Mixed Media:** Text, LaTeX equations (KaTeX), multi-page PDF printouts with ink annotations, images with 8-point resize handles, dynamic tables, and 2D function plotters.
* **MS Word-Style Formatting Ribbon:** Dedicated Home tab for typography and Insert tab for multimedia.

### 💾 D. Storage & Data Hub
* **Device Storage Vault:** Fast, sandboxed IndexedDB storage across 4 stores (`pages`, `hierarchy`, `assets`, `settings`).
* **Hard Drive Folder Mirror:** Save notes directly into a real directory on your PC.
* **Safe-Lock Protection:** Prevents browser cleanups from wiping your database.
* **Full Backup & Restore:** Export everything to `.notes` and import with one click.
* **Cloudflare R2 Cloud Sync:** Optional zero-cost cloud sync tucked into an expandable drawer.

---

## 📁 4. Architecture & Core Files

| File | Primary Role |
| :--- | :--- |
| [public/index.html](file:///c:/Users/suyas/Desktop/antigravity/Just%20in%20time/Notes%20App/public/index.html) | Main HTML layout, dual-tab ribbon, canvas viewport, dark mode toggle, and Storage & Data Hub settings flyout. |
| [public/styles.css](file:///c:/Users/suyas/Desktop/antigravity/Just%20in%20time/Notes%20App/public/styles.css) | Master stylesheet (`v4.7.2`, 24 lines) orchestrating 18 scoped modules in `public/css/` (each ≤ 334 lines). |
| `public/css/` | 18 single-responsibility stylesheets covering themes, ribbons, canvas, notes, typography, handles, and modals. |
| `src/ui/` | Modular UI controllers: `theme_controller.js`, `toast.js`, `storage_settings_modal.js`, `sidebar.js`, `ink_palette.js`, `layout_puck.js`, `install_prompt.js`. |
| [public/manifest.json](file:///c:/Users/suyas/Desktop/antigravity/Just%20in%20time/Notes%20App/public/manifest.json) | Web App Manifest for standalone installation and home screen launching. |
| [public/sw.js](file:///c:/Users/suyas/Desktop/antigravity/Just%20in%20time/Notes%20App/public/sw.js) | Service Worker providing offline-first caching for Airplane Mode reliability (`v4.7.2`). |
| `src/canvas/` | Math, viewport, stroke smoothing, gesture recognition, and eraser engines. |
| `src/blocks/` | Universal note containers, modular text blocks (`latex_parser.js`, `html_sanitizer.js`, `html_to_markdown.js`), tables, plots, and PDF printouts. |
| [src/storage/indexed_db.js](file:///c:/Users/suyas/Desktop/antigravity/Just%20in%20time/Notes%20App/src/storage/indexed_db.js) | Full storage engine: IndexedDB vault, hard drive folder migration, live metrics, and backup/restore. |
| [CodeORG.md](file:///c:/Users/suyas/Desktop/antigravity/Just%20in%20time/Notes%20App/CodeORG.md) | Architectural guidelines, modularization principles, and maintenance standards. |
| [tests/visual_smoke.test.js](file:///c:/Users/suyas/Desktop/antigravity/Just%20in%20time/Notes%20App/tests/visual_smoke.test.js) | Automated Puppeteer visual safety net: verifies flyouts, boundary cursors, and overlay isolation. |
| `tests/` | 75 automated tests: 74 unit tests covering inking, geometry, storage, themes + 1 Puppeteer visual browser test. |

---

## 🧪 5. Automated Test Suite & Visual Web Testing with Puppeteer

### Overall Status: `75 / 75 tests passed (100%)`
- **74 Unit Tests:** Pure logic, math, stroke smoothing, frustum culling, storage vaulting, rich paste, and theme switching (~900ms).
- **1 Puppeteer Visual Test:** Live headless browser test (`tests/visual_smoke.test.js`) verifying real UI visibility, boundary cursors, and overlay isolation (~2.1s).

---

### 🤖 Instructions: How to Run Visual Web Testing with Puppeteer

Puppeteer provides our automated **"robot with eyes"** that launches Microsoft Edge or Chrome in the background, renders the application, and verifies that the visual interface is working properly.

#### 1. Running the Complete Suite (Unit Tests + Puppeteer Visual Test)
```bash
node --test tests/*.test.js
```
Runs all 75 tests in ~3 seconds.

#### 2. Running Only the Puppeteer Visual Test
```bash
node --test tests/visual_smoke.test.js
```

#### 3. What the Puppeteer Visual Safety Net Checks:
1. **Master Visibility Guard:** Verifies that `#zoom-flyout` has `display: none` by default and does not pop out uninvited.
2. **Transparent Layer Isolation:** Verifies that `#active-draw-canvas` is hidden (`display: none`) in Navigate Mode so it never acts like a sheet of glass blocking clicks.
3. **Boundary Resize Zones:**
   - Verifies all 8 boundary handles (`.handle-e`, `.handle-w`, `.handle-n`, `.handle-s`, corners) exist.
   - Moves the virtual mouse to the note boundary and verifies that the double-headed resize arrow (`ew-resize` / `ns-resize`) appears.
4. **Interactive Flyout Cycling:** Clicks the zoom pill, confirms the flyout smoothly opens to `display: flex`, clicks again, and confirms it closes cleanly back to `display: none`.
5. **Console Cleanliness:** Listens to the browser's internal console and fails the test if any unhandled error or exception occurs.

---

## 🏛️ 8. Modular Architecture & Code Organization (v4.7.5 Final Polish)

Following the pragmatic Option A buffer zone (≤ 450 lines max, target ≤ 350 lines) and strict Two-Door House parity (`src/` and `public/src/` mirrored 100%):

1. **`public/app.js` (416 lines):** Streamlined from 4,028 original lines down to 416 lines (89.7% reduction). Camera navigation and bounds handling delegated to `src/canvas/viewport_camera.js` (115 lines); document auto-saving and serialization delegated to `src/storage/page_storage.js` (140 lines).
2. **`src/ui/storage_settings_modal.js` (246 lines):** Shrunk from 590 lines down to 246 lines by extracting the notebook folder hierarchy visualizer into `src/ui/explorer_tree.js` (371 lines).
3. **`src/storage/indexed_db.js` (425 lines):** Shrunk from 591 lines down to 425 lines by modularizing JSON file backup/restore into `src/storage/vault_backup.js` (62 lines), hard-drive folder synchronization into `src/storage/vault_folder_sync.js` (56 lines), and storage diagnostics & persistence lock into `src/storage/vault_metrics.js` (84 lines).
4. **`src/ui/sidebar.js` (398 lines):** Kept intact as a cohesive, single-responsibility component safely within the 450-line grace buffer.
5. **Zero Over-Limit Violations:** Zero files exceed 450 lines across the entire codebase.
6. **Automated Verification:** 76 / 76 automated tests passing at 100% across all modules.

---

## 🏛️ 9. Permanent Shell Architecture & HTML Modularization (v4.7.6)

Following component-driven scalability and the **"Permanent Shell"** architecture:
1. **`public/index.html` (337 lines):** Shrunk from 560 lines down to **337 lines** (comfortably under the 350-line ceiling). `index.html` now acts strictly as the permanent visual shell (Top Bar, Ribbon, Canvas, Sidebar).
2. **`src/ui/storage_settings_template.js` (224 lines):** Extracted the full Storage & Data Hub settings popup dialog into a dedicated, self-contained template module mirrored in `public/src/ui/storage_settings_template.js`.
3. **Dynamic Mounting:** `storage_settings_modal.js` now dynamically mounts the dialog upon startup, ensuring all future modals (Export, Audio, etc.) follow a clean modular component pattern with zero index.html clutter.
4. **Verification:** All 76 automated tests passing at 100%, with exact Two-Door House parity across all 57 files.

---

* **Production Status:** Deployed live on Vercel at `https://notes-app-topaz-six.vercel.app/`.


