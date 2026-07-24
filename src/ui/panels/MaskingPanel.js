import { Slider } from '../components/Slider';
import { Toast } from '../components/Toast';
import { Icons } from '../components/Icons';

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
    const maskTypes = [
      { type: 'brush', label: `${Icons.brush} Brush` },
      { type: 'linear', label: `${Icons.linearGradient} Linear` },
      { type: 'radial', label: `${Icons.radialGradient} Radial` },
      { type: 'colorRange', label: `${Icons.colorRange} Color` },
      { type: 'lumaRange', label: `${Icons.lumaRange} Luma` },
      { type: 'magicWand', label: `${Icons.magicWand} Wand` },
      { type: 'sky', label: `${Icons.sky} Sky` },
      { type: 'subject', label: `${Icons.subject} Subject` }
    ];
    
    const btnGrid = document.createElement('div');
    btnGrid.style.display = 'grid';
    btnGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    btnGrid.style.gap = '6px';
    btnGrid.style.width = '100%';
    
    maskTypes.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost flex-row gap-xs align-center justify-center';
      btn.style.fontSize = '13px';
      btn.style.fontWeight = '600';
      btn.style.padding = '8px 4px';
      btn.style.backgroundColor = 'var(--bg-tertiary)';
      btn.style.border = '1px solid var(--border-color)';
      btn.innerHTML = t.label;
      btn.addEventListener('click', () => this.createNewMask(t.type));
      btnGrid.appendChild(btn);
    });
    controlsRow.appendChild(btnGrid);

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
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const name = `Mask ${state.masks.length + 1} (${typeLabel})`;
    
    const w = this.viewport.imageWidth || 1024;
    const h = this.viewport.imageHeight || 1024;
    
    // Create offscreen mask canvas
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    const newMask = {
      id,
      name,
      type,
      visible: true,
      inverted: false,
      opacity: 100,
      canvas,
      brushSize: 50,
      brushFeather: 50,
      colorTolerance: 30,
      lumaMin: 0,
      lumaMax: 100,
      lumaFeather: 20,
      wandTolerance: 25,
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
      // Default coordinates
      startPoint: { x: 0.3, y: 0.5 },
      endPoint: { x: 0.7, y: 0.5 },
      center: { x: 0.5, y: 0.5 },
      radiusX: 0.15,
      radiusY: 0.15,
      feather: 50
    };

    // Auto-trigger generator for sky or subject
    if (type === 'sky') {
      this.viewport.generateAISkyMask(newMask);
    } else if (type === 'subject') {
      this.viewport.generateAISubjectMask(newMask);
    } else if (type === 'lumaRange') {
      this.viewport.generateLumaRangeMask(newMask);
    }

    const updatedMasks = [...state.masks, newMask];
    this.editState.set('masks', updatedMasks);
    this.editState.set('activeMaskId', id);
    this.editState.set('showOverlay', true);
    
    // Enter edit mode on viewport
    this.viewport.setMaskEditingMode(id);
    
    if (type === 'colorRange') {
      Toast.info('Click anywhere on the photo to pick a target color!');
    } else if (type === 'magicWand') {
      Toast.info('Click an object on the photo to select it!');
    } else {
      Toast.success(`Created ${name}`);
    }
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

    // Mask specific sliders
    this.sliders.maskOpacity = new Slider({
      label: 'Mask Opacity Density', min: 0, max: 100, step: 1, defaultValue: 100,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const updated = state.masks.map(m => m.id === state.activeMaskId ? { ...m, opacity: val } : m);
        this.editState.set('masks', updated);
        this.viewport.draw();
      }
    });

    this.sliders.brushSize = new Slider({
      label: 'Brush Size', min: 5, max: 300, step: 1, defaultValue: 50,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const updated = state.masks.map(m => m.id === state.activeMaskId ? { ...m, brushSize: val } : m);
        this.editState.set('masks', updated);
        this.viewport.draw();
      }
    });

    this.sliders.brushFeather = new Slider({
      label: 'Brush Feather', min: 0, max: 100, step: 1, defaultValue: 50,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const updated = state.masks.map(m => m.id === state.activeMaskId ? { ...m, brushFeather: val } : m);
        this.editState.set('masks', updated);
        this.viewport.draw();
      }
    });

    this.sliders.colorTolerance = new Slider({
      label: 'Color Range Sensitivity', min: 1, max: 100, step: 1, defaultValue: 30,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const mask = state.masks.find(m => m.id === state.activeMaskId);
        if (!mask) return;
        mask.colorTolerance = val;
        this.viewport.generateColorRangeMask(mask);
        this.editState._notify();
      }
    });

    this.sliders.lumaMin = new Slider({
      label: 'Min Brightness', min: 0, max: 100, step: 1, defaultValue: 0,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const mask = state.masks.find(m => m.id === state.activeMaskId);
        if (!mask) return;
        mask.lumaMin = val;
        this.viewport.generateLumaRangeMask(mask);
        this.editState._notify();
      }
    });

    this.sliders.lumaMax = new Slider({
      label: 'Max Brightness', min: 0, max: 100, step: 1, defaultValue: 100,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const mask = state.masks.find(m => m.id === state.activeMaskId);
        if (!mask) return;
        mask.lumaMax = val;
        this.viewport.generateLumaRangeMask(mask);
        this.editState._notify();
      }
    });

    this.sliders.lumaFeather = new Slider({
      label: 'Range Feather', min: 0, max: 100, step: 1, defaultValue: 20,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const mask = state.masks.find(m => m.id === state.activeMaskId);
        if (!mask) return;
        mask.lumaFeather = val;
        this.viewport.generateLumaRangeMask(mask);
        this.editState._notify();
      }
    });

    this.sliders.wandTolerance = new Slider({
      label: 'Object Edge Sensitivity', min: 5, max: 100, step: 1, defaultValue: 25,
      onChange: (val) => {
        const state = this.editState.get();
        if (!state.activeMaskId) return;
        const mask = state.masks.find(m => m.id === state.activeMaskId);
        if (!mask) return;
        mask.wandTolerance = val;
        this.viewport.generateMagicWandMask(mask);
        this.editState._notify();
      }
    });
  }

  syncUI(state) {
    if (!this.overlayCheck) return;
    this.overlayCheck.checked = !!state.showOverlay;

    // Render mask layers list
    this.layersList.innerHTML = '';
    
    if (!state.masks || state.masks.length === 0) {
      const empty = document.createElement('div');
      empty.style.fontSize = 'var(--font-size-xs)';
      empty.style.color = 'var(--text-tertiary)';
      empty.style.textAlign = 'center';
      empty.style.padding = '8px';
      empty.textContent = 'No local masks created yet.';
      this.layersList.appendChild(empty);
    }

    state.masks.forEach(mask => {
      const isActive = mask.id === state.activeMaskId;
      
      const item = document.createElement('div');
      item.className = `mask-item flex-between align-center ${isActive ? 'active' : ''}`;
      item.style.padding = '6px 8px';
      item.style.borderRadius = 'var(--radius-sm)';
      item.style.backgroundColor = isActive ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
      item.style.border = isActive ? '1px solid var(--accent-color)' : '1px solid transparent';
      item.style.cursor = 'pointer';

      // Left side: icon & title
      const left = document.createElement('div');
      left.className = 'flex-row gap-xs align-center';
      left.style.fontSize = 'var(--font-size-xs)';
      left.style.fontWeight = isActive ? '600' : '400';
      left.textContent = mask.name;
      left.addEventListener('click', () => {
        this.editState.set('activeMaskId', mask.id);
        this.viewport.setMaskEditingMode(mask.id);
      });
      item.appendChild(left);

      // Right side: invert, toggle eye & delete
      const right = document.createElement('div');
      right.className = 'flex-row gap-xs align-center';
      
      // Invert button
      const invertBtn = document.createElement('button');
      invertBtn.className = 'btn btn-ghost action-btn flex-row gap-xs align-center';
      invertBtn.style.padding = '2px 6px';
      invertBtn.style.fontSize = '10px';
      invertBtn.innerHTML = `${Icons.invert} <span>Invert</span>`;
      invertBtn.title = 'Invert Mask';
      invertBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const updated = state.masks.map(m => m.id === mask.id ? { ...m, inverted: !m.inverted } : m);
        this.editState.set('masks', updated);
        this.viewport.draw();
      });
      right.appendChild(invertBtn);

      // Visibility Eye Toggle
      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'btn btn-ghost action-btn';
      eyeBtn.style.padding = '2px 4px';
      eyeBtn.innerHTML = mask.visible ? Icons.eye : Icons.eyeOff;
      eyeBtn.title = 'Toggle Visibility';
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vis = !mask.visible;
        const updatedMasks = state.masks.map(m => m.id === mask.id ? { ...m, visible: vis } : m);
        this.editState.set('masks', updatedMasks);
        this.viewport.draw();
      });
      right.appendChild(eyeBtn);

      // Delete trash
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost action-btn';
      delBtn.style.padding = '2px 4px';
      delBtn.innerHTML = Icons.trash;
      delBtn.title = 'Delete Mask';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
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
      this._renderedMaskId = null;
      return;
    }

    // Only rebuild the settings DOM if the active mask has changed
    // This prevents tearing down slider DOM mid-drag
    if (this._renderedMaskId !== activeMask.id) {
      this._renderedMaskId = activeMask.id;
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
        const curState = this.editState.get();
        const curMask = curState.masks.find(m => m.id === curState.activeMaskId);
        if (!curMask) return;
        const updated = curState.masks.map(m => {
          if (m.id === curMask.id) {
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

      // Mask Density / Opacity Slider
      this.settingsContainer.appendChild(this.sliders.maskOpacity.element);

      // Local Adjustments Sliders
      this.settingsContainer.appendChild(this.sliders.exposure.element);
      this.settingsContainer.appendChild(this.sliders.contrast.element);
      this.settingsContainer.appendChild(this.sliders.temperature.element);
      this.settingsContainer.appendChild(this.sliders.tint.element);
      this.settingsContainer.appendChild(this.sliders.saturation.element);
      this.settingsContainer.appendChild(this.sliders.clarity.element);

      // Type Specific Controls
      if (activeMask.type === 'brush') {
        const brushTitle = document.createElement('div');
        brushTitle.style.fontSize = 'var(--font-size-xs)';
        brushTitle.style.color = 'var(--text-secondary)';
        brushTitle.style.fontWeight = '600';
        brushTitle.style.marginTop = '8px';
        brushTitle.textContent = `BRUSH SETTINGS`;
        this.settingsContainer.appendChild(brushTitle);
        this.settingsContainer.appendChild(this.sliders.brushSize.element);
        this.settingsContainer.appendChild(this.sliders.brushFeather.element);
      } else if (activeMask.type === 'colorRange') {
        const cTitle = document.createElement('div');
        cTitle.style.fontSize = 'var(--font-size-xs)';
        cTitle.style.color = 'var(--text-secondary)';
        cTitle.style.fontWeight = '600';
        cTitle.style.marginTop = '8px';
        cTitle.textContent = `COLOR RANGE SETTINGS`;
        this.settingsContainer.appendChild(cTitle);
        this.settingsContainer.appendChild(this.sliders.colorTolerance.element);
      } else if (activeMask.type === 'lumaRange') {
        const lTitle = document.createElement('div');
        lTitle.style.fontSize = 'var(--font-size-xs)';
        lTitle.style.color = 'var(--text-secondary)';
        lTitle.style.fontWeight = '600';
        lTitle.style.marginTop = '8px';
        lTitle.textContent = `LUMINANCE RANGE SETTINGS`;
        this.settingsContainer.appendChild(lTitle);
        this.settingsContainer.appendChild(this.sliders.lumaMin.element);
        this.settingsContainer.appendChild(this.sliders.lumaMax.element);
        this.settingsContainer.appendChild(this.sliders.lumaFeather.element);
      } else if (activeMask.type === 'magicWand') {
        const wTitle = document.createElement('div');
        wTitle.style.fontSize = 'var(--font-size-xs)';
        wTitle.style.color = 'var(--text-secondary)';
        wTitle.style.fontWeight = '600';
        wTitle.style.marginTop = '8px';
        wTitle.textContent = `OBJECT SELECTION SETTINGS`;
        this.settingsContainer.appendChild(wTitle);
        this.settingsContainer.appendChild(this.sliders.wandTolerance.element);
      }
    }

    // Always sync slider values
    this.settingsContainer.style.display = 'flex';
    const s = activeMask.settings;
    this.sliders.exposure.setValue(s.exposure);
    this.sliders.contrast.setValue(s.contrast);
    this.sliders.temperature.setValue(s.temperature);
    this.sliders.tint.setValue(s.tint);
    this.sliders.saturation.setValue(s.saturation);
    this.sliders.clarity.setValue(s.clarity);
    this.sliders.maskOpacity.setValue(activeMask.opacity !== undefined ? activeMask.opacity : 100);

    if (activeMask.type === 'brush') {
      this.sliders.brushSize.setValue(activeMask.brushSize);
      this.sliders.brushFeather.setValue(activeMask.brushFeather);
    } else if (activeMask.type === 'colorRange') {
      this.sliders.colorTolerance.setValue(activeMask.colorTolerance !== undefined ? activeMask.colorTolerance : 30);
    } else if (activeMask.type === 'lumaRange') {
      this.sliders.lumaMin.setValue(activeMask.lumaMin !== undefined ? activeMask.lumaMin : 0);
      this.sliders.lumaMax.setValue(activeMask.lumaMax !== undefined ? activeMask.lumaMax : 100);
      this.sliders.lumaFeather.setValue(activeMask.lumaFeather !== undefined ? activeMask.lumaFeather : 20);
    } else if (activeMask.type === 'magicWand') {
      this.sliders.wandTolerance.setValue(activeMask.wandTolerance !== undefined ? activeMask.wandTolerance : 25);
    }
  }

  destroy() {
    this.unsubscribe();
  }
}
