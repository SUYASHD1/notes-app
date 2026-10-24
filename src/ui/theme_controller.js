// Theme Controller Module (Dark Mode / Light Mode)
// Manages theme state, persistence, meta tags, and ink swatch adaptation

export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';

export function getPreferredTheme() {
  const saved = localStorage.getItem('notes_app_theme');
  if (saved === THEME_DARK || saved === THEME_LIGHT) {
    return saved;
  }
  // Default to our rich dark mode (#282828)
  return THEME_DARK;
}

export function applyTheme(theme, options = {}) {
  const currentTheme = theme === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.body.setAttribute('data-theme', currentTheme);
  localStorage.setItem('notes_app_theme', currentTheme);

  // Update theme-color meta tag for mobile / iPad browser chrome
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', currentTheme === THEME_DARK ? '#1e1e1e' : '#ffffff');
  }

  // Update Theme Toggle Button UI
  const iconSpan = document.getElementById('theme-toggle-icon');
  const btn = document.getElementById('btn-theme-toggle');
  if (iconSpan) {
    iconSpan.textContent = currentTheme === THEME_DARK ? '🌙' : '☀️';
  }
  if (btn) {
    btn.setAttribute('title', currentTheme === THEME_DARK ? 'Dark Mode Active (Click for Light Mode)' : 'Light Mode Active (Click for Dark Mode)');
  }

  // Adapt Inking Swatches & default ink color
  const state = options.state;
  const firstSwatch = document.querySelector('.ink-swatch[data-color="#0f172a"], .ink-swatch[data-color="#f5f5f5"]');
  if (firstSwatch) {
    if (currentTheme === THEME_DARK) {
      firstSwatch.dataset.color = '#f5f5f5';
      firstSwatch.style.background = '#f5f5f5';
      firstSwatch.title = 'White / Cream Ink';
      if (state && (state.inkColor === '#0f172a' || !state.inkColor)) {
        state.inkColor = '#f5f5f5';
      }
    } else {
      firstSwatch.dataset.color = '#0f172a';
      firstSwatch.style.background = '#0f172a';
      firstSwatch.title = 'Black Ink';
      if (state && state.inkColor === '#f5f5f5') {
        state.inkColor = '#0f172a';
      }
    }
  }

  // Persist to IndexedDB vault settings if available
  if (state?.vault?.saveSetting) {
    state.vault.saveSetting('theme', currentTheme).catch(() => {});
  }

  return currentTheme;
}

export function toggleTheme(options = {}) {
  const current = document.documentElement.getAttribute('data-theme') || THEME_DARK;
  const nextTheme = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  applyTheme(nextTheme, options);

  if (options.showToast) {
    options.showToast(nextTheme === THEME_DARK ? '🌙 Dark Mode Enabled' : '☀️ Light Mode Enabled');
  }

  return nextTheme;
}

export function setupThemeController({ state, showToast }) {
  // 1. Initialize from storage or default
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme, { state });

  // 2. Also check if vault has a setting stored
  if (state?.vault?.getSetting) {
    state.vault.getSetting('theme', initialTheme).then(saved => {
      if (saved && saved !== initialTheme) {
        applyTheme(saved, { state });
      }
    }).catch(() => {});
  }

  // 3. Attach Click Handler to the Toggle Button
  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      toggleTheme({ state, showToast });
    });
  }
}
