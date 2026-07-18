import { Slider } from '../components/Slider';
import { Toast } from '../components/Toast';

export class HealingBlurPanel {
  constructor(container, editState, viewport) {
    this.container = container;
    this.editState = editState;
    this.viewport = viewport;
    this.sliders = {};
    
    this.init();
    
    // Subscribe to state updates to sync sliders
    this.unsubscribe = this.editState.onChange(state => this.syncUI(state));
  }

  init() {
    this.container.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'healing-blur-panel flex-column gap-md';
    panel.style.padding = '12px';
    
    // --- SECTION 1: HEALING BRUSH 🧹 ---
    const healSec = document.createElement('div');
    healSec.className = 'flex-column gap-sm';
    
    const healHeader = document.createElement('div');
    healHeader.className = 'flex-between align-center';
    healHeader.style.marginBottom = '4px';
    
    const healTitle = document.createElement('div');
    healTitle.style.fontSize = 'var(--font-size-xs)';
    healTitle.style.fontWeight = '700';
    healTitle.style.color = 'var(--text-secondary)';
    healTitle.textContent = 'HEALING BRUSH 🧹';
    healHeader.appendChild(healTitle);
    
    // Toggle active tool button
    const healToggleBtn = document.createElement('button');
    healToggleBtn.className = 'btn btn-ghost';
    healToggleBtn.style.fontSize = 'var(--font-size-xs)';
    healToggleBtn.style.padding = '4px 8px';
    healToggleBtn.textContent = 'Activate Brush';
    healToggleBtn.addEventListener('click', () => {
      const state = this.editState.get();
      if (state.activeTool === 'healing') {
        this.editState.set('activeTool', 'adjustments');
        Toast.info('Adjustments mode active.');
      } else {
        // Reset active mask selection if editing masks
        this.editState.set('activeMaskId', null);
        this.editState.set('activeTool', 'healing');
        Toast.success('Healing Brush active. Draw over blemishes to remove them!');
      }
      this.viewport.drawGuides();
      this.syncToggleButtons();
    });
    this.healToggleBtn = healToggleBtn;
    healHeader.appendChild(healToggleBtn);
    healSec.appendChild(healHeader);

    // Sliders Container for Brush size & feather
    const healControls = document.createElement('div');
    healControls.className = 'flex-column gap-sm';
    healSec.appendChild(healControls);
    this.healControls = healControls;

    // Reset button
    const clearHealBtn = document.createElement('button');
    clearHealBtn.className = 'btn btn-ghost';
    clearHealBtn.style.width = '100%';
    clearHealBtn.style.fontSize = 'var(--font-size-xs)';
    clearHealBtn.style.marginTop = '4px';
    clearHealBtn.textContent = 'Clear All Healing';
    clearHealBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all healed regions?')) {
        // Reset original canvas
        if (this.viewport.originalCanvas && this.viewport.baseImageElement) {
          const oCtx = this.viewport.originalCanvas.getContext('2d');
          oCtx.drawImage(this.viewport.baseImageElement, 0, 0);
        }
        // Clear heal map
        if (this.viewport.healMapCanvas) {
          const hCtx = this.viewport.healMapCanvas.getContext('2d');
          hCtx.clearRect(0, 0, this.viewport.healMapCanvas.width, this.viewport.healMapCanvas.height);
        }
        // Destroy texture
        this.viewport.renderer.textures.destroyTexture('healMap');
        this.editState.set('healMapPngData', null);
        this.viewport.draw();
        Toast.success('Healing map reset.');
      }
    });
    healSec.appendChild(clearHealBtn);
    panel.appendChild(healSec);

    // Divider
    const hr = document.createElement('div');
    hr.style.height = '1px';
    hr.style.backgroundColor = 'var(--border-color)';
    panel.appendChild(hr);

    // --- SECTION 2: LENS BLUR 🔥 ---
    const blurSec = document.createElement('div');
    blurSec.className = 'flex-column gap-sm';
    
    const blurHeader = document.createElement('div');
    blurHeader.className = 'flex-between align-center';
    blurHeader.style.marginBottom = '4px';
    
    const blurTitle = document.createElement('div');
    blurTitle.style.fontSize = 'var(--font-size-xs)';
    blurTitle.style.fontWeight = '700';
    blurTitle.style.color = 'var(--text-secondary)';
    blurTitle.textContent = 'LENS BLUR 🔥';
    blurHeader.appendChild(blurTitle);

    const blurToggleBtn = document.createElement('button');
    blurToggleBtn.className = 'btn btn-ghost';
    blurToggleBtn.style.fontSize = 'var(--font-size-xs)';
    blurToggleBtn.style.padding = '4px 8px';
    blurToggleBtn.textContent = 'Set Focal Point';
    blurToggleBtn.addEventListener('click', () => {
      const state = this.editState.get();
      if (state.activeTool === 'lensblur') {
        this.editState.set('activeTool', 'adjustments');
        Toast.info('Adjustments mode active.');
      } else {
        // Reset active mask selection
        this.editState.set('activeMaskId', null);
        this.editState.set('activeTool', 'lensblur');
        // Set default focal point if none exists
        if (!state.lensBlur.focalPoint) {
          this.editState.set('lensBlur.focalPoint', { x: 0.5, y: 0.5 });
        }
        Toast.success('Click/drag on photo to position focus.');
      }
      this.viewport.drawGuides();
      this.syncToggleButtons();
    });
    this.blurToggleBtn = blurToggleBtn;
    blurHeader.appendChild(blurToggleBtn);
    blurSec.appendChild(blurHeader);

    // Info alert for focal point setting
    const alertBox = document.createElement('div');
    alertBox.style.fontSize = '11px';
    alertBox.style.padding = '6px 10px';
    alertBox.style.borderRadius = 'var(--radius-sm)';
    alertBox.style.backgroundColor = 'rgba(255, 62, 85, 0.08)';
    alertBox.style.border = '1px solid rgba(255, 62, 85, 0.2)';
    alertBox.style.color = 'var(--text-secondary)';
    alertBox.innerHTML = 'ℹ️ Click/drag on image to move the focal circle.';
    blurSec.appendChild(alertBox);

    const blurControls = document.createElement('div');
    blurControls.className = 'flex-column gap-sm';
    blurSec.appendChild(blurControls);
    this.blurControls = blurControls;

    // Bokeh Shape Selector dropdown
    const shapeRow = document.createElement('div');
    shapeRow.className = 'flex-between align-center';
    shapeRow.style.marginTop = '4px';
    
    const shapeLabel = document.createElement('span');
    shapeLabel.style.fontSize = 'var(--font-size-sm)';
    shapeLabel.style.color = 'var(--text-secondary)';
    shapeLabel.textContent = 'Bokeh Shape';
    shapeRow.appendChild(shapeLabel);
    
    const shapeSelect = document.createElement('select');
    shapeSelect.style.backgroundColor = 'var(--bg-tertiary)';
    shapeSelect.style.border = '1px solid var(--border-color)';
    shapeSelect.style.borderRadius = 'var(--radius-sm)';
    shapeSelect.style.color = 'var(--text-primary)';
    shapeSelect.style.padding = '3px 6px';
    shapeSelect.style.fontSize = 'var(--font-size-xs)';
    
    const shapes = [
      { val: 'circle', label: 'Circle 🟢' },
      { val: 'hexagon', label: 'Hexagon ⬡' }
    ];
    shapes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.val;
      opt.textContent = s.label;
      shapeSelect.appendChild(opt);
    });
    shapeSelect.addEventListener('change', (e) => {
      this.editState.set('lensBlur.bokehShape', e.target.value);
      this.viewport.draw();
    });
    this.shapeSelect = shapeSelect;
    shapeRow.appendChild(shapeSelect);
    blurSec.appendChild(shapeRow);

    panel.appendChild(blurSec);
    this.container.appendChild(panel);

    this.buildSliders();
    this.syncUI(this.editState.get());
  }

  buildSliders() {
    // 1. Healing brush size
    this.sliders.healingSize = new Slider({
      label: 'Brush Size',
      min: 5,
      max: 200,
      defaultValue: 30,
      onChange: (val) => {
        this.editState.set('healingBrushSize', val);
        this.viewport.drawGuides();
      }
    });
    this.healControls.appendChild(this.sliders.healingSize.element);

    // 2. Healing brush feather
    this.sliders.healingFeather = new Slider({
      label: 'Feather',
      min: 0,
      max: 100,
      defaultValue: 50,
      onChange: (val) => {
        this.editState.set('healingBrushFeather', val);
        this.viewport.drawGuides();
      }
    });
    this.healControls.appendChild(this.sliders.healingFeather.element);

    // 3. Lens blur amount
    this.sliders.blurAmount = new Slider({
      label: 'Blur Amount',
      min: 0,
      max: 100,
      defaultValue: 0,
      onChange: (val) => {
        this.editState.set('lensBlur.amount', val);
        this.viewport.draw();
      }
    });
    this.blurControls.appendChild(this.sliders.blurAmount.element);

    // 4. Lens blur focal radius
    this.sliders.focalRadius = new Slider({
      label: 'Focus Width',
      min: 1,
      max: 50,
      defaultValue: 10,
      onChange: (val) => {
        this.editState.set('lensBlur.focalRadius', val / 100);
        this.viewport.drawGuides();
        this.viewport.draw();
      }
    });
    this.blurControls.appendChild(this.sliders.focalRadius.element);
  }

  syncUI(state) {
    if (!state) return;
    
    // Sync slider values
    if (this.sliders.healingSize) this.sliders.healingSize.setValue(state.healingBrushSize || 30);
    if (this.sliders.healingFeather) this.sliders.healingFeather.setValue(state.healingBrushFeather || 50);
    if (this.sliders.blurAmount) this.sliders.blurAmount.setValue(state.lensBlur?.amount || 0);
    if (this.sliders.focalRadius) this.sliders.focalRadius.setValue(Math.round((state.lensBlur?.focalRadius || 0.1) * 100));

    // Sync bokeh shape select
    if (this.shapeSelect && state.lensBlur?.bokehShape) {
      this.shapeSelect.value = state.lensBlur.bokehShape;
    }

    this.syncToggleButtons();
  }

  syncToggleButtons() {
    const state = this.editState.get();
    
    // Sync healing active style
    if (this.healToggleBtn) {
      if (state.activeTool === 'healing') {
        this.healToggleBtn.textContent = 'Active ✓';
        this.healToggleBtn.className = 'btn btn-primary';
      } else {
        this.healToggleBtn.textContent = 'Activate Brush';
        this.healToggleBtn.className = 'btn btn-ghost';
      }
    }

    // Sync lens blur active style
    if (this.blurToggleBtn) {
      if (state.activeTool === 'lensblur') {
        this.blurToggleBtn.textContent = 'Active ✓';
        this.blurToggleBtn.className = 'btn btn-primary';
      } else {
        this.blurToggleBtn.textContent = 'Set Focal Point';
        this.blurToggleBtn.className = 'btn btn-ghost';
      }
    }
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}
