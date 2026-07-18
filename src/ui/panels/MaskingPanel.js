import { Slider } from '../components/Slider';
import { Toast } from '../components/Toast';

export class MaskingPanel {
  constructor(container, editState, viewport) {
    this.container = container;
    this.editState = editState;
    this.viewport = viewport;
    this.sliders = {};
    
    this.init();
    
    // Subscribe to state updates
    this.unsubscribe = this.editState.onChange(state => this.syncUI(state));
  }

  init() {
    this.container.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'masking-panel flex-column gap-md';
    panel.style.padding = '12px';
    
    // Row 1: Add Mask Buttons & Show Overlay Checkbox
    const controlsRow = document.createElement('div');
    controlsRow.className = 'flex-column gap-sm';
    
    const addLabel = document.createElement('div');
    addLabel.style.fontSize = 'var(--font-size-xs)';
    addLabel.style.color = 'var(--text-secondary)';
    addLabel.style.fontWeight = '600';
    addLabel.textContent = 'CREATE LOCAL MASK';
    controlsRow.appendChild(addLabel);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex-row gap-xs';
    btnGroup.style.width = '100%';
    
    const maskTypes = [
      { type: 'brush', label: '🖌️ Brush' },
      { type: 'linear', label: '📈 Linear' },
      { type: 'radial', label: '🎯 Radial' }
    ];
    
    maskTypes.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.style.flex = '1';
      btn.style.fontSize = 'var(--font-size-xs)';
      btn.style.padding = '6px 4px';
      btn.textContent = t.label;
      btn.addEventListener('click', () => this.createNewMask(t.type));
      btnGroup.appendChild(btn);
    });
    controlsRow.appendChild(btnGroup);

    // Show Overlay Toggle
    const overlayRow = document.createElement('label');
    overlayRow.className = 'flex-row gap-sm align-center';
    overlayRow.style.cursor = 'pointer';
    overlayRow.style.fontSize = 'var(--font-size-sm)';
    overlayRow.style.marginTop = '4px';

    const overlayCheck = document.createElement('input');
    overlayCheck.type = 'checkbox';
    overlayCheck.style.accentColor = 'var(--accent-color)';
    overlayCheck.addEventListener('change', (e) => {
      this.editState.set('showOverlay', e.target.checked);
      this.viewport.draw();
    });
    this.overlayCheck = overlayCheck;

    const overlayText = document.createElement('span');
    overlayText.textContent = 'Show Ruby Mask Overlay (O)';
    overlayText.style.color = 'var(--text-secondary)';
    
    overlayRow.appendChild(overlayCheck);
    overlayRow.appendChild(overlayText);
    controlsRow.appendChild(overlayRow);
    
    panel.appendChild(controlsRow);
    
    // Divider
    const hr = document.createElement('div');
    hr.style.height = '1px';
    hr.style.backgroundColor = 'var(--border-color)';
    panel.appendChild(hr);

    // Row 2: Mask Layers List
    const layersLabel = document.createElement('div');
    layersLabel.style.fontSize = 'var(--font-size-xs)';
    layersLabel.style.color = 'var(--text-secondary)';
    layersLabel.style.fontWeight = '600';
    layersLabel.textContent = 'MASK LAYERS';
    panel.appendChild(layersLabel);

    const layersList = document.createElement('div');
    layersList.className = 'flex-column gap-xs';
    layersList.style.maxHeight = '140px';
    layersList.style.overflowY = 'auto';
    this.layersList = layersList;
    panel.appendChild(layersList);

    // Divider
    const hr2 = document.createElement('div');
    hr2.style.height = '1px';
    hr2.style.backgroundColor = 'var(--border-color)';
    panel.appendChild(hr2);

    // Row 3: Adjustments sliders container (visible only when active mask exists)
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'flex-column gap-md';
    this.settingsContainer = settingsContainer;
    panel.appendChild(settingsContainer);
    
    this.container.appendChild(panel);
    
    // Setup sliders
    this.buildSliders();
    
    // Initial sync
    this.syncUI(this.editState.get());
  }

  createNewMask(type) {
    const state = this.editState.get();
    const id = `mask-${Date.now()}`;
    const name = `Mask ${state.masks.length + 1} (${type.charAt(0).toUpperCase() + type.slice(1)})`;
    
    const w = this.viewport.imageWidth || 1024;
    const h = this.viewport.imageHeight || 1024;
    
    // Create offscreen mask canvas
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h); // Default completely unmasked

    const newMask = {
      id,
      name,
      type,
      visible: true,
      canvas,
      brushSize: 50,
      brushFeather: 50,
      // Default localized sliders
      settings: {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        temperature: 0,
        tint: 0,
        saturation: 0,
        clarity: 0
      },
      // Default coordinates (placed center)
      startPoint: { x: 0.3, y: 0.5 },
      endPoint: { x: 0.7, y: 0.5 },
      center: { x: 0.5, y: 0.5 },
      radiusX: 0.15,
      radiusY: 0.15,
      feather: 50
    };

    const updatedMasks = [...state.masks, newMask];
    this.editState.set('masks', updatedMasks);
    this.editState.set('activeMaskId', id);
    this.editState.set('showOverlay', true);
    
    // Enter edit mode on viewport
    this.viewport.setMaskEditingMode(id);
    
    Toast.success(`Created ${name}`);
  }

  buildSliders() {
    const updateSetting = (key, val) => {
      const state = this.editState.get();
      const activeId = state.activeMaskId;
      if (!activeId) return;
      
      const updatedMasks = state.masks.map(m => {
        if (m.id === activeId) {
          const s = { ...m.settings, [key]: val };
          return { ...m, settings: s };
        }
        return m;
      });
      
      this.editState.set('masks', updatedMasks);
      this.viewport.draw();
    };

    this.sliders.exposure = new Slider({
      label: 'Exposure', min: -3.0, max: 3.0, step: 0.05, defaultValue: 0,
      onChange: (val) => updateSetting('exposure', val)
    });
    this.sliders.contrast = new Slider({
      label: 'Contrast', min: -100, max: 100, step: 1, defaultValue: 0,
      onChange: (val) => updateSetting('contrast', val)
    });
    this.sliders.temperature = new Slider({
      label: 'Temp', min: -100, max: 100, step: 1, defaultValue: 0,
      onChange: (val) => updateSetting('temperature', val)
    });
    this.sliders.tint = new Slider({
      label: 'Tint', min: -100, max: 100, step: 1, defaultValue: 0,
      onChange: (val) => updateSetting('tint', val)
    });
    this.sliders.saturation = new Slider({
      label: 'Saturation', min: -100, max: 100, step: 1, defaultValue: 0,
      onChange: (val) => updateSetting('saturation', val)
    });
    this.sliders.clarity = new Slider({
      label: 'Clarity', min: -100, max: 100, step: 1, defaultValue: 0,
      onChange: (val) => updateSetting('clarity', val)
    });

    // Brush-specific sliders
    this.sliders.brushSize = new Slider({
      label: 'Brush Size', min: 5, max: 300, step: 1, defaultValue: 50,
      onChange: (val) => {
        const state = this.editState.get();
        const activeId = state.activeMaskId;
        if (!activeId) return;
        const updated = state.masks.map(m => m.id === activeId ? { ...m, brushSize: val } : m);
        this.editState.set('masks', updated);
        this.viewport.draw();
      }
    });

    this.sliders.brushFeather = new Slider({
      label: 'Brush Feather', min: 0, max: 100, step: 1, defaultValue: 50,
      onChange: (val) => {
        const state = this.editState.get();
        const activeId = state.activeMaskId;
        if (!activeId) return;
        const updated = state.masks.map(m => m.id === activeId ? { ...m, brushFeather: val } : m);
        this.editState.set('masks', updated);
        this.viewport.draw();
      }
    });
  }

  syncUI(state) {
    if (!this.layersList) return;

    this.overlayCheck.checked = !!state.showOverlay;

    // Render layers
    this.layersList.innerHTML = '';
    
    if (state.masks.length === 0) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.style.fontSize = 'var(--font-size-xs)';
      empty.style.padding = '8px 0';
      empty.textContent = 'No local mask adjustments';
      this.layersList.appendChild(empty);
      
      this.settingsContainer.style.display = 'none';
      return;
    }

    this.settingsContainer.style.display = 'flex';

    state.masks.forEach(mask => {
      const item = document.createElement('div');
      item.className = `flex-between align-center p-xs rounded ${state.activeMaskId === mask.id ? 'active' : ''}`;
      item.style.padding = '6px 8px';
      item.style.backgroundColor = state.activeMaskId === mask.id ? 'var(--border-color)' : 'transparent';
      item.style.cursor = 'pointer';
      item.style.transition = 'background-color 0.2s';
      
      // Left side: icon & name
      const left = document.createElement('div');
      left.className = 'flex-row gap-xs align-center';
      left.style.fontSize = 'var(--font-size-xs)';
      left.style.color = mask.visible ? 'var(--text-primary)' : 'var(--text-secondary)';
      
      let icon = '🖌️';
      if (mask.type === 'linear') icon = '📈';
      if (mask.type === 'radial') icon = '🎯';
      
      left.innerHTML = `<span>${icon}</span> <span>${mask.name}</span>`;
      
      // Select layer on click
      item.addEventListener('click', (e) => {
        // Prevent trigger if clicking actions
        if (e.target.closest('.action-btn')) return;
        this.editState.set('activeMaskId', mask.id);
        this.viewport.setMaskEditingMode(mask.id);
      });
      item.appendChild(left);

      // Right side: toggle eye & delete
      const right = document.createElement('div');
      right.className = 'flex-row gap-xs';
      
      // Visibility Eye Toggle
      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'btn btn-ghost action-btn';
      eyeBtn.style.padding = '2px';
      eyeBtn.style.fontSize = 'var(--font-size-xs)';
      eyeBtn.textContent = mask.visible ? '👁️' : '👁️‍🗨️';
      eyeBtn.title = 'Toggle Visibility';
      eyeBtn.addEventListener('click', () => {
        const updated = state.masks.map(m => m.id === mask.id ? { ...m, visible: !m.visible } : m);
        // Wait, if visible is toggled off, how does shader know?
        // We set the canvas reference to null or let it render black. 
        // Let's implement this: in WebGLRenderer, if mask.visible is false, we skip applying adjustments!
        // This is handled by verifying mask.visible is true in WebGLRenderer!
        // Let's make sure our WebGLRenderer code checks `if (!mask.canvas || !mask.visible) continue;`
        // Oh yes! In WebGLRenderer line 150: `if (!mask.canvas || !mask.visible) continue;`
        // Let's double check if we wrote that in WebGLRenderer. We wrote `if (!mask.canvas) continue;`.
        // Let's update that to check `!mask.canvas || mask.visible === false`!
        const vis = !mask.visible;
        const updatedMasks = state.masks.map(m => m.id === mask.id ? { ...m, visible: vis } : m);
        this.editState.set('masks', updatedMasks);
        this.viewport.draw();
      });
      right.appendChild(eyeBtn);

      // Delete trash
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost action-btn';
      delBtn.style.padding = '2px';
      delBtn.style.fontSize = 'var(--font-size-xs)';
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete Mask';
      delBtn.addEventListener('click', () => {
        const updated = state.masks.filter(m => m.id !== mask.id);
        const nextActive = updated.length > 0 ? updated[updated.length - 1].id : null;
        
        this.editState.set('masks', updated);
        this.editState.set('activeMaskId', nextActive);
        
        if (nextActive) {
          this.viewport.setMaskEditingMode(nextActive);
        } else {
          this.viewport.clearMaskEditingMode();
        }
        Toast.success('Mask deleted.');
      });
      right.appendChild(delBtn);

      item.appendChild(right);
      this.layersList.appendChild(item);
    });

    // Populate active mask settings sliders
    const activeMask = state.masks.find(m => m.id === state.activeMaskId);
    if (!activeMask) {
      this.settingsContainer.style.display = 'none';
      return;
    }

    this.settingsContainer.innerHTML = '';
    
    const settingsHeader = document.createElement('div');
    settingsHeader.className = 'flex-between align-center';
    settingsHeader.style.marginBottom = '4px';
    
    const settingsTitle = document.createElement('span');
    settingsTitle.style.fontSize = 'var(--font-size-xs)';
    settingsTitle.style.color = 'var(--text-secondary)';
    settingsTitle.style.fontWeight = '600';
    settingsTitle.textContent = `MASK ADJUSTMENTS`;
    settingsHeader.appendChild(settingsTitle);
    
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-ghost';
    resetBtn.style.fontSize = 'var(--font-size-xs)';
    resetBtn.style.padding = '2px 6px';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      const updated = state.masks.map(m => {
        if (m.id === activeMask.id) {
          const defaultSettings = {
            exposure: 0, contrast: 0, highlights: 0, shadows: 0,
            whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 0, clarity: 0
          };
          return { ...m, settings: defaultSettings };
        }
        return m;
      });
      this.editState.set('masks', updated);
      this.viewport.draw();
    });
    settingsHeader.appendChild(resetBtn);
    this.settingsContainer.appendChild(settingsHeader);

    // Sync values and append slider elements
    const s = activeMask.settings;
    this.sliders.exposure.setValue(s.exposure);
    this.sliders.contrast.setValue(s.contrast);
    this.sliders.temperature.setValue(s.temperature);
    this.sliders.tint.setValue(s.tint);
    this.sliders.saturation.setValue(s.saturation);
    this.sliders.clarity.setValue(s.clarity);
    
    this.settingsContainer.appendChild(this.sliders.exposure.element);
    this.settingsContainer.appendChild(this.sliders.contrast.element);
    this.settingsContainer.appendChild(this.sliders.temperature.element);
    this.settingsContainer.appendChild(this.sliders.tint.element);
    this.settingsContainer.appendChild(this.sliders.saturation.element);
    this.settingsContainer.appendChild(this.sliders.clarity.element);

    // Brush parameter sliders (Brush specific)
    if (activeMask.type === 'brush') {
      const brushTitle = document.createElement('div');
      brushTitle.style.fontSize = 'var(--font-size-xs)';
      brushTitle.style.color = 'var(--text-secondary)';
      brushTitle.style.fontWeight = '600';
      brushTitle.style.marginTop = '8px';
      brushTitle.textContent = `BRUSH SETTINGS`;
      this.settingsContainer.appendChild(brushTitle);

      this.sliders.brushSize.setValue(activeMask.brushSize);
      this.sliders.brushFeather.setValue(activeMask.brushFeather);
      
      this.settingsContainer.appendChild(this.sliders.brushSize.element);
      this.settingsContainer.appendChild(this.sliders.brushFeather.element);
    }
  }

  destroy() {
    this.unsubscribe();
  }
}
