// Document Data Model

import { Sandbox } from './sandbox.js';

export class DocumentModel {
  constructor(data = {}) {
    this.id = data.id || 'doc_' + Date.now();
    this.title = data.title || 'Untitled Note';
    this.viewport = data.viewport || { x: 0, y: 0, zoom: 1 };
    this.blocks = Array.isArray(data.blocks) ? [...data.blocks] : [];
    this.globalAnnotations = Array.isArray(data.globalAnnotations) ? [...data.globalAnnotations] : [];
    this.metadata = data.metadata || {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
  }

  addBlock(block) {
    if (!block) return null;
    const cloned = { ...block };
    if (!cloned.id) {
      cloned.id = 'block_' + Math.random().toString(36).substr(2, 9);
    }
    this.blocks.push(cloned);
    this.touch();
    return cloned;
  }

  getBlock(id) {
    return this.blocks.find(b => b.id === id) || null;
  }

  removeBlock(id) {
    const idx = this.blocks.findIndex(b => b.id === id);
    if (idx !== -1) {
      const removed = this.blocks.splice(idx, 1)[0];
      this.touch();
      return removed;
    }
    return null;
  }

  updateBlock(id, updates) {
    const block = this.getBlock(id);
    if (block && updates) {
      Object.assign(block, updates);
      this.touch();
      return block;
    }
    return null;
  }

  addAnnotation(stroke) {
    if (!stroke) return null;
    const cloned = { ...stroke };
    if (!cloned.id) {
      cloned.id = 'stroke_' + Math.random().toString(36).substr(2, 9);
    }
    this.globalAnnotations.push(cloned);
    this.touch();
    return cloned;
  }

  removeAnnotation(id) {
    const idx = this.globalAnnotations.findIndex(s => s.id === id);
    if (idx !== -1) {
      const removed = this.globalAnnotations.splice(idx, 1)[0];
      this.touch();
      return removed;
    }
    return null;
  }

  clearAnnotations() {
    this.globalAnnotations = [];
    this.touch();
  }

  touch() {
    this.metadata.updatedAt = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      viewport: this.viewport,
      blocks: this.blocks,
      globalAnnotations: this.globalAnnotations,
      metadata: this.metadata
    };
  }

  static fromJSON(raw) {
    if (typeof raw === 'string') {
      const parsed = Sandbox.parseJSON(raw, null);
      if (!parsed) return new DocumentModel();
      return new DocumentModel(parsed);
    }
    return new DocumentModel(raw);
  }
}
