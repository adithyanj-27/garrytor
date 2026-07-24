import { PresetManager } from '../../state/PresetManager';
import { Toast } from '../components/Toast';
import { Icons } from '../components/Icons';

export class PresetsPanel {
  constructor(container, editState, historyManager, userId = null) {
    this.container = container;
    this.editState = editState;
    this.historyManager = historyManager;
    this.presetManager = new PresetManager(userId);
    this.hoverBackupState = null;

    this.init();
  }

  // Update userId when auth updates
  setUserId(userId) {
    this.presetManager.setUserId(userId);
    this.loadPresets();
  }

  init() {
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'presets-container';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '16px';

    // Copy / Paste Controls
    const clipActions = document.createElement('div');
    clipActions.style.display = 'flex';
    clipActions.style.gap = '8px';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-ghost flex-row gap-xs align-center justify-center';
    copyBtn.style.flex = '1';
    copyBtn.style.fontSize = '12px';
    copyBtn.innerHTML = `${Icons.splitCompare} <span>Copy Settings</span>`;
    copyBtn.addEventListener('click', () => {
      this.presetManager.copySettings(this.editState);
      pasteBtn.disabled = false;
      Toast.success('Settings copied to clipboard!');
    });

    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'btn btn-ghost flex-row gap-xs align-center justify-center';
    pasteBtn.style.flex = '1';
    pasteBtn.style.fontSize = '12px';
    pasteBtn.innerHTML = `${Icons.adjustments} <span>Paste Settings</span>`;
    pasteBtn.disabled = !this.presetManager.hasCopiedSettings();
    pasteBtn.addEventListener('click', () => {
      // Save current state for undo
      this.historyManager.push(this.editState.clone());
      const success = this.presetManager.pasteSettings(this.editState);
      if (success) {
        Toast.success('Settings pasted successfully!');
      }
    });

    clipActions.appendChild(copyBtn);
    clipActions.appendChild(pasteBtn);
    panel.appendChild(clipActions);

    // Save Preset Button
    const savePresetBtn = document.createElement('button');
    savePresetBtn.className = 'btn btn-primary flex-row gap-xs align-center justify-center';
    savePresetBtn.innerHTML = `${Icons.plus} <span>Save Current as Preset</span>`;
    savePresetBtn.addEventListener('click', () => this.onSavePresetPrompt());
    panel.appendChild(savePresetBtn);

    // Divider
    const hr = document.createElement('div');
    hr.style.height = '1px';
    hr.style.backgroundColor = 'var(--border-color)';
    panel.appendChild(hr);

    // Scrollable Presets Grid
    const grid = document.createElement('div');
    grid.className = 'presets-grid';
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '8px';
    grid.style.maxHeight = '350px';
    grid.style.overflowY = 'auto';
    grid.style.paddingRight = '4px';
    
    panel.appendChild(grid);
    this.grid = grid;

    this.container.appendChild(panel);
    this.loadPresets();
  }

  // Load and render all presets
  async loadPresets() {
    this.grid.innerHTML = '';
    const presets = await this.presetManager.getAllPresets();

    // Group by category
    const categories = {};
    presets.forEach(p => {
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category].push(p);
    });

    for (const catName in categories) {
      // Category Header
      const header = document.createElement('div');
      header.textContent = catName;
      header.style.fontSize = 'var(--font-size-xs)';
      header.style.fontWeight = '700';
      header.style.color = 'var(--text-muted)';
      header.style.textTransform = 'uppercase';
      header.style.marginTop = '8px';
      header.style.marginBottom = '4px';
      this.grid.appendChild(header);

      // Render preset buttons
      categories[catName].forEach(p => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.style.padding = '10px var(--spacing-md)';
        item.style.backgroundColor = 'var(--bg-tertiary)';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = 'var(--radius-sm)';
        item.style.cursor = 'pointer';
        item.style.fontSize = 'var(--font-size-sm)';
        item.style.transition = 'all 0.15s';
        item.textContent = p.name;

        // Hover Effect: Live temporary preview!
        item.addEventListener('mouseenter', () => {
          this.hoverBackupState = this.editState.clone();
          this.applySettings(p.settings, false); // Temp apply, don't write to history
        });

        item.addEventListener('mouseleave', () => {
          if (this.hoverBackupState) {
            this.editState.setAll(this.hoverBackupState);
            this.hoverBackupState = null;
          }
        });

        // Click Effect: Apply permanently
        item.addEventListener('click', () => {
          // Push current state to undo history before applying
          if (this.hoverBackupState) {
            this.historyManager.push(this.hoverBackupState);
            this.hoverBackupState = null;
          } else {
            this.historyManager.push(this.editState.clone());
          }
          
          this.applySettings(p.settings, true);
          Toast.success(`Applied preset: ${p.name}`);
        });

        this.grid.appendChild(item);
      });
    }
  }

  // Apply settings to state safely
  applySettings(settings, permanent = true) {
    const current = this.editState.get();
    
    // Construct new state merging preset settings
    const merged = {
      ...current,
      basic: { ...current.basic, ...settings.basic },
      curve: settings.curve ? { ...current.curve, ...settings.curve } : current.curve,
      hsl: settings.hsl ? { ...current.hsl, ...settings.hsl } : current.hsl,
      vignette: settings.vignette ? { ...current.vignette, ...settings.vignette } : current.vignette
    };

    this.editState.setAll(merged);
  }

  // Save current settings as preset dialog
  onSavePresetPrompt() {
    const name = prompt('Enter a name for your custom preset:');
    if (!name) return;

    if (name.trim().length === 0) {
      Toast.error('Preset name cannot be empty.');
      return;
    }

    this.presetManager.createUserPreset(name.trim(), this.editState.get())
      .then(({ preset, error }) => {
        if (error) {
          Toast.error('Failed to save preset: ' + error.message);
        } else {
          Toast.success(`Preset "${name}" saved!`);
          this.loadPresets(); // Reload list
        }
      });
  }
}
