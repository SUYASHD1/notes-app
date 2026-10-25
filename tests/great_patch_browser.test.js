import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

function findBrowserExecutable() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function createTestServer() {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  };

  const server = http.createServer((req, res) => {
    const cleanUrl = (req.url || '/').split('?')[0];
    let relPath = cleanUrl === '/' ? '/public/index.html' : cleanUrl;
    let filePath;

    if (relPath.startsWith('/src/')) {
      const pubSrc = path.join(ROOT_DIR, 'public', relPath);
      filePath = fs.existsSync(pubSrc) ? pubSrc : path.join(ROOT_DIR, relPath);
    } else if (relPath.startsWith('/public/')) {
      filePath = path.join(ROOT_DIR, relPath);
    } else {
      filePath = path.join(ROOT_DIR, 'public', relPath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

test('The Great Patch: Comprehensive Browser Testing in Microsoft Edge', async (t) => {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    t.skip('Skipping browser test: No Edge/Chrome executable found on system.');
    return;
  }

  const { server, url } = await createTestServer();
  const consoleErrors = [];

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 860 });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.universal-note-container', { timeout: 6000 });
    // Wait for splash overlay to fade out
    await page.waitForFunction(() => {
      const splash = document.getElementById('app-splash-overlay');
      return !splash || splash.classList.contains('fade-out') || getComputedStyle(splash).display === 'none';
    }, { timeout: 5000 });

    // 1. Master Key 1: Universal Tone Verification
    const activeBtnColors = await page.evaluate(() => {
      const navBtn = document.getElementById('btn-mode-win');
      const homeTab = document.getElementById('tab-btn-home');
      const navStyle = getComputedStyle(navBtn);
      const homeStyle = getComputedStyle(homeTab);
      return {
        navBg: navStyle.backgroundColor,
        navColor: navStyle.color,
        homeColor: homeStyle.color,
        cssActiveGlow: getComputedStyle(document.documentElement).getPropertyValue('--active-glow-blue').trim()
      };
    });
    assert.equal(activeBtnColors.cssActiveGlow, '#38bdf8', 'Master token --active-glow-blue must be #38bdf8');

    // 2. Master Key 6: Clean Slate & Font Color Layout (Horizontal side-by-side)
    const fontColorLayout = await page.evaluate(() => {
      const mainBtn = document.getElementById('ribbon-font-color-btn');
      const dropBtn = document.getElementById('ribbon-font-color-dropdown-btn');
      const mainRect = mainBtn.getBoundingClientRect();
      const dropRect = dropBtn.getBoundingClientRect();
      return {
        mainRight: mainRect.right,
        dropLeft: dropRect.left,
        mainTop: mainRect.top,
        dropTop: dropRect.top,
        isSideBySide: dropRect.left >= (mainRect.right - 2) && Math.abs(dropRect.top - mainRect.top) < 6
      };
    });
    assert.ok(fontColorLayout.isSideBySide, `Font color button and chevron dropdown must sit side-by-side horizontally: ${JSON.stringify(fontColorLayout)}`);

    // 3. Master Key 6 & 3: Opening Font Color Dropdown and Choosing a Color
    await page.click('#ribbon-font-color-dropdown-btn');
    const isFontPaletteOpen = await page.evaluate(() => {
      const p = document.getElementById('font-color-palette');
      return p && !p.classList.contains('hidden');
    });
    assert.ok(isFontPaletteOpen, 'Font color palette must be visible after clicking chevron');

    // Click blue swatch (#1d4ed8)
    await page.click('.fc-swatch[data-color="#1d4ed8"]');
    const colorBarState = await page.evaluate(() => {
      const bar = document.getElementById('ribbon-color-bar');
      const palette = document.getElementById('font-color-palette');
      return {
        barBg: bar.style.backgroundColor,
        paletteHidden: palette.classList.contains('hidden')
      };
    });
    assert.equal(colorBarState.barBg, 'rgb(29, 78, 216)', 'Indicator bar must update to royal blue');
    assert.ok(colorBarState.paletteHidden, 'Font color palette must close after picking swatch');

    // 4. Master Key 5: Polite Guest Mutual Dismissal
    await page.click('#ribbon-highlight-dropdown-btn');
    let hlOpen = await page.evaluate(() => !document.getElementById('highlighter-palette').classList.contains('hidden'));
    assert.ok(hlOpen, 'Highlighter palette must open when clicking chevron');

    await page.click('#ribbon-font-color-dropdown-btn');
    const mutualCheck = await page.evaluate(() => {
      return {
        fcOpen: !document.getElementById('font-color-palette').classList.contains('hidden'),
        hlClosed: document.getElementById('highlighter-palette').classList.contains('hidden')
      };
    });
    assert.ok(mutualCheck.fcOpen, 'Font color palette must open');
    assert.ok(mutualCheck.hlClosed, 'Highlighter palette must automatically close when font color palette opens');

    // Click outside on canvas world to close all
    await page.click('#canvas-world');
    const allClosed = await page.evaluate(() => {
      return document.getElementById('font-color-palette').classList.contains('hidden') &&
             document.getElementById('highlighter-palette').classList.contains('hidden');
    });
    assert.ok(allClosed, 'Outside clicks must dismiss open palettes immediately');

    // 5. Master Key 2: Frozen Ground (Zero Scroll Jumps on Select)
    const scrollBefore = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await page.select('#ribbon-font-size', '20px');
    const scrollAfter = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    assert.equal(scrollBefore.x, scrollAfter.x, 'Window scroll X must remain frozen');
    assert.equal(scrollBefore.y, scrollAfter.y, 'Window scroll Y must remain frozen');

    // 6. Master Key 4: Ink Mode Vector Icons, Chisel Tip, and Custom Palette Launcher
    await page.click('#btn-mode-ipad');
    await page.waitForFunction(() => document.getElementById('ribbon-ink-group').style.display !== 'none');

    const inkToolsCheck = await page.evaluate(() => {
      const pen = document.getElementById('ink-tool-pen');
      const hl = document.getElementById('ink-tool-highlighter');
      const eraser = document.getElementById('ink-tool-eraser');
      const customLauncher = document.querySelector('.ink-custom-btn');
      return {
        penHasSvg: !!pen.querySelector('svg'),
        hlHasSvg: !!hl.querySelector('svg'),
        eraserHasSvg: !!eraser.querySelector('svg'),
        hasCustomLauncher: !!customLauncher
      };
    });
    assert.ok(inkToolsCheck.penHasSvg, 'Pen button must feature vector SVG icon');
    assert.ok(inkToolsCheck.hlHasSvg, 'Highlighter button must feature vector SVG icon');
    assert.ok(inkToolsCheck.eraserHasSvg, 'Eraser button must feature vector SVG icon');
    assert.ok(inkToolsCheck.hasCustomLauncher, 'Custom palette launcher button must replace raw input box');

    // Activate Highlighter and check chisel tip attribute
    await page.click('#ink-tool-highlighter');
    const highlighterModeCheck = await page.evaluate(() => {
      const inkGroup = document.getElementById('ribbon-ink-group');
      const toolAttr = inkGroup.getAttribute('data-ink-tool');
      const sizeDot = inkGroup.querySelector('.size-dot');
      const dotTransform = getComputedStyle(sizeDot).transform;
      return { toolAttr, hasTransform: dotTransform !== 'none' };
    });
    assert.equal(highlighterModeCheck.toolAttr, 'highlighter', 'Highlighter activation must set data-ink-tool="highlighter"');
    assert.ok(highlighterModeCheck.hasTransform, 'Highlighter active state must apply chisel tip transform to size dots');

    // Ensure scratch directory exists and capture verification screenshot
    const scratchDir = path.join(ROOT_DIR, 'scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    await page.screenshot({ path: path.join(scratchDir, 'great_patch_verified.png'), fullPage: false });

    assert.equal(consoleErrors.length, 0, `Browser console had errors: ${consoleErrors.join(', ')}`);
  } finally {
    await browser.close();
    server.close();
  }
});
