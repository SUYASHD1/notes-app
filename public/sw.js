// Service Worker for Notes App (Offline-First PWA)
const CACHE_NAME = 'notes-app-cache-v4.8.8';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=4.8.8',
  './css/theme.css',
  './css/layout_modes.css',
  './css/topbar.css',
  './css/ribbon.css',
  './css/palettes.css',
  './css/ink_tools.css',
  './css/sidebar.css',
  './css/explorer_tree.css',
  './css/canvas.css',
  './css/status_bar.css',
  './css/notes.css',
  './css/notes_typography.css',
  './css/resize_handles.css',
  './css/math_blocks.css',
  './css/media_pdf.css',
  './css/media_crop.css',
  './css/storage_hub.css',
  './css/storage_hub_dark.css',
  './css/storage_cloud.css',
  './css/splash.css',
  './icons/logo.svg',
  './app.js',
  './manifest.json',
  './src/core.js',
  './src/core/sample_notebook.js',
  './src/blocks/text_block.js',
  './src/blocks/latex_parser.js',
  './src/blocks/html_sanitizer.js',
  './src/blocks/html_to_markdown.js',
  './src/blocks/block_drag_resize.js',
  './src/blocks/math_table_renderer.js',
  './src/blocks/pdf_renderer.js',
  './src/blocks/image_cropper.js',
  './src/blocks/media_renderer.js',
  './src/blocks/text_renderer.js',
  './src/blocks/sketch_renderer.js',
  './src/blocks/container_renderer.js',
  './src/canvas/viewport_bounds.js',
  './src/canvas/scrollbar_controller.js',
  './src/canvas/kinetic_pan.js',
  './src/canvas/viewport_interaction.js',
  './src/canvas/stroke_creator.js',
  './src/canvas/inking_interaction.js',
  './src/canvas/viewport_camera.js',
  './src/ui/ribbon_controller.js',
  './src/ui/container_actions.js',
  './src/ui/ribbon_actions.js',
  './src/ui/keyboard_shortcuts.js',
  './src/ui/theme_controller.js',
  './src/storage/indexed_db.js',
  './src/storage/vault_backup.js',
  './src/storage/vault_folder_sync.js',
  './src/storage/vault_metrics.js',
  './src/storage/page_storage.js',
  './src/storage/opfs.js',
  './src/storage/file_system_access.js',
  './src/storage/conflict_resolver.js',
  './src/storage/data_export_import.js',
  './src/ui/toast.js',
  './src/ui/storage_settings_modal.js',
  './src/ui/storage_settings_template.js',
  './src/ui/explorer_tree.js',
  './src/ui/sidebar.js',
  './src/ui/ink_palette.js',
  './src/ui/layout_puck.js',
  './src/ui/install_prompt.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

// Install Event: Pre-cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use resilient caching so a single failed optional asset won't break install
      await Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] Precache skipped for ${url}:`, err))
        )
      );
      return self.skipWaiting();
    })
  );
});

// Activate Event: Remove stale caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[SW] Purging outdated cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-first with network fallback and dynamic runtime caching
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For app navigation, return cached index.html if network is unreachable (Airplane mode)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('./index.html');
        return cached || caches.match('./');
      })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately, optionally refresh cache in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {
          // Offline, background revalidation failed silently
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store copy in cache
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }

        // Clone response to put in cache
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for missing images/resources when completely offline
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
