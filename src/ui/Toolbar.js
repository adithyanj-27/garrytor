import { Icons } from './components/Icons';

export class Toolbar {
  constructor(container, options = {}) {
    this.container = container;
    this.imageName = options.imageName || 'Untitled Photo';
    this.onBack = options.onBack || null;
    this.onUndo = options.onUndo || null;
    this.onRedo = options.onRedo || null;
    this.onToggleSplit = options.onToggleSplit || null;
    this.onToggleMode = options.onToggleMode || null;
    this.onZoomFit = options.onZoomFit || null;
    this.onZoom100 = options.onZoom100 || null;
    this.onExport = options.onExport || null;
    
    this.isSimpleMode = true;
    this.isSplitActive = false;

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.container.className = 'dashboard-header'; // re-use header styling

    // Left side: Back + Garrytor Logo/Name + Image Name Badge
    const leftSec = document.createElement('div');
    leftSec.className = 'flex-row gap-sm align-center';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-ghost btn-icon';
    backBtn.innerHTML = Icons.back;
    backBtn.title = 'Back to Library';
    backBtn.addEventListener('click', () => {
      if (this.onBack) this.onBack();
    });
    leftSec.appendChild(backBtn);

    // Brand Logo & Name
    const brand = document.createElement('div');
    brand.className = 'flex-row gap-xs align-center';
    brand.style.cursor = 'pointer';
    brand.title = 'Back to Library';
    brand.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
        <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
        <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
        <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
        <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
        <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
      </svg>
      <span style="font-family: var(--font-family-logo); font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">Garrytor</span>
    `;
    brand.addEventListener('click', () => {
      if (this.onBack) this.onBack();
    });
    leftSec.appendChild(brand);

    // Separator
    const sep = document.createElement('span');
    sep.style.color = 'var(--border-color)';
    sep.style.fontSize = '14px';
    sep.textContent = '│';
    leftSec.appendChild(sep);

    // Secondary Image Name Badge
    const imgBadge = document.createElement('div');
    imgBadge.className = 'toolbar-title-badge';
    imgBadge.style.fontSize = 'var(--font-size-xs)';
    imgBadge.style.fontWeight = '500';
    imgBadge.style.color = 'var(--text-secondary)';
    imgBadge.style.backgroundColor = 'var(--bg-tertiary)';
    imgBadge.style.border = '1px solid var(--border-color)';
    imgBadge.style.padding = '3px 8px';
    imgBadge.style.borderRadius = 'var(--radius-xs)';
    imgBadge.style.maxWidth = '180px';
    imgBadge.style.overflow = 'hidden';
    imgBadge.style.textOverflow = 'ellipsis';
    imgBadge.style.whiteSpace = 'nowrap';
    imgBadge.textContent = this.imageName;
    imgBadge.title = this.imageName;
    leftSec.appendChild(imgBadge);

    this.container.appendChild(leftSec);

    // Center side: Undo/Redo + Split Compare + Zoom
    const centerSec = document.createElement('div');
    centerSec.className = 'flex-row gap-md';

    // Undo/Redo Group
    const undoGroup = document.createElement('div');
    undoGroup.className = 'flex-row';
    undoGroup.style.border = '1px solid var(--border-color)';
    undoGroup.style.borderRadius = 'var(--radius-sm)';
    undoGroup.style.overflow = 'hidden';

    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn-ghost btn-icon';
    undoBtn.innerHTML = Icons.undo;
    undoBtn.title = 'Undo (Ctrl+Z)';
    undoBtn.disabled = true;
    undoBtn.addEventListener('click', () => {
      if (this.onUndo) this.onUndo();
    });
    this.undoBtn = undoBtn;

    const redoBtn = document.createElement('button');
    redoBtn.className = 'btn btn-ghost btn-icon';
    redoBtn.innerHTML = Icons.redo;
    redoBtn.title = 'Redo (Ctrl+Shift+Z)';
    redoBtn.disabled = true;
    redoBtn.addEventListener('click', () => {
      if (this.onRedo) this.onRedo();
    });
    this.redoBtn = redoBtn;

    undoGroup.appendChild(undoBtn);
    undoGroup.appendChild(redoBtn);
    centerSec.appendChild(undoGroup);

    // Before/After comparison toggle
    const splitBtn = document.createElement('button');
    splitBtn.className = 'btn btn-ghost split-compare-btn flex-row gap-xs align-center';
    splitBtn.innerHTML = `${Icons.splitCompare} <span>Split Compare</span>`;
    splitBtn.title = 'Before / After Comparison';
    splitBtn.addEventListener('click', () => {
      this.isSplitActive = !this.isSplitActive;
      if (this.isSplitActive) {
        splitBtn.classList.add('btn-primary');
        splitBtn.style.color = '#000';
      } else {
        splitBtn.classList.remove('btn-primary');
        splitBtn.style.color = 'var(--text-primary)';
      }
      if (this.onToggleSplit) this.onToggleSplit(this.isSplitActive);
    });
    centerSec.appendChild(splitBtn);

    // Zoom shortcuts
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'flex-row zoom-btn-group';
    zoomGroup.style.border = '1px solid var(--border-color)';
    zoomGroup.style.borderRadius = 'var(--radius-sm)';
    zoomGroup.style.overflow = 'hidden';

    const fitBtn = document.createElement('button');
    fitBtn.className = 'btn btn-ghost';
    fitBtn.style.fontSize = 'var(--font-size-xs)';
    fitBtn.textContent = 'Fit';
    fitBtn.addEventListener('click', () => {
      if (this.onZoomFit) this.onZoomFit();
    });

    const zoom100Btn = document.createElement('button');
    zoom100Btn.className = 'btn btn-ghost';
    zoom100Btn.style.fontSize = 'var(--font-size-xs)';
    zoom100Btn.textContent = '100%';
    zoom100Btn.addEventListener('click', () => {
      if (this.onZoom100) this.onZoom100();
    });

    zoomGroup.appendChild(fitBtn);
    zoomGroup.appendChild(zoom100Btn);
    centerSec.appendChild(zoomGroup);

    this.container.appendChild(centerSec);

    // Right side: Simple/Advanced Switch + Export
    const rightSec = document.createElement('div');
    rightSec.className = 'flex-row gap-md';

    // Toggle switch container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-mode-container flex-row gap-sm';
    toggleContainer.style.fontSize = 'var(--font-size-xs)';
    toggleContainer.style.color = 'var(--text-secondary)';

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Simple Mode';
    toggleContainer.appendChild(toggleLabel);

    // HTML custom switch
    const switchLabel = document.createElement('label');
    switchLabel.style.position = 'relative';
    switchLabel.style.display = 'inline-block';
    switchLabel.style.width = '34px';
    switchLabel.style.height = '20px';

    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.checked = !this.isSimpleMode;
    switchInput.style.opacity = '0';
    switchInput.style.width = '0';
    switchInput.style.height = '0';

    const sliderSpan = document.createElement('span');
    sliderSpan.style.position = 'absolute';
    sliderSpan.style.cursor = 'pointer';
    sliderSpan.style.top = '0';
    sliderSpan.style.left = '0';
    sliderSpan.style.right = '0';
    sliderSpan.style.bottom = '0';
    sliderSpan.style.backgroundColor = 'var(--border-color)';
    sliderSpan.style.transition = '.2s';
    sliderSpan.style.borderRadius = '20px';

    // slider circle knob
    const knob = document.createElement('span');
    knob.style.position = 'absolute';
    knob.style.content = "''";
    knob.style.height = '14px';
    knob.style.width = '14px';
    knob.style.left = '3px';
    knob.style.bottom = '3px';
    knob.style.backgroundColor = 'var(--text-secondary)';
    knob.style.transition = '.2s';
    knob.style.borderRadius = '50%';
    sliderSpan.appendChild(knob);

    switchInput.addEventListener('change', () => {
      this.isSimpleMode = !switchInput.checked;
      toggleLabel.textContent = this.isSimpleMode ? 'Simple Mode' : 'Advanced Mode';
      
      if (!this.isSimpleMode) {
        knob.style.transform = 'translateX(14px)';
        knob.style.backgroundColor = 'var(--accent-color)';
        sliderSpan.style.backgroundColor = 'rgba(255, 140, 66, 0.2)';
      } else {
        knob.style.transform = 'translateX(0)';
        knob.style.backgroundColor = 'var(--text-secondary)';
        sliderSpan.style.backgroundColor = 'var(--border-color)';
      }

      if (this.onToggleMode) this.onToggleMode(this.isSimpleMode);
    });

    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(sliderSpan);
    toggleContainer.appendChild(switchLabel);
    rightSec.appendChild(toggleContainer);

    // Main Export Button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-primary';
    exportBtn.innerHTML = 'Export';
    exportBtn.addEventListener('click', () => {
      if (this.onExport) this.onExport();
    });
    rightSec.appendChild(exportBtn);

    this.container.appendChild(rightSec);
  }

  // Sync undo/redo states based on stack history
  updateHistoryButtons(canUndo, canRedo) {
    if (this.undoBtn) this.undoBtn.disabled = !canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !canRedo;
  }
}
