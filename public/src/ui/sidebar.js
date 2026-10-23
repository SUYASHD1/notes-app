// Sidebar & Hierarchy Controller Module
// Handles Notebook dropdown, Sections, Pages list, and Subpage indentation

import { HierarchyManager } from '../storage/hierarchy.js';

export function createDefaultHierarchy() {
  const hm = new HierarchyManager();
  const nb1 = hm.addNotebook('Physics & Calculus 101', '#6366f1');
  const sec1 = hm.addSection(nb1.id, 'Limits & Continuity', '#8b5cf6');
  const sec2 = hm.addSection(nb1.id, 'Derivatives & Rules', '#3b82f6');
  const sec3 = hm.addSection(nb1.id, 'Integrals & Area', '#10b981');

  const p1 = hm.addPage(sec1.id, 'Derivatives Intro & Graph');
  p1.id = 'nb_physics_demo_p1';
  hm.addPage(sec1.id, 'Critical Points Practice', p1.id);
  hm.addPage(sec2.id, 'Chain Rule & Composition');
  hm.addPage(sec3.id, 'Fundamental Theorem of Calculus');
  return hm;
}

export function saveHierarchy(state) {
  const tree = state.hierarchy.toJSON();
  state.vault.saveHierarchy(tree);
  try {
    localStorage.setItem('notes_app_hierarchy_v3', JSON.stringify(tree));
  } catch (_) {}
  state.vault.saveSetting('activeNotebookId', state.activeNotebookId);
  state.vault.saveSetting('activeSectionId', state.activeSectionId);
  state.vault.saveSetting('activePageId', state.activePageId);
}

export async function initHierarchy({ state, renderHierarchyUI }) {
  let savedHierarchy = await state.vault.loadHierarchy();
  if (!savedHierarchy) {
    const rawLocal = localStorage.getItem('notes_app_hierarchy_v3');
    if (rawLocal) {
      try {
        savedHierarchy = JSON.parse(rawLocal);
      } catch (_) {}
    }
  }

  if (savedHierarchy) {
    try {
      state.hierarchy = new HierarchyManager(savedHierarchy);
    } catch {
      state.hierarchy = createDefaultHierarchy();
    }
  } else {
    state.hierarchy = createDefaultHierarchy();
    saveHierarchy(state);
  }

  if (state.hierarchy.notebooks.length === 0) {
    state.hierarchy.addNotebook('Physics & Calculus 101', '#6366f1');
  }

  const savedNbId = await state.vault.getSetting('activeNotebookId');
  if (savedNbId && state.hierarchy.notebooks.some(n => n.id === savedNbId)) {
    state.activeNotebookId = savedNbId;
  } else {
    state.activeNotebookId = state.hierarchy.notebooks[0].id;
  }

  const sections = state.hierarchy.getSectionsForNotebook(state.activeNotebookId);
  if (sections.length === 0) {
    state.hierarchy.addSection(state.activeNotebookId, 'Limits & Continuity', '#8b5cf6');
  }

  const savedSecId = await state.vault.getSetting('activeSectionId');
  if (savedSecId && sections.some(s => s.id === savedSecId)) {
    state.activeSectionId = savedSecId;
  } else {
    state.activeSectionId = state.hierarchy.getSectionsForNotebook(state.activeNotebookId)[0].id;
  }

  const pages = state.hierarchy.getPagesForSection(state.activeSectionId);
  if (pages.length === 0) {
    state.hierarchy.addPage(state.activeSectionId, 'Derivatives Intro & Graph');
  }

  const savedPageId = await state.vault.getSetting('activePageId');
  if (savedPageId && pages.some(p => p.id === savedPageId)) {
    state.activePageId = savedPageId;
  } else {
    state.activePageId = state.hierarchy.getPagesForSection(state.activeSectionId)[0].id;
  }

  if (renderHierarchyUI) renderHierarchyUI();
}

export function renderHierarchyUI({
  state,
  saveActivePageDocument,
  loadActivePageDocument,
  renderAll
}) {
  // Notebooks
  const nbSelect = document.getElementById('notebook-select');
  if (nbSelect) {
    nbSelect.innerHTML = '';
    state.hierarchy.notebooks.forEach(nb => {
      const opt = document.createElement('option');
      opt.value = nb.id;
      opt.textContent = nb.name;
      if (nb.id === state.activeNotebookId) opt.selected = true;
      nbSelect.appendChild(opt);
    });
  }

  // Sections
  const sectionsList = document.getElementById('sections-list');
  if (sectionsList) {
    sectionsList.innerHTML = '';
    const sections = state.hierarchy.getSectionsForNotebook(state.activeNotebookId);
    sections.forEach(sec => {
      const li = document.createElement('li');
      li.className = `section-item ${sec.id === state.activeSectionId ? 'active' : ''}`;
      li.dataset.secId = sec.id;
      li.innerHTML = `
        <span class="section-color-dot" style="background: ${sec.color || '#6366f1'};"></span>
        <span class="item-name">${sec.name}</span>
        <button class="item-delete-btn" title="Delete Section" style="margin-left:auto; background:none; border:none; color:#94a3b8; cursor:pointer; font-size:12px;">&times;</button>
      `;

      const nameSpan = li.querySelector('.item-name');
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newName = prompt(`Rename section "${sec.name}" to:`, sec.name);
        if (newName && newName.trim() && newName.trim() !== sec.name) {
          if (state.hierarchy.isDuplicateSectionName && state.hierarchy.isDuplicateSectionName(state.activeNotebookId, newName.trim(), sec.id)) {
            if (showToast) showToast(`⚠️ A section named "${newName.trim()}" already exists in this notebook`);
          }
          state.hierarchy.renameSection(sec.id, newName.trim());
          saveHierarchy(state);
          renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
          if (showToast) showToast(`✏️ Renamed section to "${newName.trim()}"`);
        }
      });

      // Drag target: Allow dragging pages into this section
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        li.classList.add('drag-target-hover');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-target-hover'));
      li.addEventListener('drop', async (e) => {
        e.preventDefault();
        li.classList.remove('drag-target-hover');
        const draggedPageId = e.dataTransfer.getData('text/plain');
        if (draggedPageId) {
          const moved = state.hierarchy.movePage(draggedPageId, sec.id);
          if (moved) {
            saveHierarchy(state);
            renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
            if (showToast) showToast(`🚚 Moved page into "${sec.name}"`);
          }
        }
      });

      li.querySelector('.item-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete section "${sec.name}" and all its pages?`)) {
          state.hierarchy.deleteSection(sec.id);
          const rem = state.hierarchy.getSectionsForNotebook(state.activeNotebookId);
          state.activeSectionId = rem.length ? rem[0].id : null;
          const p = state.activeSectionId ? state.hierarchy.getPagesForSection(state.activeSectionId) : [];
          state.activePageId = p.length ? p[0].id : null;
          saveHierarchy(state);
          renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
          loadActivePageDocument();
          renderAll();
        }
      });

      li.addEventListener('click', async () => {
        if (state.activeSectionId === sec.id) return;
        saveActivePageDocument(state.activePageId);
        state.activeSectionId = sec.id;
        const pages = state.hierarchy.getPagesForSection(sec.id);
        state.activePageId = pages.length ? pages[0].id : null;
        renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
        await loadActivePageDocument();
        renderAll();
      });
      sectionsList.appendChild(li);
    });
  }

  // Pages
  const pagesList = document.getElementById('pages-list');
  if (pagesList) {
    pagesList.innerHTML = '';
    const pages = state.hierarchy.getPagesForSection(state.activeSectionId);
    pages.forEach(p => {
      const li = document.createElement('li');
      li.className = `page-item ${p.isSubpage ? 'subpage' : ''} ${p.id === state.activePageId ? 'active' : ''}`;
      li.dataset.pageId = p.id;
      li.draggable = true;
      li.innerHTML = `
        <span class="page-drag-grip" title="Drag to reorder or move to section">⋮⋮</span>
        ${p.isSubpage ? '<span class="subpage-indicator">↳</span>' : '<span class="page-icon">📄</span>'}
        <span class="item-name" title="Double click to rename">${p.title}</span>
        <button class="item-delete-btn" title="Delete Page" style="margin-left:auto; background:none; border:none; color:#94a3b8; cursor:pointer; font-size:12px;">&times;</button>
      `;

      // Dragging page
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'move';
        li.classList.add('page-dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('page-dragging'));

      // Double-click to rename page
      const pageTitleSpan = li.querySelector('.item-name');
      pageTitleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newTitle = prompt(`Rename page "${p.title}" to:`, p.title);
        if (newTitle && newTitle.trim() && newTitle.trim() !== p.title) {
          if (state.hierarchy.isDuplicatePageTitle && state.hierarchy.isDuplicatePageTitle(state.activeSectionId, newTitle.trim(), p.id)) {
            if (showToast) showToast(`⚠️ A page named "${newTitle.trim()}" already exists in this section`);
          }
          state.hierarchy.renamePage(p.id, newTitle.trim());
          saveHierarchy(state);
          renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
          if (showToast) showToast(`✏️ Renamed page to "${newTitle.trim()}"`);
        }
      });

      li.querySelector('.item-delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete page "${p.title}"?`)) {
          await state.vault.deletePage(p.id);
          state.hierarchy.deletePage(p.id);
          const rem = state.hierarchy.getPagesForSection(state.activeSectionId);
          state.activePageId = rem.length ? rem[0].id : null;
          saveHierarchy(state);
          renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
          await loadActivePageDocument();
          renderAll();
        }
      });

      li.addEventListener('click', async () => {
        if (state.activePageId === p.id) return;
        saveActivePageDocument(state.activePageId);
        state.activePageId = p.id;
        renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });
        await loadActivePageDocument();
        renderAll();
      });
      pagesList.appendChild(li);
    });
  }

  // Update Breadcrumb Status
  const pageStatusLabel = document.getElementById('page-status-label');
  if (pageStatusLabel) {
    const nb = state.hierarchy.notebooks.find(n => n.id === state.activeNotebookId);
    const sec = state.hierarchy.sections.find(s => s.id === state.activeSectionId);
    const page = state.hierarchy.pages.find(p => p.id === state.activePageId);
    pageStatusLabel.textContent = `${nb ? nb.name : 'Notes'} > ${sec ? sec.name : 'Section'} > ${page ? page.title : 'No Page'}`;
  }
}

export function setupSidebarControls({
  state,
  saveActivePageDocument,
  loadActivePageDocument,
  renderAll,
  showToast
}) {
  const rerender = () => renderHierarchyUI({ state, saveActivePageDocument, loadActivePageDocument, renderAll });

  // Add New Notebook Button
  document.getElementById('btn-new-notebook')?.addEventListener('click', async () => {
    saveActivePageDocument(state.activePageId);
    const defaultName = state.hierarchy.generateUniqueNotebookName ? state.hierarchy.generateUniqueNotebookName('New Notebook') : 'New Notebook';
    const name = prompt('Enter New Notebook Name:', defaultName);
    if (name && name.trim()) {
      const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const nb = state.hierarchy.addNotebook(name.trim(), color);
      const secName = state.hierarchy.generateUniqueSectionName ? state.hierarchy.generateUniqueSectionName(nb.id, 'General Notes') : 'General Notes';
      const sec = state.hierarchy.addSection(nb.id, secName, '#8b5cf6');
      const pageTitle = state.hierarchy.generateUniquePageTitle ? state.hierarchy.generateUniquePageTitle(sec.id, 'Untitled Page') : 'Untitled Page';
      const page = state.hierarchy.addPage(sec.id, pageTitle);
      state.activeNotebookId = nb.id;
      state.activeSectionId = sec.id;
      state.activePageId = page.id;
      saveHierarchy(state);
      rerender();
      await loadActivePageDocument();
      renderAll();
      if (showToast) showToast(`📓 Created notebook "${name.trim()}"`);
    }
  });

  // Rename Active Notebook Button
  document.getElementById('btn-rename-notebook')?.addEventListener('click', () => {
    const activeNb = state.hierarchy.notebooks.find(n => n.id === state.activeNotebookId);
    if (!activeNb) return;
    const newName = prompt(`Rename notebook "${activeNb.name}" to:`, activeNb.name);
    if (newName && newName.trim() && newName.trim() !== activeNb.name) {
      state.hierarchy.renameNotebook(activeNb.id, newName.trim());
      saveHierarchy(state);
      rerender();
      if (showToast) showToast(`✏️ Renamed notebook to "${newName.trim()}"`);
    }
  });

  // Delete Active Notebook Button
  document.getElementById('btn-delete-notebook')?.addEventListener('click', async () => {
    const activeNb = state.hierarchy.notebooks.find(n => n.id === state.activeNotebookId);
    if (!activeNb) return;
    if (confirm(`Delete notebook "${activeNb.name}" and ALL its sections and pages? This cannot be undone.`)) {
      state.hierarchy.deleteNotebook(activeNb.id);
      if (state.hierarchy.notebooks.length === 0) {
        const freshNb = state.hierarchy.addNotebook('My Notebook', '#6366f1');
        const freshSec = state.hierarchy.addSection(freshNb.id, 'General Notes', '#8b5cf6');
        state.hierarchy.addPage(freshSec.id, 'Untitled Page');
      }
      state.activeNotebookId = state.hierarchy.notebooks[0].id;
      const remSecs = state.hierarchy.getSectionsForNotebook(state.activeNotebookId);
      state.activeSectionId = remSecs.length ? remSecs[0].id : null;
      const remPages = state.activeSectionId ? state.hierarchy.getPagesForSection(state.activeSectionId) : [];
      state.activePageId = remPages.length ? remPages[0].id : null;
      saveHierarchy(state);
      rerender();
      await loadActivePageDocument();
      renderAll();
      if (showToast) showToast(`🗑️ Deleted notebook "${activeNb.name}"`);
    }
  });

  document.getElementById('btn-new-section')?.addEventListener('click', async () => {
    saveActivePageDocument(state.activePageId);
    const defaultSecName = state.hierarchy.generateUniqueSectionName ? state.hierarchy.generateUniqueSectionName(state.activeNotebookId, 'New Section') : 'New Section';
    const name = prompt('Enter New Section Name:', defaultSecName);
    if (name && name.trim()) {
      if (state.hierarchy.isDuplicateSectionName && state.hierarchy.isDuplicateSectionName(state.activeNotebookId, name.trim())) {
        if (showToast) showToast(`⚠️ Note: A section named "${name.trim()}" already exists in this notebook`);
      }
      const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const sec = state.hierarchy.addSection(state.activeNotebookId, name.trim(), color);
      const pageTitle = state.hierarchy.generateUniquePageTitle ? state.hierarchy.generateUniquePageTitle(sec.id, 'Untitled Page') : 'Untitled Page';
      const page = state.hierarchy.addPage(sec.id, pageTitle);
      state.activeSectionId = sec.id;
      state.activePageId = page.id;
      saveHierarchy(state);
      rerender();
      await loadActivePageDocument();
      renderAll();
      showToast(`📁 Created section "${name.trim()}"`);
    }
  });

  document.getElementById('btn-new-page')?.addEventListener('click', async () => {
    saveActivePageDocument(state.activePageId);
    const defaultTitle = state.hierarchy.generateUniquePageTitle ? state.hierarchy.generateUniquePageTitle(state.activeSectionId, 'Untitled Page') : 'Untitled Page';
    const title = prompt('Enter New Page Title:', defaultTitle);
    if (title && title.trim()) {
      if (state.hierarchy.isDuplicatePageTitle && state.hierarchy.isDuplicatePageTitle(state.activeSectionId, title.trim())) {
        if (showToast) showToast(`⚠️ Note: A page named "${title.trim()}" already exists in this section`);
      }
      const page = state.hierarchy.addPage(state.activeSectionId, title.trim());
      state.activePageId = page.id;
      saveHierarchy(state);
      rerender();
      await loadActivePageDocument();
      renderAll();
      showToast(`📄 Created blank page "${title.trim()}"`);
    }
  });

  document.getElementById('notebook-select')?.addEventListener('change', async (e) => {
    saveActivePageDocument(state.activePageId);
    state.activeNotebookId = e.target.value;
    const sections = state.hierarchy.getSectionsForNotebook(state.activeNotebookId);
    state.activeSectionId = sections.length ? sections[0].id : null;
    const pages = state.activeSectionId ? state.hierarchy.getPagesForSection(state.activeSectionId) : [];
    state.activePageId = pages.length ? pages[0].id : null;
    rerender();
    await loadActivePageDocument();
    renderAll();
  });

  document.getElementById('page-search-input')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.page-item').forEach(item => {
      const match = item.textContent.toLowerCase().includes(q);
      item.style.display = match ? 'flex' : 'none';
    });
  });
}
