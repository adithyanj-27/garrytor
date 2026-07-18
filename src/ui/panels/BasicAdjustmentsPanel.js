import { Slider } from '../components/Slider';

export class BasicAdjustmentsPanel {
  constructor(container, editState, isSimpleMode = true) {
    this.container = container;
    this.editState = editState;
    this.isSimpleMode = isSimpleMode;
    this.sliders = {};
    
    this.init();
    
    // Subscribe to state updates to keep slider values in sync
    this.unsubscribe = this.editState.onChange((state) => this.syncSliders(state));
  }

  // Set view mode (Simple or Advanced)
  setSimpleMode(isSimple) {
    this.isSimpleMode = isSimple;
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.sliders = {};

    const content = document.createElement('div');
    content.className = 'panel-content-sliders';

    // Auto Enhance button at the top
    const autoEnhanceRow = document.createElement('div');
    autoEnhanceRow.style.display = 'flex';
    autoEnhanceRow.style.gap = '8px';
    autoEnhanceRow.style.marginBottom = '16px';
    
    const autoBtn = document.createElement('button');
    autoBtn.className = 'btn btn-primary';
    autoBtn.style.flex = '1';
    autoBtn.innerHTML = '✨ Auto Enhance';
    autoBtn.addEventListener('click', () => {
      this.editState.autoEnhance();
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-ghost';
    resetBtn.innerHTML = 'Reset All';
    resetBtn.addEventListener('click', () => {
      this.editState.reset();
    });

    autoEnhanceRow.appendChild(autoBtn);
    autoEnhanceRow.appendChild(resetBtn);
    content.appendChild(autoEnhanceRow);

    if (this.isSimpleMode) {
      this._createSimpleSliders(content);
    } else {
      this._createAdvancedSliders(content);
    }

    this.container.appendChild(content);
    this.syncSliders(this.editState.get());
  }

  // 4 smart sliders for beginners
  _createSimpleSliders(content) {
    // 1. Light (Exposure + Shadows + Highlights)
    this.sliders.light = new Slider({
      label: '☀️ Light',
      min: -100,
      max: 100,
      defaultValue: 0,
      onChange: (val) => {
        // Map smart values to the underlying state
        const state = this.editState.get().basic;
        this.editState.set('basic.exposure', val * 0.02);
        if (val > 0) {
          this.editState.set('basic.shadows', val * 0.5);
          this.editState.set('basic.highlights', -val * 0.15);
        } else {
          this.editState.set('basic.highlights', val * 0.5);
          this.editState.set('basic.shadows', -val * 0.15);
        }
      }
    });

    // 2. Color (Vibrance + Saturation)
    this.sliders.color = new Slider({
      label: '🎨 Color',
      min: -100,
      max: 100,
      defaultValue: 0,
      onChange: (val) => {
        this.editState.set('basic.vibrance', val * 0.6);
        this.editState.set('basic.saturation', val * 0.2);
      }
    });

    // 3. Detail (Clarity + Sharpening)
    this.sliders.detail = new Slider({
      label: '🔍 Detail',
      min: 0,
      max: 100,
      defaultValue: 0,
      onChange: (val) => {
        this.editState.set('basic.clarity', val * 0.5);
        this.editState.set('sharpening.amount', 25 + val * 0.5);
      }
    });

    // 4. Vignette
    this.sliders.vignette = new Slider({
      label: ' Vignette',
      min: -100,
      max: 100,
      defaultValue: 0,
      onChange: (val) => {
        this.editState.set('vignette.amount', val);
      }
    });

    content.appendChild(this.sliders.light.element);
    content.appendChild(this.sliders.color.element);
    content.appendChild(this.sliders.detail.element);
    content.appendChild(this.sliders.vignette.element);
  }

  // Standard Lightroom sliders for advanced users
  _createAdvancedSliders(content) {
    const sections = [
      {
        title: 'Tone',
        controls: [
          { key: 'exposure', label: 'Exposure', min: -5.0, max: 5.0, step: 0.05, defaultValue: 0 },
          { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'whites', label: 'Whites', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'blacks', label: 'Blacks', min: -100, max: 100, step: 1, defaultValue: 0 }
        ]
      },
      {
        title: 'Presence',
        controls: [
          { key: 'temperature', label: 'Temperature (K)', min: 2000, max: 20000, step: 100, defaultValue: 6500 },
          { key: 'tint', label: 'Tint', min: -150, max: 150, step: 1, defaultValue: 0 },
          { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'clarity', label: 'Clarity', min: -100, max: 100, step: 1, defaultValue: 0 }
        ]
      },
      {
        title: 'Vignette',
        controls: [
          { key: 'vig_amount', label: 'Vignette Amount', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'vig_midpoint', label: 'Midpoint', min: 0, max: 100, step: 1, defaultValue: 50 },
          { key: 'vig_roundness', label: 'Roundness', min: -100, max: 100, step: 1, defaultValue: 0 },
          { key: 'vig_feather', label: 'Feather', min: 0, max: 100, step: 1, defaultValue: 50 }
        ]
      }
    ];

    sections.forEach(sec => {
      const header = document.createElement('div');
      header.className = 'panel-section-title';
      header.style.fontSize = 'var(--font-size-xs)';
      header.style.fontWeight = '700';
      header.style.color = 'var(--text-muted)';
      header.style.textTransform = 'uppercase';
      header.style.marginTop = '16px';
      header.style.marginBottom = '8px';
      content.appendChild(header);

      sec.controls.forEach(ctrl => {
        const path = ctrl.key.startsWith('vig_') 
          ? `vignette.${ctrl.key.replace('vig_', '')}` 
          : `basic.${ctrl.key}`;

        this.sliders[ctrl.key] = new Slider({
          label: ctrl.label,
          min: ctrl.min,
          max: ctrl.max,
          step: ctrl.step,
          defaultValue: ctrl.defaultValue,
          onChange: (val) => {
            this.editState.set(path, val);
          }
        });
        
        content.appendChild(this.sliders[ctrl.key].element);
      });
    });
  }

  // Update slider positions when the central state updates (e.g. undo or auto enhance)
  syncSliders(state) {
    if (this.isSimpleMode) {
      if (this.sliders.light) {
        // Average back out to simple representation for display
        const expPct = state.basic.exposure / 0.02;
        this.sliders.light.setValue(expPct);
      }
      if (this.sliders.color) {
        this.sliders.color.setValue(state.basic.vibrance / 0.6);
      }
      if (this.sliders.detail) {
        this.sliders.detail.setValue(state.basic.clarity / 0.5);
      }
      if (this.sliders.vignette) {
        this.sliders.vignette.setValue(state.vignette.amount);
      }
    } else {
      // Sync advanced sliders
      for (const key in this.sliders) {
        if (key.startsWith('vig_')) {
          const subKey = key.replace('vig_', '');
          this.sliders[key].setValue(state.vignette[subKey]);
        } else {
          this.sliders[key].setValue(state.basic[key]);
        }
      }
    }
  }

  destroy() {
    this.unsubscribe();
  }
}
