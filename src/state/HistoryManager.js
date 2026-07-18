export class HistoryManager {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.undoStack = [];
    this.redoStack = [];
  }

  // Push current state onto undo stack
  push(state) {
    const serialized = JSON.stringify(state);
    
    // Don't push duplicates of the last state
    if (this.undoStack.length > 0) {
      const last = JSON.stringify(this.undoStack[this.undoStack.length - 1]);
      if (last === serialized) return;
    }

    this.undoStack.push(JSON.parse(serialized));
    this.redoStack = []; // Clear redo stack on new action

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift(); // Remove oldest
    }
  }

  // Undo action: returns previous state or null
  undo(currentState) {
    if (this.undoStack.length === 0) return null;
    
    const previousState = this.undoStack.pop();
    this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
    
    return previousState;
  }

  // Redo action: returns next state or null
  redo(currentState) {
    if (this.redoStack.length === 0) return null;
    
    const nextState = this.redoStack.pop();
    this.undoStack.push(JSON.parse(JSON.stringify(currentState)));
    
    return nextState;
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
}
