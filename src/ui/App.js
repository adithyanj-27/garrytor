import { WebGLRenderer } from '../engine/WebGLRenderer';
import { EditState } from '../state/EditState';
import { HistoryManager } from '../state/HistoryManager';
import { updateProjectState, getProject } from '../supabase/database';
import { getImageUrl, uploadExport } from '../supabase/storage';
import { onAuthStateChange } from '../supabase/auth';
import { loadImageElement, generateThumbnail } from '../utils/ImageLoader';
import { exportCanvas } from '../utils/ExportUtils';

// Components & Views
import { Toast } from './components/Toast';
import { OnboardingTour } from './components/OnboardingTour';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { Toolbar } from './Toolbar';
import { Viewport } from './Viewport';

// Accordion Panels
import { BasicAdjustmentsPanel } from './panels/BasicAdjustmentsPanel';
import { CurvesPanel } from './panels/CurvesPanel';
import { HSLPanel } from './panels/HSLPanel';
import { PresetsPanel } from './panels/PresetsPanel';
import { ExportPanel } from './panels/ExportPanel';
import { MaskingPanel } from './panels/MaskingPanel';
import { HealingBlurPanel } from './panels/HealingBlurPanel';
import { Histogram } from './components/Histogram';

const GUEST_USER = {
  id: 'guest',
  email: 'Guest',
  isGuest: true,
  user_metadata: { display_name: 'Guest User' }
};

export class App {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.currentUser = null;
    
    // Editor State instances
    this.editState = new EditState();
    this.historyManager = new HistoryManager();
    this.renderer = new WebGLRenderer();
    this.viewport = null;
    
    // Auto-save debounce timer
    this.saveTimer = null;
    this.currentProject = null;
    this.lastHealMapPngData = null;

    // Listen for Supabase Authentication state updates
    onAuthStateChange((event, session) => {
      this.currentUser = session ? session.user : GUEST_USER;
      this.route();
    });

    // Register global hotkey shortcuts
    this.initKeyboardShortcuts();

    // Listen for hash routing updates
    window.addEventListener('hashchange', () => this.route());
  }

  // Session routing shell
  route() {
    // Clean up active session window event listeners to avoid leaks and duplications
    if (this.viewport) {
      try { this.viewport.destroy(); } catch (e) {}
      this.viewport = null;
    }
    if (this.curvesPanel) {
      try { this.curvesPanel.destroy(); } catch (e) {}
      this.curvesPanel = null;
    }

    this.root.innerHTML = '';
    
    // Clear save timer on routing changes
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const hash = window.location.hash;
    
    // Check if explicitly trying to log in/sign up
    if (hash === '#/login') {
      new AuthPage(this.root, (user) => {
        this.currentUser = user;
        window.location.hash = '#/dashboard';
        this.route();
      });
      return;
    }

    if (!this.currentUser) {
      this.currentUser = GUEST_USER;
    }

    if (hash.startsWith('#/edit/')) {
      const projId = hash.replace('#/edit/', '');
      if (this.currentProject && this.currentProject.id.toString() === projId.toString()) {
        this.mountEditor();
      } else {
        // Fetch project from database/localStorage on reload
        getProject(projId, this.currentUser.id).then(({ data, error }) => {
          if (data && !error) {
            this.currentProject = data;
            this.mountEditor();
          } else {
            window.location.hash = '#/dashboard';
            this.route();
          }
        }).catch(err => {
          console.error(err);
          window.location.hash = '#/dashboard';
          this.route();
        });
      }
    } else {
      // 3. Mount Dashboard Library
      window.location.hash = '#/dashboard';
      this.mountDashboard();
    }
  }

  mountDashboard() {
    this.currentProject = null;
    new Dashboard(
      this.root,
      this.currentUser,
      (project) => {
        this.currentProject = project;
        window.location.hash = `#/edit/${project.id}`;
        this.route();
      },
      () => {
        this.currentUser = null;
        this.route();
      }
    );
  }

  // Create full editor studio layout
  mountEditor() {
    const proj = this.currentProject;
    
    const container = document.createElement('div');
    container.className = 'editor-container fade-in';
    this.root.appendChild(container);

    // 1. Create Top Header Toolbar
    const toolbarDiv = document.createElement('div');
    container.appendChild(toolbarDiv);

    // 2. Create Workspace Grid Layout
    const workspace = document.createElement('div');
    workspace.className = 'editor-workspace';
    container.appendChild(workspace);

    // Left Panel: Presets & History
    const leftPanel = document.createElement('div');
    leftPanel.className = 'editor-panel left';
    leftPanel.innerHTML = `
      <div class="panel-header">Presets</div>
      <div class="panel-content presets-panel-mount"></div>
    `;
    workspace.appendChild(leftPanel);

    // Viewport: WebGL canvas container
    const viewportDiv = document.createElement('div');
    viewportDiv.className = 'viewport-container';
    
    // Tap on viewport to close slide-out panels on mobile
    viewportDiv.addEventListener('pointerdown', () => {
      leftPanel.classList.remove('mobile-open');
      rightPanel.classList.remove('mobile-open');
    });
    workspace.appendChild(viewportDiv);

    // Right Panel: Adjustments accordion
    const rightPanel = document.createElement('div');
    rightPanel.className = 'editor-panel right';
    
    // Add real-time Histogram at the top of the right panel
    const histogramContainer = document.createElement('div');
    histogramContainer.className = 'histogram-container';
    histogramContainer.style.height = '70px';
    histogramContainer.style.backgroundColor = 'var(--bg-primary)';
    histogramContainer.style.borderBottom = '1px solid var(--border-color)';
    histogramContainer.style.padding = '8px';
    histogramContainer.style.position = 'relative';

    const histCanvas = document.createElement('canvas');
    histCanvas.style.width = '100%';
    histCanvas.style.height = '100%';
    histCanvas.width = 256;
    histCanvas.height = 70;
    histogramContainer.appendChild(histCanvas);
    rightPanel.appendChild(histogramContainer);
    
    this.histogram = new Histogram(histCanvas);

    // Container for accordion modules
    const rightScroll = document.createElement('div');
    rightScroll.className = 'panel-content';
    rightScroll.style.padding = '0';
    rightPanel.appendChild(rightScroll);
    workspace.appendChild(rightPanel);

    // Build right accordion modules
    const basicSec = this._createAccordionSection(rightScroll, 'Basic Adjustments', true);
    const curveSec = this._createAccordionSection(rightScroll, 'Tone Curve', false);
    const hslSec = this._createAccordionSection(rightScroll, 'Color Mixer / HSL', false);
    const maskSec = this._createAccordionSection(rightScroll, 'Masking 🎭', false);
    const healingBlurSec = this._createAccordionSection(rightScroll, 'Healing & Blur 🧹🔥', false);
    const exportSec = this._createAccordionSection(rightScroll, 'Export settings', false);

    // Instantiate and connect a fresh WebGL Renderer for this session
    this.renderer = new WebGLRenderer();
    this.viewport = new Viewport(viewportDiv, this.renderer, this.editState);
    this.renderer.init(this.viewport.canvas);

    // Load project EditState settings if exists (asynchronously reconstruct mask canvases)
    this.loadProjectState(proj).then(() => {
      this.historyManager.clear();
      if (this.viewport && this.renderer.textures.get('source')) {
        this.viewport.draw();
      }
    });

    // Instantiate Toolbar header
    this.toolbar = new Toolbar(toolbarDiv, {
      imageName: proj.name,
      onBack: () => {
        window.location.hash = '#/dashboard';
      },
      onUndo: () => this.triggerUndo(),
      onRedo: () => this.triggerRedo(),
      onToggleSplit: (active) => this.viewport.toggleSplitMode(active),
      onToggleMode: (isSimple) => this.adjustPanel.setSimpleMode(isSimple),
      onZoomFit: () => this.viewport.fitToScreen(),
      onZoom100: () => this.viewport.zoomTo100(),
      onExport: () => {
        // Toggle export accordion section open
        document.querySelectorAll('.accordion-section').forEach(s => s.classList.add('collapsed'));
        exportSec.classList.remove('collapsed');
      }
    });

    // Instantiate Accordion Panels
    this.adjustPanel = new BasicAdjustmentsPanel(basicSec, this.editState, true);
    
    // CurvesPanel needs histogram data reference
    this.curvesPanel = new CurvesPanel(curveSec, this.editState, this);
    
    this.hslPanel = new HSLPanel(hslSec, this.editState);
    this.maskPanel = new MaskingPanel(maskSec, this.editState, this.viewport);
    this.healingBlurPanel = new HealingBlurPanel(healingBlurSec, this.editState, this.viewport);
    
    const presetsPanelMount = leftPanel.querySelector('.presets-panel-mount');
    this.presetsPanel = new PresetsPanel(presetsPanelMount, this.editState, this.historyManager, this.currentUser.id);

    this.exportPanel = new ExportPanel(exportSec, (format, quality, scale) => {
      this.exportImage(format, quality, scale);
    });

    // 3. Create Mobile Footer Bar (only visible on mobile screens via CSS)
    const mobileFooter = document.createElement('div');
    mobileFooter.className = 'editor-footer-mobile';
    
    const presetsBtn = document.createElement('button');
    presetsBtn.className = 'btn btn-ghost flex-row gap-sm';
    presetsBtn.style.flex = '1';
    presetsBtn.style.justifyContent = 'center';
    presetsBtn.innerHTML = '📁 Presets';
    presetsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      leftPanel.classList.toggle('mobile-open');
      rightPanel.classList.remove('mobile-open');
    });
    
    const adjustBtn = document.createElement('button');
    adjustBtn.className = 'btn btn-ghost flex-row gap-sm';
    adjustBtn.style.flex = '1';
    adjustBtn.style.justifyContent = 'center';
    adjustBtn.innerHTML = '🎛️ Adjustments';
    adjustBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      rightPanel.classList.toggle('mobile-open');
      leftPanel.classList.remove('mobile-open');
    });
    
    mobileFooter.appendChild(presetsBtn);
    mobileFooter.appendChild(adjustBtn);
    container.appendChild(mobileFooter);

    // Show loading spinner
    Toast.info('Loading high-resolution image...');
    
    // Load original image URL from Storage bucket
    getImageUrl(proj.original_path).then(async (url) => {
      try {
        if (!url) throw new Error('Image URL could not be resolved. The local file may be missing.');
        
        const img = await loadImageElement(url);
        
        // 1. Set viewport image dimensions (this computes zoom and calls fitToScreen)
        this.viewport.baseImageElement = img;
        this.viewport.setImageSize(img.naturalWidth, img.naturalHeight);

        // 2. Set the canvas draw-buffer dimensions BEFORE loading into GL
        //    so the GL context is established at the right size
        if (this.viewport.canvas.width !== img.naturalWidth || this.viewport.canvas.height !== img.naturalHeight) {
          this.viewport.canvas.width = img.naturalWidth;
          this.viewport.canvas.height = img.naturalHeight;
        }

        // 3. Upload image to GPU
        this.renderer.loadImage(img);
        
        // 4. Asynchronously load and overlay the persistent healed pixels if they exist
        const state = this.editState.get();
        if (state.healMapPngData) {
          const healImg = new Image();
          healImg.src = state.healMapPngData;
          await new Promise(resolve => {
            healImg.onload = resolve;
            healImg.onerror = resolve;
          });
          
          if (this.viewport.healMapCanvas) {
            const hCtx = this.viewport.healMapCanvas.getContext('2d');
            hCtx.drawImage(healImg, 0, 0);
          }
          if (this.viewport.originalCanvas) {
            const oCtx = this.viewport.originalCanvas.getContext('2d');
            oCtx.drawImage(healImg, 0, 0);
          }
          this.renderer.textures.createImageTexture('healMap', this.viewport.healMapCanvas);
          this.lastHealMapPngData = state.healMapPngData;
        }

        // 5. Trigger full render (CSS display, guides, and GL draw)
        this.viewport.applyTransform();
        
        Toast.success('Studio ready.');

        // Initialize onboarding tour overlay if first visit
        const tour = new OnboardingTour();
        tour.start();

      } catch (err) {
        console.error('Image load error:', err);
        Toast.error('Failed to load image: ' + err.message);
      }
    }).catch(err => {
      console.error('getImageUrl error:', err);
      Toast.error('Failed to resolve image URL.');
    });

    // Subscribe to state change callbacks: auto-save and histogram updates
    this.editState.onChange((state) => {
      // 1. Sync undo/redo header buttons
      this.toolbar.updateHistoryButtons(this.historyManager.canUndo(), this.historyManager.canRedo());

      // 2. Trigger WebGL pipeline re-render
      if (this.viewport) {
        if (state.healMapPngData !== this.lastHealMapPngData) {
          this.lastHealMapPngData = state.healMapPngData;
          this.viewport.syncHealMap(state.healMapPngData);
        } else {
          this.viewport.applyTransform();
        }
        
        // 3. Compute histogram counts from viewport output pixels
        // Downsample slightly for maximum performance
        const pixels = this.renderer.readPixels();
        this.histogram.update(pixels.data);
        this.histogramData = this.histogram; // expose for curves panel background
        
        // Redraw curves canvas to update histogram background in curves
        if (this.curvesPanel) this.curvesPanel.draw();
      }

      // 4. Set debounced auto-save timer
      this.triggerAutoSave();
    });
  }

  // Trigger debounced update project state
  triggerAutoSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(async () => {
      if (!this.currentProject) return;

      const editStateJSON = this.editState.clone();
      
      // Serialize mask canvases to PNG dataURLs for JSON storage
      if (editStateJSON.masks) {
        editStateJSON.masks.forEach(mask => {
          if (mask.canvas) {
            mask.pngData = mask.canvas.toDataURL('image/png');
            // Remove reference from state copy to avoid serialization errors
            delete mask.canvas;
          }
        });
      }

      // Perform database updates
      const { error } = await updateProjectState(this.currentProject.id, editStateJSON);
      if (error) {
        console.error('Auto-save failed:', error);
      } else {
        // Sync project state in memory
        this.currentProject.edit_state = editStateJSON;
      }
    }, 3000); // Save after 3 seconds of inactivity
  }

  // Asynchronously reconstruct mask canvas elements from stored PNG data URLs
  async loadProjectState(proj) {
    if (proj.edit_state && Object.keys(proj.edit_state).length > 0) {
      const stateObj = JSON.parse(JSON.stringify(proj.edit_state));
      
      if (stateObj.masks && stateObj.masks.length > 0) {
        for (const mask of stateObj.masks) {
          if (mask.pngData) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = mask.pngData;
            await new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
            canvas.width = img.width || 512;
            canvas.height = img.height || 512;
            ctx.drawImage(img, 0, 0);
            mask.canvas = canvas;
          }
        }
      }
      this.editState.setAll(stateObj);
    } else {
      this.editState.reset();
    }
  }

  // Export full resolution image and update library thumbnail
  async exportImage(format, quality, scale) {
    if (!this.viewport || !this.currentProject) return;

    Toast.info('Rendering final export...');

    // Wait 50ms to let loading toast render
    setTimeout(async () => {
      try {
        // 1. Generate full resolution pixels from WebGL framebuffer
        const imageData = this.renderer.readPixels();
        
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);

        // 2. Adjust output dimensions if scale is set (<1.0)
        let finalCanvas = canvas;
        if (scale < 1.0) {
          finalCanvas = document.createElement('canvas');
          finalCanvas.width = canvas.width * scale;
          finalCanvas.height = canvas.height * scale;
          const finalCtx = finalCanvas.getContext('2d');
          finalCtx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
        }

        // 3. Trigger download blob
        const filename = `${this.currentProject.name.replace(/\.[^/.]+$/, "")}_edited.${format === 'image/png' ? 'png' : 'jpg'}`;
        const blob = await exportCanvas(finalCanvas, format, quality, filename);
        
        Toast.success('Image exported successfully!');

        // 4. Update project card library thumbnail to match current edits
        Toast.info('Updating project thumbnail...');
        const thumbBlob = await generateThumbnail(finalCanvas);
        const { path: thumbPath } = await uploadExport(
          this.currentUser.id, 
          `thumbs/${Date.now()}`, 
          thumbBlob
        );

        if (thumbPath) {
          await updateProjectState(this.currentProject.id, this.editState.clone(), thumbPath);
          this.currentProject.thumbnail_path = thumbPath;
        }

      } catch (err) {
        console.error(err);
        Toast.error('Export failed: ' + err.message);
      }
    }, 50);
  }

  triggerUndo() {
    const current = this.editState.clone();
    const prev = this.historyManager.undo(current);
    if (prev) {
      this.editState.setAll(prev);
    }
  }

  triggerRedo() {
    const current = this.editState.clone();
    const next = this.historyManager.redo(current);
    if (next) {
      this.editState.setAll(next);
    }
  }

  // Keyboard shortcut listeners
  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // 1. Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        // Prevent default input action if focus is on form
        if (document.activeElement.tagName === 'INPUT') return;
        e.preventDefault();
        this.triggerUndo();
      }

      // 2. Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (
        (e.key.toLowerCase() === 'z' && e.shiftKey) || 
        e.key.toLowerCase() === 'y'
      )) {
        if (document.activeElement.tagName === 'INPUT') return;
        e.preventDefault();
        this.triggerRedo();
      }
    });
  }

  // Helper to construct sidebar accordion layouts
  _createAccordionSection(container, titleText, expanded = false) {
    const sec = document.createElement('div');
    sec.className = `accordion-section ${expanded ? '' : 'collapsed'}`;

    const header = document.createElement('div');
    header.className = 'accordion-header';
    header.innerHTML = `
      <span>${titleText}</span>
      <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 9l-7 7-7-7" />
      </svg>
    `;

    const content = document.createElement('div');
    content.className = 'accordion-content';

    header.addEventListener('click', () => {
      const isCollapsed = sec.classList.toggle('collapsed');
      
      // Auto-collapse other sections in Lightroom-style accordion
      if (!isCollapsed) {
        container.querySelectorAll('.accordion-section').forEach(s => {
          if (s !== sec) s.classList.add('collapsed');
        });
      }
    });

    sec.appendChild(header);
    sec.appendChild(content);
    container.appendChild(sec);

    return content;
  }
}
