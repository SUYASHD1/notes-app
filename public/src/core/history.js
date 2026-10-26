// Transactional Undo/Redo History Stack

export class Command {
  execute() {
    throw new Error('execute() must be implemented');
  }
  undo() {
    throw new Error('undo() must be implemented');
  }
}

export class HistoryManager {
  constructor(maxDepth = 200) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxDepth = maxDepth;
  }

  takeSnapshot(doc) {
    if (!doc) return null;
    return {
      blocks: JSON.parse(JSON.stringify(doc.blocks || [])),
      globalAnnotations: JSON.parse(JSON.stringify(doc.globalAnnotations || []))
    };
  }

  recordSnapshot(doc, beforeSnapshot) {
    if (!doc || !beforeSnapshot) return;
    const afterSnapshot = this.takeSnapshot(doc);
    if (JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot)) return;
    const cmd = new SnapshotCommand(doc, beforeSnapshot, afterSnapshot);
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  execute(command) {
    if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
      throw new Error('Invalid command object passed to HistoryManager');
    }
    const result = command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    return result;
  }

  undo() {
    if (!this.canUndo()) return null;
    const command = this.undoStack.pop();
    const result = command.undo();
    this.redoStack.push(command);
    return result;
  }

  redo() {
    if (!this.canRedo()) return null;
    const command = this.redoStack.pop();
    const result = command.execute();
    this.undoStack.push(command);
    return result;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  get length() {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length
    };
  }
}

export class SnapshotCommand extends Command {
  constructor(doc, beforeSnapshot, afterSnapshot) {
    super();
    this.doc = doc;
    this.beforeSnapshot = beforeSnapshot;
    this.afterSnapshot = afterSnapshot;
  }

  execute() {
    this.doc.blocks = JSON.parse(JSON.stringify(this.afterSnapshot.blocks));
    this.doc.globalAnnotations = JSON.parse(JSON.stringify(this.afterSnapshot.globalAnnotations));
    this.doc.touch();
    return true;
  }

  undo() {
    this.doc.blocks = JSON.parse(JSON.stringify(this.beforeSnapshot.blocks));
    this.doc.globalAnnotations = JSON.parse(JSON.stringify(this.beforeSnapshot.globalAnnotations));
    this.doc.touch();
    return true;
  }
}

// Built-in commands for Document manipulations
export class AddBlockCommand extends Command {
  constructor(doc, block) {
    super();
    this.doc = doc;
    this.block = block;
  }

  execute() {
    return this.doc.addBlock(this.block);
  }

  undo() {
    return this.doc.removeBlock(this.block.id);
  }
}

export class RemoveBlockCommand extends Command {
  constructor(doc, blockId) {
    super();
    this.doc = doc;
    this.blockId = blockId;
    this.removedBlock = null;
  }

  execute() {
    this.removedBlock = this.doc.getBlock(this.blockId);
    return this.doc.removeBlock(this.blockId);
  }

  undo() {
    if (this.removedBlock) {
      return this.doc.addBlock(this.removedBlock);
    }
  }
}

export class AddStrokeCommand extends Command {
  constructor(doc, stroke) {
    super();
    this.doc = doc;
    this.stroke = stroke;
  }

  execute() {
    return this.doc.addAnnotation(this.stroke);
  }

  undo() {
    return this.doc.removeAnnotation(this.stroke.id);
  }
}

export class EraseStrokesCommand extends Command {
  constructor(doc, previousStrokes, newStrokes) {
    super();
    this.doc = doc;
    this.previousStrokes = Array.isArray(previousStrokes) ? [...previousStrokes] : [];
    this.newStrokes = Array.isArray(newStrokes) ? [...newStrokes] : [];
  }

  execute() {
    this.doc.globalAnnotations = [...this.newStrokes];
    this.doc.touch();
    return this.doc.globalAnnotations;
  }

  undo() {
    this.doc.globalAnnotations = [...this.previousStrokes];
    this.doc.touch();
    return this.doc.globalAnnotations;
  }
}

