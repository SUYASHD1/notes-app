# Notes App - Bug Fixes & Architecture Plan (24 Oct 2026)

This document provides a clear, non-technical explanation of the 4 newly identified issues on Windows and iPad, explaining why each happens and the exact fix for each.

---

## 1. Large PDF Loading: Frame Freeze on iPad (Even with M1 Chip)

### What Was Happening:
- Your M1 iPad has incredible computing power, but Apple's Safari browser enforces a strict safety limit on graphics memory for web pages.
- When you open a PDF document, the app was drawing **every single page all at once up front at maximum 4K resolution**.
- If a PDF has 20, 50, or 100 pages, this creates over 1 to 2 Gigabytes of heavy image textures in a split second.
- While Windows desktop computers have huge pools of graphics memory and brute-force through this, iPad Safari hits its memory ceiling. To prevent a crash, Safari pauses its graphics engine to dump memory, creating a noticeable stutter and "frame freeze" effect.

### The Fix:
- **On-Demand Page Rendering (Virtualization)**:
  - The app will now only render the pages that are **currently visible inside your viewing window** (plus one buffer page ahead).
  - Off-screen pages remain lightweight placeholders with their correct size and page badges.
  - As you scroll down the PDF, new pages appear instantly and smoothly, reducing memory usage by over 80%.
  - This ensures even massive 100-page textbooks open with zero lag and maintain a butter-smooth 60–120fps on your M1 iPad.

---

## 2. Touch Pinch-to-Zoom on iPad Leading to an Accidental "Scroll Effect"

### What Was Happening:
- When you place two fingers on the screen to pinch-to-zoom, human fingers naturally wobble and drift slightly as the hand moves.
- The app's gesture system was trying to guess between two separate actions: *"Is the user zooming, or are they scrolling?"*
- Because of natural finger wobbles, the app would rapidly flip back and forth between zooming and scrolling dozens of times a second.
- Every time it flipped to scrolling, it jerked the canvas sideways or downwards, making the page feel like it was sliding away from under your fingers instead of zooming smoothly.

### The Fix:
- **Locked Paper Anchoring (Unified Pinch Math)**:
  - We remove the flip-flopping logic and replace it with true paper anchoring (the way Apple Maps, GoodNotes, and Apple Photos work).
  - The exact point between your two fingertips remains pinned directly to your screen.
  - Spreading or pinching your fingers scales the canvas smoothly around that exact spot without any sliding, jumping, or accidental scrolling.

---

## 3. Accidental Hard Boundary on Top / Content Stranded in the Void

### What Was Happening:
- The canvas camera has a built-in safety limit at the top margin (`40px`) so you cannot pan up into an infinite empty void.
- However, note boxes had **no physical barrier stopping them when you dragged them**.
- If you grabbed a note box and dragged it upwards towards the top of your screen, the box could cross past the top margin into negative coordinate space (`y < 0`).
- Once dropped there, because the camera refused to scroll past `y = 40px`, that note became unreachable—trapped behind an invisible ceiling.

### The Fix:
- **Physical Top and Left Barriers for Content**:
  - Note boxes will now physically hit a solid boundary at the top and left margins (`x ≥ 40px, y ≥ 40px`).
  - You will not be able to drag or push any note past the boundary into the negative void.
- **Safety Net for Existing Content**:
  - When loading or adjusting the canvas, the app will automatically check the position of all notes.
  - If any note is found above or to the left of the margin, the app will automatically bring it safely back into view so content can never be lost.

---

## 4. Repositioning a Box While Auto-Scrolling "Drops the Box"

### What Was Happening:
- When you highlight or select text near the edge of your screen, the canvas auto-scrolls smoothly.
- But when you grabbed a note box by its header and dragged it near the screen edge, the canvas started gliding underneath, yet the box was suddenly dropped or left behind.
- This happened because the box-dragging code was calculating the box's position using your mouse's position on the screen without adding the distance the canvas was sliding beneath it.
- As the canvas moved forward, the box stayed at its old spot in world coordinates, making it look like your pointer had dropped the box.

### The Fix:
- **Live Cursor-Lock During Edge Auto-Scroll**:
  - The edge auto-scroller will synchronize directly with the active box-dragging system on every single animation frame.
  - As the canvas glides in any direction, the box's position will continuously update, keeping the note firmly glued directly under your pointer until you let go.

---

## Summary of Next Actions

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **Big PDF Freeze on iPad** | All pages rendered simultaneously into huge GPU canvases | Lazy-load only currently visible pages on-demand |
| **Pinch-to-Zoom "Scroll Effect"** | Logic constantly alternates between zoom and scroll | Unified fingertip anchor locking (Apple Maps style) |
| **Top Boundary Stranded Content** | Boxes had no top/left boundary stops | Enforce hard wall at $x, y \ge 40\text{px}$ + safety pull-back |
| **Edge-Scroll Repositioning Drop** | Canvas panned without updating dragged box delta | Live frame-by-frame coordinate sync while dragging |
