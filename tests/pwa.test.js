import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Core from '../src/core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('PWA Web App Manifest validity and schema', () => {
  const manifestPath = path.join(rootDir, 'public', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in public folder');

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  assert.ok(manifest.name, 'Manifest must have a name');
  assert.ok(manifest.short_name, 'Manifest must have a short_name');
  assert.equal(manifest.display, 'standalone', 'Manifest display mode must be standalone');
  assert.ok(manifest.start_url, 'Manifest must specify a start_url');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Manifest must declare at least 2 icons');

  // Verify that each declared icon actually exists on disk
  for (const icon of manifest.icons) {
    const iconPath = path.join(rootDir, 'public', icon.src);
    assert.ok(fs.existsSync(iconPath), `Declared icon file must exist: ${icon.src}`);
    const stat = fs.statSync(iconPath);
    assert.ok(stat.size > 1000, `Icon file must be a real image with non-trivial size: ${icon.src}`);
  }
});

test('Service Worker file structure and offline cache declarations', () => {
  const swPath = path.join(rootDir, 'public', 'sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js must exist in public directory');

  const swContent = fs.readFileSync(swPath, 'utf8');
  assert.match(swContent, /CACHE_NAME/, 'Service worker must declare CACHE_NAME');
  assert.match(swContent, /addEventListener\(['"]install['"]/, 'Service worker must handle install event');
  assert.match(swContent, /addEventListener\(['"]activate['"]/, 'Service worker must handle activate event');
  assert.match(swContent, /addEventListener\(['"]fetch['"]/, 'Service worker must handle fetch event');
  assert.match(swContent, /caches\.match/, 'Service worker must utilize Cache Storage API');
});

test('public/index.html includes essential PWA & iOS Retina Home Screen meta tags', () => {
  const htmlPath = path.join(rootDir, 'public', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<link\s+rel=["']manifest["']\s+href=["']\.\/manifest\.json["']/i, 'index.html must link to manifest.json');
  assert.match(html, /name=["']apple-mobile-web-app-capable["']\s+content=["']yes["']/i, 'index.html must enable apple-mobile-web-app-capable');
  assert.match(html, /name=["']apple-mobile-web-app-status-bar-style["']/i, 'index.html must configure status bar style for iPadOS');
  assert.match(html, /rel=["']apple-touch-icon["']/i, 'index.html must declare apple-touch-icon for iPad Retina screen');
  assert.match(html, /name=["']theme-color["']/i, 'index.html must declare theme-color');
});

test('Core module exposes PWA installation and lifecycle controller utilities', () => {
  assert.equal(typeof Core.setupInstallPrompt, 'function', 'Core must re-export setupInstallPrompt');
  assert.equal(typeof Core.registerServiceWorker, 'function', 'Core must re-export registerServiceWorker');
  assert.equal(typeof Core.showIOSInstallModal, 'function', 'Core must re-export showIOSInstallModal');
  assert.equal(typeof Core.isStandaloneMode, 'function', 'Core must re-export isStandaloneMode');
  assert.equal(typeof Core.isIOSDevice, 'function', 'Core must re-export isIOSDevice');
});
