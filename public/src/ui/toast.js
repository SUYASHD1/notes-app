// Toast Notification Engine for Notes App

export function showToast(message) {
  const existing = document.querySelector('.shape-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'shape-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}
