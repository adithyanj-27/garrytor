import { Icons } from './components/Icons';
import { ProfileModal } from './components/ProfileModal';
import { getUserDisplayName } from '../supabase/auth';

export class Toolbar {
  constructor(container, options = {}) {
    this.container = container;
    this.currentUser = options.currentUser || null;
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

    // Left side: Back + Exact Home Screen Brand Logo
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

    // Exact Home Screen Brand Logo & Name
    const brand = document.createElement('div');
    brand.className = 'auth-logo';
    brand.style.fontSize = '20px';
    brand.style.cursor = 'pointer';
    brand.title = 'Back to Library';
    brand.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#aperture-grad-tool)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(255, 140, 66, 0.45));">
        <defs>
          <linearGradient id="aperture-grad-tool" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ff8c42" />
            <stop offset="100%" stop-color="#ff3e55" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
        <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
        <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
        <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
        <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
        <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
      </svg>
      <span class="brand-glow">Garrytor</span>
    `;
    brand.addEventListener('click', () => {
      if (this.onBack) this.onBack();
    });
    leftSec.appendChild(brand);

    this.container.appendChild(leftSec);

    // Center side: Photo Title Badge + Undo/Redo + Split Compare + Zoom
    const centerSec = document.createElement('div');
    centerSec.className = 'flex-row gap-md align-center';

    // Image Name Badge shown in center toolbar
    const imgBadge = document.createElement('div');
    imgBadge.className = 'toolbar-title-badge flex-row gap-xs align-center';
    imgBadge.style.fontSize = 'var(--font-size-xs)';
    imgBadge.style.fontWeight = '500';
    imgBadge.style.color = 'var(--text-secondary)';
    imgBadge.style.backgroundColor = 'var(--bg-tertiary)';
    imgBadge.style.border = '1px solid var(--border-color)';
    imgBadge.style.padding = '4px 10px';
    imgBadge.style.borderRadius = 'var(--radius-xs)';
    imgBadge.style.maxWidth = '220px';
    imgBadge.style.overflow = 'hidden';
    imgBadge.style.textOverflow = 'ellipsis';
    imgBadge.style.whiteSpace = 'nowrap';
    imgBadge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      <span>${this.imageName}</span>
    `;
    imgBadge.title = this.imageName;
    centerSec.appendChild(imgBadge);

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

    // PWA Install Button in Toolbar Header
    const installBtn = document.createElement('button');
    installBtn.className = 'btn btn-ghost pwa-install-btn flex-row gap-xs align-center';
    installBtn.style.fontSize = 'var(--font-size-xs)';
    installBtn.style.display = 'flex';
    installBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Install App</span>
    `;
    installBtn.addEventListener('click', () => {
      if (window.triggerPWAInstall) window.triggerPWAInstall();
    });
    rightSec.appendChild(installBtn);

    // Main Export Button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-primary';
    exportBtn.innerHTML = 'Export';
    exportBtn.addEventListener('click', () => {
      if (this.onExport) this.onExport();
    });
    rightSec.appendChild(exportBtn);

    // Profile Avatar Button
    if (this.currentUser) {
      const displayName = getUserDisplayName(this.currentUser);
      const initial = displayName.charAt(0).toUpperCase() || 'U';

      const profileAvatarBtn = document.createElement('button');
      profileAvatarBtn.className = 'btn btn-ghost btn-icon';
      profileAvatarBtn.style.borderRadius = '50%';
      profileAvatarBtn.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, #ff3e55 100%)';
      profileAvatarBtn.style.color = '#fff';
      profileAvatarBtn.style.fontWeight = '700';
      profileAvatarBtn.style.fontSize = '13px';
      profileAvatarBtn.style.border = 'none';
      profileAvatarBtn.style.boxShadow = '0 0 6px var(--accent-glow)';
      profileAvatarBtn.textContent = initial;
      profileAvatarBtn.title = `Profile Details (${displayName})`;
      profileAvatarBtn.addEventListener('click', () => {
        new ProfileModal(this.currentUser, {
          onSignOut: () => window.location.hash = '#/dashboard'
        }).open();
      });
      rightSec.appendChild(profileAvatarBtn);
    }

    this.container.appendChild(rightSec);
  }

  // Sync undo/redo states based on stack history
  updateHistoryButtons(canUndo, canRedo) {
    if (this.undoBtn) this.undoBtn.disabled = !canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !canRedo;
  }
}
