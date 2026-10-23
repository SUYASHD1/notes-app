// Install Prompt & Progressive Web App (PWA) Controller
// Manages Service Worker registration, offline caching status, and desktop/iPad install prompts

export function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function isIOSDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function registerServiceWorker(showToast) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Check if an update is found
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  if (showToast) {
                    showToast('⚡ Notes App updated! Refresh to load latest features.');
                  }
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}

export function setupInstallPrompt({ showToast }) {
  let deferredPrompt = null;
  const btnInstall = document.getElementById('btn-install-app');
  const btnModalInstall = document.getElementById('btn-modal-install-app');
  const installStatusText = document.getElementById('pwa-install-status');

  const updateUIState = () => {
    const standalone = isStandaloneMode();
    if (standalone) {
      if (btnInstall) btnInstall.style.display = 'none';
      if (installStatusText) installStatusText.textContent = 'Installed (Standalone App)';
      if (btnModalInstall) {
        btnModalInstall.textContent = '✓ Installed as Standalone App';
        btnModalInstall.disabled = true;
        btnModalInstall.classList.add('disabled');
      }
    } else {
      // In browser mode
      if (btnInstall) btnInstall.style.display = 'inline-flex';
      if (installStatusText) installStatusText.textContent = 'Web Browser Mode';
      if (btnModalInstall) {
        btnModalInstall.textContent = isIOSDevice() ? '📲 Add to iPad Home Screen' : '⬇ Install Desktop / Tablet App';
        btnModalInstall.disabled = false;
        btnModalInstall.classList.remove('disabled');
      }
    }
  };

  // Capture Chromium / Edge / Android install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = 'inline-flex';
      btnInstall.classList.add('highlight-pulse');
    }
    updateUIState();
  });

  // Listen for completed installation
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (btnInstall) {
      btnInstall.style.display = 'none';
      btnInstall.classList.remove('highlight-pulse');
    }
    updateUIState();
    if (showToast) {
      showToast('🎉 Notes App installed successfully! Launch it anytime from your desktop or home screen.');
    }
  });

  // Handler to prompt installation
  const triggerInstall = async () => {
    if (isStandaloneMode()) {
      if (showToast) showToast('✓ Notes App is already running as a standalone app!');
      return;
    }

    if (deferredPrompt) {
      // Chrome / Edge / Windows / Android native prompt
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        if (showToast) showToast('Installing Notes App...');
      } else {
        if (showToast) showToast('Installation dismissed.');
      }
      deferredPrompt = null;
    } else if (isIOSDevice()) {
      // iOS / iPadOS Safari does not support beforeinstallprompt; show visual instructions
      showIOSInstallModal();
    } else {
      // Generic desktop fallback (e.g. Firefox or already prompted)
      alert(
        'To install Notes App:\n\n' +
        '• In Google Chrome / Edge: Click the install icon (🖥) on the right side of the address bar.\n' +
        '• On iPad / iPhone: Tap the Share button ➔ "Add to Home Screen".'
      );
    }
  };

  btnInstall?.addEventListener('click', triggerInstall);
  btnModalInstall?.addEventListener('click', triggerInstall);

  // Initial check
  updateUIState();

  return { triggerInstall, isStandalone: isStandaloneMode };
}

// Visual Guide Modal for iOS Safari / iPad
export function showIOSInstallModal() {
  const existing = document.getElementById('ios-install-modal');
  if (existing) {
    existing.classList.remove('hidden');
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'ios-install-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-card ios-pwa-card" style="max-width: 480px;">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="./icons/icon-180.png" alt="App Icon" style="width: 42px; height: 42px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Install on iPad Home Screen</h3>
            <p style="margin: 2px 0 0; font-size: 0.8rem; color: #94a3b8;">Full-screen canvas with zero browser bars</p>
          </div>
        </div>
        <button id="btn-close-ios-modal" class="modal-close-btn">&times;</button>
      </div>

      <div class="modal-body" style="padding: 20px 24px; font-size: 0.95rem; line-height: 1.6; color: #e2e8f0;">
        <p style="margin-top: 0;">Follow these quick steps in Safari on your iPad:</p>
        
        <div style="display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start;">
          <div style="background: rgba(99, 102, 241, 0.2); color: #818cf8; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">1</div>
          <div>
            Tap the <strong>Share</strong> button in Safari's toolbar
            <div style="font-size: 0.82rem; color: #94a3b8;">(The square with an upward pointing arrow <span style="font-size: 1.1rem;">⎋</span>)</div>
          </div>
        </div>

        <div style="display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start;">
          <div style="background: rgba(99, 102, 241, 0.2); color: #818cf8; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">2</div>
          <div>
            Scroll down the menu and tap <strong>"Add to Home Screen"</strong> 📲
          </div>
        </div>

        <div style="display: flex; gap: 14px; margin-bottom: 20px; align-items: flex-start;">
          <div style="background: rgba(99, 102, 241, 0.2); color: #818cf8; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">3</div>
          <div>
            Tap <strong>"Add"</strong> in the top-right corner.
            <div style="font-size: 0.82rem; color: #94a3b8;">The Notes App icon will appear on your Home Screen, ready to open in pure fullscreen!</div>
          </div>
        </div>

        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 14px; font-size: 0.85rem; color: #34d399;">
          ✨ <strong>Offline Ready:</strong> Once installed, you can open and write in your notebooks anytime—even in Airplane Mode without Wi-Fi.
        </div>
      </div>

      <div class="modal-footer" style="padding: 14px 24px; display: flex; justify-content: flex-end;">
        <button id="btn-done-ios-modal" class="btn btn-primary" style="padding: 8px 20px;">Got It</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.classList.add('hidden');
  document.getElementById('btn-close-ios-modal')?.addEventListener('click', close);
  document.getElementById('btn-done-ios-modal')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}
