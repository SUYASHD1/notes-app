// Luxury Living Inking Splash Screen Controller
// Mounts a self-contained, GPU-accelerated launch animation and dissolves into canvas

export function initSplashScreen() {
  if (typeof document === 'undefined') return { dismiss: () => {} };

  // Avoid duplicate injection
  if (document.getElementById('app-splash-overlay')) {
    return { dismiss: () => {} };
  }

  // Detect active theme
  const isDark = document.body.getAttribute('data-theme') !== 'light';
  const themeClass = isDark ? 'theme-dark' : 'theme-light';

  const overlay = document.createElement('div');
  overlay.id = 'app-splash-overlay';
  overlay.className = themeClass;

  const darkWhispers = [
    'Lighting the quiet midnight canvas...',
    'Unfolding your nocturnal pages...',
    'Ready for your thoughts...'
  ];

  const lightWhispers = [
    'Opening fresh morning paper...',
    'Filling your royal fountain pens...',
    'Ready for a productive day...'
  ];

  const whispers = isDark ? darkWhispers : lightWhispers;

  overlay.innerHTML = `
    <div class="splash-aurora"></div>
    <div class="splash-3d-stage">
      <div class="splash-ink-ripple"></div>
      <svg width="100" height="100" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="live-ink-dark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#818cf8"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
          <linearGradient id="live-ink-light" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#4f46e5"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
          <filter id="softInkGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        <rect x="8" y="10" width="48" height="44" rx="10" 
              fill="${isDark ? 'url(#live-ink-dark)' : 'url(#live-ink-light)'}" 
              fill-opacity="${isDark ? '0.16' : '0.08'}" 
              stroke="${isDark ? 'url(#live-ink-dark)' : 'url(#live-ink-light)'}" 
              stroke-width="2.5" ${isDark ? 'filter="url(#softInkGlow)"' : ''}/>
        <path d="M32 12V52" stroke="${isDark ? '#818cf8' : '#4f46e5'}" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>
        <path class="splash-draw-stroke" d="M18 36C22 30 26 24 32 24C38 24 40 32 46 22" 
              stroke="${isDark ? '#38bdf8' : '#0284c7'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="splash-nib-spark"></div>
    </div>
    <div class="splash-brand-text">Notes App</div>
    <div class="splash-whisper-text" id="app-splash-whisper">${whispers[0]}</div>
    <div class="splash-progress-track">
      <div class="splash-progress-fill"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const whisperEl = document.getElementById('app-splash-whisper');
  let step = 0;
  const whisperTimer = setInterval(() => {
    step++;
    if (step < whispers.length && whisperEl) {
      whisperEl.style.opacity = '0';
      setTimeout(() => {
        if (whisperEl) {
          whisperEl.textContent = whispers[step];
          whisperEl.style.opacity = '1';
        }
      }, 180);
    }
  }, 750);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    clearInterval(whisperTimer);
    overlay.classList.add('fade-out');
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 550);
  };

  // Safe fallback: Auto-dismiss after 2.4s so user is never blocked
  setTimeout(dismiss, 2400);

  return { dismiss };
}
