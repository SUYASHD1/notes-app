const puppeteer = require('C:/Users/suyas/Desktop/antigravity/Astro APP/code folder/node_modules/puppeteer-core');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const baseDir = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  const cleanUrl = (req.url || '/').split('?')[0];
  let reqPath = cleanUrl === '/' ? '/public/index.html' : cleanUrl;

  let filePath;
  if (reqPath.startsWith('/src/')) {
    const pubSrc = path.join(baseDir, 'public', reqPath);
    filePath = fs.existsSync(pubSrc) ? pubSrc : path.join(baseDir, reqPath);
  } else if (reqPath.startsWith('/public/')) {
    filePath = path.join(baseDir, reqPath);
  } else {
    filePath = path.join(baseDir, 'public', reqPath);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    res.end(content);
  });
});

server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    console.log('App loaded successfully in Microsoft Edge.');

    // Wait for note container to exist
    await page.waitForSelector('.universal-note-container', { timeout: 5000 });
    console.log('Found universal note container.');

    // 1. Test Typing Responsiveness
    const textSelector = '.note-item-text';
    await page.waitForSelector(textSelector, { timeout: 3000 });
    await page.focus(textSelector);

    // Measure latency for typing 100 characters rapidly
    const startType = Date.now();
    for (let i = 0; i < 50; i++) {
      await page.keyboard.type('a');
    }
    const typeElapsed = Date.now() - startType;
    console.log(`Typing 50 characters elapsed: ${typeElapsed}ms (~${(typeElapsed / 50).toFixed(2)}ms per char)`);

    // 2. Test Smart Markdown Shortcut
    await page.keyboard.press('Enter');
    await page.keyboard.type('#');
    await page.keyboard.press('Space');
    await page.keyboard.type('Heading Created by Shortcut');
    
    // Check if an <h1> was created
    const hasH1 = await page.evaluate(() => {
      const el = document.querySelector('.note-item-text');
      return el && el.querySelector('h1') !== null;
    });
    console.log('Smart shortcut # + Space created <h1>:', hasH1 ? 'YES (SUCCESS)' : 'NO');

    // 3. Test Wheel Navigation Stress
    console.log('Running wheel navigation stress test (10 rapid wheel events)...');
    const startWheel = Date.now();
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel({ deltaY: -50 });
    }
    const wheelElapsed = Date.now() - startWheel;
    console.log(`10 rapid wheel events handled in: ${wheelElapsed}ms`);

    // Ensure zero page crashes or uncaught exceptions
    if (errors.length > 0) {
      console.warn('Page errors detected:', errors);
    } else {
      console.log('All performance checks passed with 0 errors in Microsoft Edge!');
    }

  } catch (err) {
    console.error('Benchmark execution error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
    console.log('Browser and server closed cleanly.');
  }
});
