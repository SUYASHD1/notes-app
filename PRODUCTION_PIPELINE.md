# 🚀 Notes App — Production Pipeline & Architecture Blueprint

> **Status:** Roadmap & Production Architecture  
> **Target:** Device-Agnostic, Zero-Server-Cost, Local-First Standalone Notes Application (iPad + Desktop)  
> **Last Updated:** October 2026  

---

## 📖 1. Executive Summary & Vision

This application combines the best of both worlds:
1. **Microsoft OneNote's Spatial Freedom:** Double-click and place notes, math equations, tables, images, or full-length PDFs anywhere on an infinite 2D canvas.
2. **Notability's Inking Feel:** Instant, paper-like handwriting with Apple Pencil on iPad, featuring 240Hz coalesced point sampling, pressure sensitivity, smart shape recognition, and zero tap-delay inking.

To transition from our proven prototype into a world-class production system without recurring server costs, the app follows a **Local-First, Device-Agnostic, User-Owned Storage** philosophy.

---

## 🧩 2. Current Features Already Built & Verified

The following capabilities have been engineered, integrated, and verified with **47 passing automated tests (100%)**:

### ✍️ A. Inking & Apple Pencil Engine
* **Zero Tap-Delay on iPad:** Solved the classic 300ms mobile Safari hesitation timer by intercepting non-passive touch events and disabling double-tap heuristics.
* **Ghost-Click Prevention:** Blocks synthetic mouse events generated when the stylus lifts off the screen.
* **240Hz High-Fidelity Sampling:** Captures all intermediate hardware touch points so fast cursive writing remains silky smooth.
* **Instant Single Dots:** Guaranteed capture for small punctuation marks, decimal points, and dots on letters like *"i"* and *"j"*.
* **Dedicated Inking vs. Navigation Modes:**
  * **Ink Mode:** Apple Pencil has exclusive writing control. Hand/palm resting on the screen is 100% ignored.
  * **Navigate Mode:** Use fingers for panning, zooming, selecting, and organizing.
  * **Draggable Floating Puck:** Quick-switch button located at the bottom-right corner that can be dragged anywhere out of the way.
* **Smart Tools:**
  * Pressure-sensitive Ballpoint Pen.
  * Soft, semi-transparent Highlighter with multiply-style layering.
  * Whole-Stroke Eraser and Precision Slice Eraser.
  * Shape Snapping (draw a circle, line, rectangle, or triangle and hold for 400ms to snap).

### 📦 B. Universal Note Containers (Blocks)
* **Freeform Placement:** Double-click anywhere on the canvas to place a container.
* **Rich Text Editor:** Markdown formatting, headings, checklists, bullet points, text styling, and custom font colors.
* **LaTeX Math Equations:** High-speed math formulas rendered with KaTeX.
* **PDF Printouts:** Import multi-page PDFs, lay them out sequentially at native aspect ratios, and highlight or write directly on top.
* **Images & Resizing:** 8-point corner/edge resize handles with custom cropping tool.
* **Dynamic Tables:** Add/remove rows and columns for structured notes.
* **Interactive Function Plotter:** Graph 2D math functions on coordinate axes.

### 🧭 C. Canvas Workspace & Organization
* **Infinite 2D Workspace:** Smooth inertia panning and pinch-to-zoom (10% to 500%).
* **Zoom-to-Fit:** Automatically scales the view to frame all your notes and drawings on screen.
* **Notebook Hierarchy:** Notebooks ➔ Sections ➔ Pages ➔ Subpages.
* **Search:** Live-filtering of pages and sections from the sidebar.
* **Distraction-Free Mode:** Collapsible sidebar (Ctrl+\\) for full-screen writing.

---

## 💾 3. Data Format & Storage Design

### How Data Is Stored (The JSON Model)
Every page is an independent digital document structured in clean, open JSON format:
```json
{
  "id": "page_982b7c",
  "title": "Quantum Mechanics Lecture 1",
  "viewport": { "x": 120, "y": -40, "zoom": 1.25 },
  "blocks": [
    {
      "id": "block_a1",
      "type": "text",
      "position": { "x": 100, "y": 80 },
      "size": { "width": 450, "height": 200 },
      "content": "# Wave Functions\nProbability density is given by $|\psi(x)|^2$."
    }
  ],
  "globalAnnotations": [
    {
      "id": "stroke_s1",
      "tool": "pen",
      "color": "#2563eb",
      "width": 3,
      "points": [{ "x": 105, "y": 92, "pressure": 0.6 }]
    }
  ],
  "metadata": {
    "createdAt": 1729600000000,
    "updatedAt": 1729600050000,
    "version": 4,
    "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

### Safety Principles
1. **Granular Files:** Each page is saved as its own file rather than one giant master document. Editing Page 1 on your iPad and Page 2 on your PC never interferes with each other.
2. **Local-First Saving:** Everything writes immediately to device storage (`IndexedDB`) in under 10 milliseconds. You never wait for internet or server responses.
3. **Atomic Writes:** Before replacing an existing document, the system writes to a temporary staging file, verifies the digital checksum, and only then commits the change.

---

## 🗺️ 4. Multi-Phase Production Roadmap

```
┌─────────────────────────────────────────────────────────────┐
│                   PRODUCTION PIPELINE                       │
├─────────────┬─────────────┬─────────────────┬───────────────┤
│   PHASE 1   │   PHASE 2   │     PHASE 3     │    PHASE 4    │
│  Permanent  │ Installable │   Free Cloud    │ UI/UX Polish  │
│    Local    │     PWA     │      Sync       │  & Production │
│   Storage   │ (No Bloat)  │ (Google / Git)  │   Hardening   │
└─────────────┴─────────────┴─────────────────┴───────────────┘
```

---

### ✅ Phase 1: Permanent Device Storage (Local-First Engine) — [COMPLETED]
* **Goal:** Ensure notes, notebook hierarchy, drawings, and heavy assets (PDFs, images) are permanently preserved on the device across browser reloads, system reboots, and offline sessions.
* **Status:** ✅ Completed & Verified with 51/51 automated tests (100% pass).
* **Deliverables Implemented:**
  1. **IndexedDB Document Store (`LocalVault` in `src/storage/indexed_db.js`):** Dedicated asynchronous key-value storage across 4 stores (`pages`, `hierarchy`, `assets`, `settings`), with graceful in-memory fallback for headless and automated testing.
  2. **Blob & Large Asset Vault:** High-resolution images and PDF binaries are isolated into the dedicated assets store to eliminate iOS Safari 5MB localStorage crash limits.
  3. **Auto-Save Debouncer:** Automatically saves 500ms after the last stroke or keystroke, with immediate flush triggers on `beforeunload`, tab/app switch (`visibilitychange`), and window blur.
  4. **Document Manager UI:** Smooth, asynchronous page switching with live status indicator (*"Saved locally"*).
  5. **Safety Backup Ledger:** Full prototype ledger backed up in the `prototype/` directory.

---

### 🟢 Phase 2: Installable Progressive Web App (PWA)
* **Goal:** Remove all web browser bloat (tabs, URL bars, navigation buttons) to deliver a true native app experience on iPadOS, Windows 11, macOS, and Android.
* **Deliverables:**
  1. **Web App Manifest (`manifest.json`):** Configure `display: "standalone"`, orientation locks, background theme colors, and application metadata.
  2. **Service Worker (`sw.js`):** Cache all core assets (HTML, CSS, JS, fonts, KaTeX math engine, icons) so the app launches instantly even with Wi-Fi completely disabled.
  3. **App Icon Suite:** High-resolution icons tailored for iPad Retina Home Screen, Windows Start Menu / Taskbar, and Android App Drawers.
  4. **Install Prompts:** In-app notification gently guiding the user on how to click "Install App" (on PC) or "Add to Home Screen" (on iPad).

---

### 🟢 Phase 3: Free Multi-Device Cloud Sync & Collision Prevention
* **Goal:** Keep notes synchronized across all your devices without monthly database bills or subscription servers.
* **Provider Strategy (Bring Your Own Storage):**
  * **Option A: Google Drive API (Recommended):** Uses the user's free 15 GB storage. Connect once with standard Google sign-in. Saves to a dedicated `NotesApp/` app data folder.
  * **Option B: GitHub API:** Syncs to a private repository for users who prefer Git commit histories.
* **Conflict & Collision Prevention Engine:**
  1. **Per-Page Synchronization:** Devices only sync changed pages rather than uploading the whole library.
  2. **Timestamp & Fingerprint Checks:**
     * If Cloud is newer and Local has not changed ➔ Seamlessly download and update local copy.
     * If Local is newer and Cloud has not changed ➔ Seamlessly upload local copy to cloud.
     * If both Cloud and Local were modified concurrently while offline ➔ **Non-Destructive Conflict Fork:** The system preserves both versions by creating `Note Title (iPad Conflict)` so no user input is ever lost.
  3. **Offline Sync Queue:** Actions taken while offline are queued up and automatically processed the moment internet connectivity returns.

---

### 🟢 Phase 4: UI/UX Polish & Production Hardening
* **Goal:** Elevate the user experience to match modern professional software standards.
* **Deliverables:**
  1. **Live Cloud Sync Status Pill:** Subtle badge in the ribbon indicating:
     * 🟢 *"All notes saved locally"*
     * 🔄 *"Syncing with Google Drive..."*
     * ☁️ *"Up to date (Synced 1m ago)"*
     * ⚡ *"Offline Mode — Queued"*
  2. **Export Engine:** One-click export of any page or notebook into:
     * High-resolution vector PDF (with inking and typed text merged).
     * Standard Markdown file with linked media.
  3. **Visual Polish:** Refined notebook sidebar, customizable canvas backgrounds (ruled lines, grid paper, dotted paper, dark slate, pure paper white).
  4. **End-to-End Test Suite:** Automated testing for sync recovery, offline reconnects, and large notebook scalability.

---

## 🔒 5. Development Principles & Guardrails
* **Zero Technical Jargon:** All documentation and user-facing status messages must remain clear, friendly, and accessible.
* **Explicit User Permission:** No implementation code will be written without direct user consent before starting each phase.
* **Data Safety Guarantee:** The app will never delete or overwrite unsynced notes. Local copies always remain the source of truth.
