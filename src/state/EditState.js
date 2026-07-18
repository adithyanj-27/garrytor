export const createDefaultState = () => ({
  basic: {
    exposure: 0,       // -5.0 to 5.0
    contrast: 0,       // -100 to 100
    highlights: 0,     // -100 to 100
    shadows: 0,        // -100 to 100
    whites: 0,         // -100 to 100
    blacks: 0,         // -100 to 100
    temperature: 6500, // 2000K to 50000K
    tint: 0,           // -150 to 150
    vibrance: 0,       // -100 to 100
    saturation: 0,     // -100 to 100
    clarity: 0         // -100 to 100
  },
  curve: {
    rgb: [[0, 0], [255, 255]],
    r: [[0, 0], [255, 255]],
    g: [[0, 0], [255, 255]],
    b: [[0, 0], [255, 255]]
  },
  hsl: {
    red: { h: 0, s: 0, l: 0 },
    orange: { h: 0, s: 0, l: 0 },
    yellow: { h: 0, s: 0, l: 0 },
    green: { h: 0, s: 0, l: 0 },
    aqua: { h: 0, s: 0, l: 0 },
    blue: { h: 0, s: 0, l: 0 },
    purple: { h: 0, s: 0, l: 0 },
    magenta: { h: 0, s: 0, l: 0 }
  },
  sharpening: {
    amount: 25,
    radius: 1.0,
    detail: 25
  },
  vignette: {
    amount: 0,        // -100 to 100
    midpoint: 50,      // 0 to 100
    roundness: 0,      // -100 to 100
    feather: 50        // 0 to 100
  },
  masks: [],
  activeMaskId: null,
  showOverlay: false,
  activeTool: 'adjustments', // adjustments, masking, healing, lensblur
  healingBrushSize: 30,      // 5 to 200
  healingBrushFeather: 50,   // 0 to 100
  healMapPngData: null,      // base64 png data URL
  lensBlur: {
    amount: 0,
    focalPoint: null,  // {x, y}
    focalRadius: 0.1,  // 0.01 to 0.5
    bokehShape: 'circle'
  },
  healingPatches: []
});

export class EditState {
  constructor() {
    this.state = createDefaultState();
    this.listeners = new Set();
  }

  // Add listener for state changes
  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  _notify() {
    this.listeners.forEach(cb => cb(this.state));
  }

  // Get current raw state
  get() {
    return this.state;
  }

  // Update a nested path value, e.g. set('basic.exposure', 0.2)
  set(path, value) {
    const parts = path.split('.');
    let current = this.state;
    
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    
    const lastKey = parts[parts.length - 1];
    
    // Only update if changed
    if (JSON.stringify(current[lastKey]) !== JSON.stringify(value)) {
      current[lastKey] = value;
      this._notify();
    }
  }

  // Set the entire state at once (e.g. applying a preset)
  setAll(newState) {
    // Save HTMLCanvasElement references before stringifying
    const canvasRefs = {};
    if (newState.masks) {
      newState.masks.forEach(m => {
        if (m.canvas) canvasRefs[m.id] = m.canvas;
      });
    }

    this.state = JSON.parse(JSON.stringify(newState));

    // Re-attach HTMLCanvasElement references
    if (this.state.masks) {
      this.state.masks.forEach(m => {
        m.canvas = canvasRefs[m.id] || null;
      });
    }

    this._notify();
  }

  // Reset to default settings
  reset() {
    this.setAll(createDefaultState());
  }

  // Deep clone state (cloning mask canvas pixel buffers for independent undo/redo)
  clone() {
    const cloned = JSON.parse(JSON.stringify(this.state));
    if (this.state.masks) {
      cloned.masks = this.state.masks.map((mask, i) => {
        const clonedMask = { ...mask };
        const originalCanvas = this.state.masks[i].canvas;
        if (originalCanvas) {
          const newCanvas = document.createElement('canvas');
          newCanvas.width = originalCanvas.width;
          newCanvas.height = originalCanvas.height;
          const ctx = newCanvas.getContext('2d');
          ctx.drawImage(originalCanvas, 0, 0);
          clonedMask.canvas = newCanvas;
        } else {
          clonedMask.canvas = null;
        }
        return clonedMask;
      });
    }
    return cloned;
  }

  // Auto-enhance generator based on a simple mock analysis
  // In production, we'd look at the actual histogram data
  autoEnhance() {
    this.setAll({
      ...this.state,
      basic: {
        ...this.state.basic,
        exposure: 0.15,
        contrast: 15,
        highlights: -20,
        shadows: 25,
        whites: 5,
        blacks: -10,
        vibrance: 12,
        saturation: 2,
        clarity: 10
      }
    });
  }
}
