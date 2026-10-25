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

// Locate local browser executable (Microsoft Edge or Google Chrome)
function findBrowserExecutable() {
  const candidates = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Minimal static file server for tests
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

test('Puppeteer Visual Safety Net: Menus, Boundaries, and Overlay Isolation', async (t) => {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    t.skip('Skipping browser test: No Chrome/Edge executable found on system.');
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
    await page.setViewport({ width: 1280, height: 800 });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.universal-note-container', { timeout: 5000 });
    // Wait for initial luxury splash dissolve
    await page.waitForFunction(() => !document.getElementById('app-splash-overlay') || document.getElementById('app-splash-overlay').classList.contains('fade-out'), { timeout: 4000 });

    // 1. Master Visibility: Zoom Flyout must be hidden by default
    const zoomDisplay = await page.$eval('#zoom-flyout', el => getComputedStyle(el).display);
    assert.equal(zoomDisplay, 'none', 'Zoom flyout must have display: none on initial load');

    // 2. Active Draw Canvas must be hidden in Navigate mode
    const drawCanvasDisplay = await page.$eval('#active-draw-canvas', el => getComputedStyle(el).display);
    assert.equal(drawCanvasDisplay, 'none', 'Active ink draw canvas must have display: none in Navigate mode');

    // 3. Note Container must have boundary resize handles present in DOM
    const handlesCount = await page.$$eval('.universal-note-container .resize-handle', handles => handles.length);
    assert.ok(handlesCount >= 8, `Expected at least 8 resize handles, got ${handlesCount}`);

    // 4. Note container boundary hover: moving mouse to edge displays resize cursor
    const boxRect = await page.$eval('.universal-note-container', el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    // Hover over right border of note box
    await page.mouse.move(boxRect.x + boxRect.width, boxRect.y + boxRect.height / 2);
    await new Promise(r => setTimeout(r, 80));

    const rightHandleCursor = await page.$eval('.universal-note-container .handle-e', el => getComputedStyle(el).cursor);
    assert.equal(rightHandleCursor, 'ew-resize', 'East handle must specify ew-resize cursor');

    const rightHandleDisplay = await page.$eval('.universal-note-container .handle-e', el => getComputedStyle(el).display);
    assert.equal(rightHandleDisplay, 'block', 'East handle must display: block when parent is hovered');

    // 5. Interactive Flyout toggle: click zoom pill to open, click again to close
    const zoomPill = await page.$('#status-bar .zoom-pill');
    assert.ok(zoomPill, 'Zoom pill button exists in status bar');
    await zoomPill.click();

    const zoomDisplayOpened = await page.$eval('#zoom-flyout', el => getComputedStyle(el).display);
    assert.equal(zoomDisplayOpened, 'flex', 'Zoom flyout must open to display: flex when clicked');

    await zoomPill.click();
    const zoomDisplayClosed = await page.$eval('#zoom-flyout', el => getComputedStyle(el).display);
    assert.equal(zoomDisplayClosed, 'none', 'Zoom flyout must close to display: none when clicked again');

    // 6. Zero unexpected console errors
    assert.equal(consoleErrors.length, 0, `Expected 0 console errors, got: ${consoleErrors.join('; ')}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
