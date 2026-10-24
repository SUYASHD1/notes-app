import test from 'node:test';
import assert from 'node:assert/strict';
import { getPreferredTheme, applyTheme, toggleTheme, THEME_DARK, THEME_LIGHT } from '../src/core.js';

// Setup Mock DOM environment for isolated node tests
function setupMockDom() {
  const elements = new Map();
  const attributes = new Map();
  const store = new Map();

  global.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const docEl = {
    setAttribute: (k, v) => attributes.set('docEl_' + k, v),
    getAttribute: (k) => attributes.get('docEl_' + k) || null
  };

  const bodyEl = {
    setAttribute: (k, v) => attributes.set('body_' + k, v),
    getAttribute: (k) => attributes.get('body_' + k) || null
  };

  const metaTheme = {
    setAttribute: (k, v) => attributes.set('meta_' + k, v),
    getAttribute: (k) => attributes.get('meta_' + k) || null
  };

  const toggleIcon = {
    textContent: ''
  };

  const toggleBtn = {
    setAttribute: (k, v) => attributes.set('btn_' + k, v),
    getAttribute: (k) => attributes.get('btn_' + k) || null
  };

  const inkSwatch = {
    dataset: { color: '#0f172a' },
    style: { background: '#0f172a' },
    title: 'Black'
  };

  global.document = {
    documentElement: docEl,
    body: bodyEl,
    querySelector: (sel) => {
      if (sel === 'meta[name="theme-color"]') return metaTheme;
      if (sel.includes('.ink-swatch')) return inkSwatch;
      return null;
    },
    getElementById: (id) => {
      if (id === 'theme-toggle-icon') return toggleIcon;
      if (id === 'btn-theme-toggle') return toggleBtn;
      return null;
    }
  };

  return { attributes, store, toggleIcon, toggleBtn, inkSwatch };
}

test('Theme Controller: defaults to dark mode (#282828 palette) when unconfigured', () => {
  const { store } = setupMockDom();
  assert.equal(getPreferredTheme(), THEME_DARK);
});

test('Theme Controller: applyTheme("dark") activates dark attributes and cream ink swatch', () => {
  const { attributes, store, toggleIcon, inkSwatch } = setupMockDom();
  const mockState = { inkColor: '#0f172a' };

  applyTheme(THEME_DARK, { state: mockState });

  assert.equal(attributes.get('docEl_data-theme'), 'dark');
  assert.equal(attributes.get('body_data-theme'), 'dark');
  assert.equal(attributes.get('meta_content'), '#1e1e1e');
  assert.equal(store.get('notes_app_theme'), 'dark');
  assert.equal(toggleIcon.textContent, '🌙');
  assert.equal(mockState.inkColor, '#f5f5f5', 'Active ink automatically adapts to soft cream white in dark mode');
  assert.equal(inkSwatch.dataset.color, '#f5f5f5');
});

test('Theme Controller: toggleTheme() toggles between dark and light smoothly', () => {
  const { attributes, toggleIcon, inkSwatch } = setupMockDom();
  const mockState = { inkColor: '#f5f5f5' };

  // Currently dark
  attributes.set('docEl_data-theme', 'dark');

  // Toggle to light
  const next1 = toggleTheme({ state: mockState });
  assert.equal(next1, THEME_LIGHT);
  assert.equal(attributes.get('docEl_data-theme'), 'light');
  assert.equal(toggleIcon.textContent, '☀️');
  assert.equal(mockState.inkColor, '#0f172a', 'Ink switches back to black in light mode');
  assert.equal(inkSwatch.dataset.color, '#0f172a');

  // Toggle back to dark
  const next2 = toggleTheme({ state: mockState });
  assert.equal(next2, THEME_DARK);
  assert.equal(attributes.get('docEl_data-theme'), 'dark');
  assert.equal(toggleIcon.textContent, '🌙');
  assert.equal(mockState.inkColor, '#f5f5f5');
});
