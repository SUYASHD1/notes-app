// HTML Template for Storage & Data Hub Settings Modal / Flyout
export function getStorageSettingsModalHTML() {
  return `
    <div id="storage-settings-modal" class="settings-modal-backdrop hidden">
      <div class="settings-flyout-card" role="dialog" aria-labelledby="settings-title">
        
        <!-- Header -->
        <div class="settings-header">
          <div class="settings-title-group">
            <div class="settings-icon-bubble">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
            </div>
            <div>
              <h3 id="settings-title">Storage &amp; Data Hub</h3>
              <p class="settings-sub">Manage where notes live, prevent accidental loss &amp; take backups</p>
            </div>
          </div>
          <button id="btn-close-storage-settings" class="settings-close-btn" title="Close Settings">&times;</button>
        </div>

        <!-- Scrollable Body -->
        <div class="settings-body">

          <!-- Section 1: Storage Location & Persistent Lock -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="card-icon-title">
                <span class="card-emoji">💾</span>
                <div>
                  <h4>Where Your Notes Live</h4>
                  <span id="storage-location-badge" class="location-badge badge-internal">Device Storage Vault</span>
                </div>
              </div>
              <div id="persist-lock-status" class="lock-indicator locked" title="Protected against browser clearing">
                <span class="lock-dot">●</span>
                <span id="persist-lock-text">Protected Vault</span>
              </div>
            </div>

            <p class="settings-desc">
              Your notebooks, ink strokes and drawings are saved securely on this device. They stay right here on your computer and never disappear when you close the tab.
            </p>

            <div class="location-details-box">
              <div class="loc-row">
                <span class="loc-label">Active Storage:</span>
                <span id="active-storage-path" class="loc-val">Browser Device Vault (Fast &amp; Private)</span>
              </div>
              <div class="loc-row" id="folder-permission-row" style="display: none;">
                <span class="loc-label">Hard Drive Folder:</span>
                <span id="active-folder-name" class="loc-val font-mono">None</span>
              </div>
            </div>

            <div class="settings-btn-group">
              <button id="btn-select-folder" class="btn btn-primary-glass">
                📁 Choose Hard Drive Folder
              </button>
              <button id="btn-request-persist" class="btn btn-secondary-glass" title="Lock data so browser cleaner tools cannot wipe it">
                🔒 Safe-Lock Storage
              </button>
            </div>
            <p class="settings-hint">
              💡 <em>Safe Transition:</em> When you choose a hard drive folder, the app automatically copies all your existing notes over first so nothing is ever lost.
            </p>
          </div>

          <!-- Section 2: Live Content & Storage Breakdown -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="card-icon-title">
                <span class="card-emoji">📊</span>
                <div>
                  <h4>What's In Your Vault</h4>
                  <p class="card-sub">Live breakdown of your content and space</p>
                </div>
              </div>
              <span id="storage-total-pill" class="storage-pill">Calculating...</span>
            </div>

            <div class="metrics-grid">
              <div class="metric-box">
                <span class="metric-number" id="metric-notebooks">-</span>
                <span class="metric-label">Notebooks</span>
              </div>
              <div class="metric-box">
                <span class="metric-number" id="metric-sections">-</span>
                <span class="metric-label">Sections</span>
              </div>
              <div class="metric-box">
                <span class="metric-number" id="metric-pages">-</span>
                <span class="metric-label">Pages</span>
              </div>
              <div class="metric-box">
                <span class="metric-number" id="metric-strokes">-</span>
                <span class="metric-label">Ink Strokes</span>
              </div>
              <div class="metric-box">
                <span class="metric-number" id="metric-assets">-</span>
                <span class="metric-label">Images &amp; PDFs</span>
              </div>
              <div class="metric-box">
                <span class="metric-number" id="metric-size">-</span>
                <span class="metric-label">Total Size</span>
              </div>
            </div>
          </div>

          <!-- Section 3: Notebook & File Explorer (Full Management) -->
          <div class="settings-card explorer-card">
            <div class="settings-card-header">
              <div class="card-icon-title">
                <span class="card-emoji">📁</span>
                <div>
                  <h4>Notebook &amp; File Explorer</h4>
                  <p class="card-sub">Manage notebooks, sections, and pages like real files</p>
                </div>
              </div>
              <button id="btn-explorer-new-nb" class="btn btn-sm btn-primary-glass">➕ New Notebook</button>
            </div>

            <p class="settings-desc">
              Full hierarchy management. Drag &amp; drop to move items between notebooks or sections, or use the quick action buttons to rename, duplicate, or delete.
            </p>

            <div id="explorer-tree" class="explorer-tree-view">
              <!-- Populated dynamically with interactive folder tree -->
            </div>
          </div>

          <!-- Section 4: One-Click Backup & Restore -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="card-icon-title">
                <span class="card-emoji">📦</span>
                <div>
                  <h4>Backup &amp; Restore</h4>
                  <p class="card-sub">Export or import a complete backup anytime</p>
                </div>
              </div>
            </div>

            <p class="settings-desc">
              Download all your notebooks, sketches, math formulas and pages into a single portable <code>.notes</code> file. You can keep it on a USB stick or transfer it between machines anytime.
            </p>

            <div class="settings-btn-group">
              <button id="btn-export-backup" class="btn btn-accent-gradient">
                ⬇ Download Full Backup (.notes)
              </button>
              <label class="btn btn-secondary-glass file-upload-btn">
                ⬆ Restore From Backup
                <input type="file" id="import-backup-input" accept=".notes,.json" style="display:none;">
              </label>
            </div>
          </div>

          <!-- Section 4: App Installation & Standalone Experience -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="card-icon-title">
                <span class="card-emoji">📲</span>
                <div>
                  <h4>App Installation &amp; Offline Experience</h4>
                  <p class="card-sub" id="pwa-install-status">Checking mode...</p>
                </div>
              </div>
            </div>
            <p class="settings-desc">
              Install Notes App directly onto your Windows 11 PC, Mac, or iPad Home Screen. Enjoy a zero-distraction fullscreen canvas with zero browser URL bars, low-latency Apple Pencil inking, and 100% offline capability in Airplane Mode.
            </p>
            <div class="settings-btn-group">
              <button id="btn-modal-install-app" class="btn btn-primary-glass">
                ⬇ Install Desktop / iPad App
              </button>
            </div>
          </div>

          <!-- Section 5: Display & Interface Preferences -->
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="card-icon-title">
                <span class="card-emoji">🎨</span>
                <div>
                  <h4>Display &amp; Interface Preferences</h4>
                  <p class="card-sub">Customize on-screen controls and visual helpers</p>
                </div>
              </div>
            </div>
            <div class="location-details-box" style="margin-top: 10px;">
              <label class="pref-toggle-row" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                <div>
                  <strong style="font-size: 0.9rem; color: var(--text-main);">Floating Mode Switch Button</strong>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">Quick-switch button between Navigate and Ink modes on canvas</div>
                </div>
                <input type="checkbox" id="toggle-floating-puck" checked style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-color, #2563eb);">
              </label>
            </div>
          </div>

          <!-- Section 6: Cloud Sync (Collapsible) -->
          <div class="settings-card cloud-card">
            <details class="cloud-sync-details">
              <summary class="cloud-summary">
                <div class="cloud-summary-title">
                  <span class="card-emoji">☁️</span>
                  <div>
                    <strong>Cloudflare R2 / S3 Cloud Sync (Optional)</strong>
                    <div class="cloud-sub">Sync across multiple devices with private zero-cost cloud storage</div>
                  </div>
                </div>
                <span class="cloud-chevron">▾</span>
              </summary>
              <div class="cloud-form-content">
                <div class="form-group">
                  <label>R2 Account ID / Endpoint:</label>
                  <input type="text" id="r2-endpoint" placeholder="e.g. https://<account_id>.r2.cloudflarestorage.com">
                </div>
                <div class="form-row-2">
                  <div class="form-group">
                    <label>Access Key ID:</label>
                    <input type="password" id="r2-key-id" placeholder="Access Key ID">
                  </div>
                  <div class="form-group">
                    <label>Secret Access Key:</label>
                    <input type="password" id="r2-key-secret" placeholder="Secret Access Key">
                  </div>
                </div>
                <div class="form-group">
                  <label>Bucket Name:</label>
                  <input type="text" id="r2-bucket" placeholder="e.g. notes-app-sync">
                </div>
                <div class="cloud-actions">
                  <button id="r2-save-btn" class="btn btn-sm btn-primary-glass">Save Cloud Credentials</button>
                </div>
              </div>
            </details>
          </div>

        </div>

      </div>
    </div>
  `;
}
