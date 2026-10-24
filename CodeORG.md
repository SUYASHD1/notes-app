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

## 📜 2. The Four Golden Rules

### Rule 1: One File, One Responsibility (Don't Create "Giant Brains")
- `app.js` is the **conductor of the orchestra**, not the whole orchestra.
- It should only connect user clicks to the right tools. It should **never** contain thousands of lines of raw math, PDF drawing loops, or complex storage logic.
- **When adding a new feature** (e.g. voice notes, audio playback, tags):
  1. Create a dedicated file inside the appropriate folder (e.g. `src/blocks/audio_block.js`).
  2. Export clean functions from that file.
  3. Simply import and call those functions inside `app.js`.
- If a file starts reaching 400–500 lines, it is time to split helper functions into their own module.

### Rule 2: The Two-Door House (`src/` and `public/src/`)
Our project has two twin engine folders that work hand-in-hand:
1. `src/`: Used by our **automated test runner** (`node --test`) to test logic in isolation.
2. `public/src/`: Delivered directly to the **web browser and iPad**.

> **Whenever you add or update an engine helper in `src/`, make sure the matching file in `public/src/` is updated as well!** This guarantees our automated tests always reflect the exact code running on your iPad and PC.

### Rule 3: Test Before You Ship (The 71-Test Shield)
- We have an automated test suite of **71 tests** in the `tests/` directory.
- Running `node --test tests/*.test.js` takes **less than 1 second** and checks:
  - Handwriting stroke smoothing and single-dot capture.
  - Bounding box collision and frustum culling.
  - Storage saving, backup downloads, and folder migration.
  - PDF layout and natural aspect ratios.
  - Mathematical LaTeX equation rendering.
  - Spatial canvas boundaries and zero-void protection.
- **Rule:** Before any change is marked as complete, you must run the tests and verify that `71 / 71 tests passed (100%)`.

### Rule 4: Always Bump the Version Number (The Anti-Cache Guarantee)
- Web browsers and Apple's iPad Safari aggressively cache files on disk to save data.
- If you change a `.js` or `.css` file without updating the version query, the user's iPad will keep running the old cached code.
- **Whenever you make a visual or logic update:**
  1. Bump the query in `public/index.html` (e.g. `styles.css?v=4.6.0` and `app.js?v=4.6.0`).
  2. Bump `CACHE_NAME` in `public/sw.js` (e.g. `notes-app-cache-v4.6`).
  3. Update `PRECACHE_ASSETS` in `public/sw.js` with the new version string.
  This forces the browser to discard outdated files and download the fresh update immediately.

---

## 📁 3. Directory Anatomy: Where Does My Code Go?

| Folder | What Belongs Here | Real Examples in Our Codebase |
| :--- | :--- | :--- |
| `src/core/` | Fundamental data models, types, commands, and undo/redo history. | `document.js`, `history.js`, `types.js`, `sandbox.js` |
| `src/canvas/` | Math, infinite viewport camera, spatial scrollbars, boundaries, gestures, and handwriting smoothing. | `viewport.js`, `viewport_bounds.js`, `scrollbar_controller.js`, `gestures.js`, `stroke_renderer.js` |
| `src/blocks/` | Specific note content types and their interactive behaviours. | `text_block.js`, `pdf_block.js`, `media_block.js`, `table_block.js`, `plot_block.js` |
| `src/storage/` | Data persistence, local device vaults, hard drive mirroring, and cloud sync. | `indexed_db.js`, `file_system_access.js`, `r2_sync.js`, `hierarchy.js` |
| `src/ui/` | Visual controls, navigation bars, popovers, and settings menus. | `ribbon_controller.js`, `sidebar.js`, `layout_puck.js`, `ink_palette.js`, `storage_settings_modal.js` |
| `public/` | The live website root served to the browser. | `index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js` |
| `tests/` | Automated unit tests covering all math, storage, and logic. | `core.test.js`, `viewport_bounds.test.js`, `latex_markdown.test.js` |

---

## 🛠️ 4. The 4-Step Recipe for Fixing Bugs & Adding Features

When a user reports a bug or requests a new feature, follow this exact recipe:

### Step 1: Identify the Layer
- **Visual styling bug?** Check `public/styles.css` (look for conflicting selectors or mode overrides).
- **Navigation or camera jumping?** Check `src/canvas/viewport_bounds.js` or `src/canvas/gestures.js`.
- **Note creation or content formatting?** Check `src/blocks/`.
- **Saving or file loss issue?** Check `src/storage/indexed_db.js`.

### Step 2: Keep Styles Scoped (Avoid Global `!important` Clashes)
- Never write global `!important` rules on broad classes (like `#ribbon-text-group { display: flex !important; }`) that could override other modes.
- Scope rules strictly by container and mode (e.g. `#ribbon-bar[data-tab="home"] #ribbon-text-group`).

### Step 3: Verify the 71 Tests
- Run `node --test tests/*.test.js` in your terminal.
- If you introduced new logic (e.g. a new shape or a new boundary rule), add a small test in `tests/` to lock that behavior in forever.

### Step 4: Version Bump & Production Push
- Bump the version in `public/index.html` and `public/sw.js`.
- Commit with a clear, descriptive message (e.g. `git commit -m "fix: smooth out iPad palm rejection near ribbon"`).
- Push to GitHub `main` for instant deployment.

---

## 🎯 Summary Checklist Before Every Release
- [ ] Code is modularized into its own file in `src/` and mirrored in `public/src/`.
- [ ] No monolithic code dumps into `app.js`.
- [ ] All 71 automated tests pass (`node --test tests/*.test.js`).
- [ ] Version number bumped in `index.html` and `sw.js`.
- [ ] Changes logged clearly into `CURRENT_STATE.md`.
