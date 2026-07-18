import { savePreset, getPresets } from '../supabase/database';

export const BUILT_IN_PRESETS = [
  {
    id: 'preset-bw',
    name: 'Classic B&W',
    category: 'Built-in',
    settings: {
      basic: { saturation: -100, contrast: 25, highlights: -10, shadows: 15, whites: 10, blacks: -5, exposure: 0, temperature: 6500, tint: 0, vibrance: 0, clarity: 15 },
      curve: { rgb: [[0, 0], [50, 40], [200, 215], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] },
      vignette: { amount: -10, midpoint: 50, roundness: 0, feather: 50 }
    }
  },
  {
    id: 'preset-cinematic',
    name: 'Teal & Orange',
    category: 'Built-in',
    settings: {
      basic: { temperature: 7200, tint: 8, exposure: 0.1, contrast: 15, highlights: -15, shadows: 10, whites: 5, blacks: -5, vibrance: 20, saturation: 2, clarity: 10 },
      hsl: {
        red: { h: 5, s: 10, l: 0 },
        orange: { h: -5, s: 20, l: 5 },
        yellow: { h: -10, s: -10, l: 0 },
        green: { h: 0, s: -30, l: 0 },
        aqua: { h: -10, s: 25, l: 0 },
        blue: { h: -15, s: 15, l: -5 },
        purple: { h: 0, s: -20, l: 0 },
        magenta: { h: 0, s: -20, l: 0 }
      },
      vignette: { amount: -15, midpoint: 40, roundness: 5, feather: 60 }
    }
  },
  {
    id: 'preset-film',
    name: 'Film Fade',
    category: 'Built-in',
    settings: {
      basic: { contrast: -10, exposure: 0.05, highlights: -25, shadows: 20, whites: -15, blacks: 30, temperature: 6200, tint: -2, vibrance: 10, saturation: -5, clarity: 5 },
      curve: {
        rgb: [[0, 20], [50, 55], [200, 230], [255, 240]], // Raised black point, lowered white point
        r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]]
      },
      vignette: { amount: -20, midpoint: 50, roundness: 0, feather: 50 }
    }
  },
  {
    id: 'preset-vivid',
    name: 'Vivid Pop',
    category: 'Built-in',
    settings: {
      basic: { vibrance: 30, saturation: 5, contrast: 15, clarity: 20, exposure: 0, highlights: -5, shadows: 10, whites: 10, blacks: -10, temperature: 6500, tint: 0 },
      curve: { rgb: [[0, 0], [60, 45], [195, 210], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] }
    }
  },
  {
    id: 'preset-golden',
    name: 'Golden Hour',
    category: 'Built-in',
    settings: {
      basic: { temperature: 8000, tint: 12, exposure: 0.1, contrast: 10, highlights: -12, shadows: 15, whites: 5, blacks: -5, vibrance: 15, saturation: 5, clarity: 5 }
    }
  },
  {
    id: 'preset-moody',
    name: 'Moody Dark',
    category: 'Built-in',
    settings: {
      basic: { exposure: -0.6, contrast: 25, highlights: -35, shadows: -15, whites: -5, blacks: -10, temperature: 5800, tint: -5, vibrance: -15, saturation: -10, clarity: 25 },
      vignette: { amount: -35, midpoint: 30, roundness: 0, feather: 70 }
    }
  }
];

export class PresetManager {
  constructor(userId = null) {
    this.userId = userId;
    this.copiedSettings = null;
  }

  // Update user ID when auth state changes
  setUserId(userId) {
    this.userId = userId;
  }

  // Get all presets (built-in + user presets from DB)
  async getAllPresets() {
    const list = [...BUILT_IN_PRESETS];
    if (this.userId) {
      const { data, error } = await getPresets(this.userId);
      if (data && !error) {
        list.push(...data.map(p => ({
          id: p.id,
          name: p.name,
          category: 'User Presets',
          settings: p.settings
        })));
      }
    }
    return list;
  }

  // Save current settings as a user preset
  async createUserPreset(name, editState) {
    if (!this.userId) return { error: new Error('User must be logged in') };
    
    // We only save basic adjustments, curves, HSL, and vignette in presets
    const settingsToSave = {
      basic: { ...editState.basic },
      curve: { ...editState.curve },
      hsl: { ...editState.hsl },
      vignette: { ...editState.vignette }
    };

    const { data, error } = await savePreset(this.userId, name, settingsToSave);
    if (error) return { error };

    return {
      preset: {
        id: data.id,
        name: data.name,
        category: 'User Presets',
        settings: data.settings
      },
      error: null
    };
  }

  // Copy settings from current state
  copySettings(editState) {
    this.copiedSettings = {
      basic: JSON.parse(JSON.stringify(editState.basic)),
      curve: JSON.parse(JSON.stringify(editState.curve)),
      hsl: JSON.parse(JSON.stringify(editState.hsl)),
      vignette: JSON.parse(JSON.stringify(editState.vignette))
    };
  }

  // Paste settings into destination state
  pasteSettings(editState) {
    if (!this.copiedSettings) return false;
    
    // Merge copied properties into editState
    const current = editState.get();
    const merged = {
      ...current,
      basic: { ...current.basic, ...this.copiedSettings.basic },
      curve: { ...current.curve, ...this.copiedSettings.curve },
      hsl: { ...current.hsl, ...this.copiedSettings.hsl },
      vignette: { ...current.vignette, ...this.copiedSettings.vignette }
    };
    
    editState.setAll(merged);
    return true;
  }

  hasCopiedSettings() {
    return this.copiedSettings !== null;
  }
}
