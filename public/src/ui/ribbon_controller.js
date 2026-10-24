// Word-Style Formatting Ribbon Controller (Home vs Insert Tabs)

export function setupRibbonTabs() {
  const homeTabBtn = document.getElementById('tab-btn-home');
  const insertTabBtn = document.getElementById('tab-btn-insert');
  const ribbonBar = document.getElementById('ribbon-bar');
  const textGroup = document.getElementById('ribbon-text-group');
  const insertCluster = document.querySelector('.insert-cluster');

  const switchTab = (tab) => {
    if (ribbonBar) {
      ribbonBar.setAttribute('data-tab', tab);
    }
    if (tab === 'home') {
      homeTabBtn?.classList.add('active');
      insertTabBtn?.classList.remove('active');
      if (textGroup) textGroup.style.display = 'flex';
      if (insertCluster) insertCluster.style.display = 'none';
    } else {
      insertTabBtn?.classList.add('active');
      homeTabBtn?.classList.remove('active');
      if (textGroup) textGroup.style.display = 'none';
      if (insertCluster) insertCluster.style.display = 'flex';
    }
  };

  const onHomeClick = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    switchTab('home');
  };

  const onInsertClick = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    switchTab('insert');
  };

  homeTabBtn?.addEventListener('click', onHomeClick);
  homeTabBtn?.addEventListener('pointerdown', (e) => e?.stopPropagation());

  insertTabBtn?.addEventListener('click', onInsertClick);
  insertTabBtn?.addEventListener('pointerdown', (e) => e?.stopPropagation());

  // Auto-switch to Home (Text Formatting) tab when typing in notes
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.closest && e.target.closest('.note-item-text')) {
      switchTab('home');
    }
  });

  // Default view: Home tab
  switchTab('home');

  return { switchTab };
}
