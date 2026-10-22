// Hierarchical Notebook -> Section -> Page & Subpage Navigation Engine

export class HierarchyManager {
  constructor(initialData = null) {
    this.notebooks = initialData?.notebooks || [];
    this.sections = initialData?.sections || [];
    this.pages = initialData?.pages || [];
  }

  addNotebook(name, color = '#6366f1') {
    const notebook = {
      id: 'nb_' + Math.random().toString(36).substr(2, 9),
      name: name || 'Untitled Notebook',
      color,
      createdAt: Date.now()
    };
    this.notebooks.push(notebook);
    return notebook;
  }

  addSection(notebookId, name, color = '#a855f7') {
    const section = {
      id: 'sec_' + Math.random().toString(36).substr(2, 9),
      notebookId,
      name: name || 'New Section',
      color,
      createdAt: Date.now()
    };
    this.sections.push(section);
    return section;
  }

  addPage(sectionId, title = 'Untitled Page', parentPageId = null) {
    const page = {
      id: 'page_' + Math.random().toString(36).substr(2, 9),
      sectionId,
      title,
      parentPageId, // null for root page, or parent page id for subpage
      isSubpage: !!parentPageId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.pages.push(page);
    return page;
  }

  getPagesForSection(sectionId) {
    return this.pages.filter(p => p.sectionId === sectionId);
  }

  getSectionsForNotebook(notebookId) {
    return this.sections.filter(s => s.notebookId === notebookId);
  }

  deletePage(pageId) {
    // Delete page and any nested subpages
    this.pages = this.pages.filter(p => p.id !== pageId && p.parentPageId !== pageId);
  }

  deleteSection(sectionId) {
    this.sections = this.sections.filter(s => s.id !== sectionId);
    this.pages = this.pages.filter(p => p.sectionId !== sectionId);
  }

  deleteNotebook(notebookId) {
    const sectionIds = this.getSectionsForNotebook(notebookId).map(s => s.id);
    this.notebooks = this.notebooks.filter(n => n.id !== notebookId);
    this.sections = this.sections.filter(s => !sectionIds.includes(s.id));
    this.pages = this.pages.filter(p => !sectionIds.includes(p.sectionId));
  }

  toJSON() {
    return {
      notebooks: this.notebooks,
      sections: this.sections,
      pages: this.pages
    };
  }
}
