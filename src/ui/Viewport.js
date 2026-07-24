export class Viewport {
  constructor(container, renderer, editState) {
    this.container = container;
    this.renderer = renderer;
    this.editState = editState;
    
    // Zoom & Pan state
    this.zoom = 1.0;     // 1.0 = 100%, fits on load
    this.panX = 0;       // in pixels
    this.panY = 0;       // in pixels
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    
    // Keyboard Spacebar override for panning
    this.isSpacePressed = false;
    
    // Before/after split comparison state
    this.isSplitMode = false;
    this.splitX = 0.5;   // 0.0 to 1.0
    this.isDraggingSplit = false;

    // Mask editing properties
    this.activeMaskId = null;
    this.isPainting = false;
    this.isDraggingGradient = false;
    this.lastPaintX = 0;
    this.lastPaintY = 0;

    // Healing properties & Worker setup
    this.healingWorker = new Worker(new URL('../workers/healing.worker.js', import.meta.url), { type: 'module' });
    this.healingWorker.onmessage = (e) => {
      if (e.data.error) {
        console.error('Healing worker error:', e.data.error);
        Toast.error('Healing failed: ' + e.data.error);
        return;
      }
      const { result, width, height } = e.data;
      this.applyHealedPixels(result, width, height);
    };
    
    this.originalCanvas = null;
    this.healMapCanvas = null;
    this.strokeMaskCanvas = null;
    this.isPaintingHealing = false;
    this.healStrokeBoundingBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.activeHealRect = null;
    this.baseImageElement = null;

    this.init();
    
    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  init() {
    this.container.innerHTML = '';
    
    // Viewport relative container
    const viewWrapper = document.createElement('div');
    viewWrapper.className = 'viewport-wrapper';
    viewWrapper.style.position = 'relative';
    viewWrapper.style.width = '100%';
    viewWrapper.style.height = '100%';
    viewWrapper.style.overflow = 'hidden';
    viewWrapper.style.display = 'flex';
    viewWrapper.style.alignItems = 'center';
    viewWrapper.style.justifyContent = 'center';

    // Canvas element (WebGL)
    const canvas = document.createElement('canvas');
    canvas.id = 'webgl-canvas';
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    viewWrapper.appendChild(canvas);
    this.canvas = canvas;

    // Overlay 2D canvas for drawing vector handles, guides, and brushes
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.left = '50%';
    overlayCanvas.style.top = '50%';
    overlayCanvas.style.pointerEvents = 'none'; // Click through to canvas under
    overlayCanvas.style.zIndex = '5';
    viewWrapper.appendChild(overlayCanvas);
    this.overlayCanvas = overlayCanvas;

    // Split handle visual divider overlay
    const splitHandle = document.createElement('div');
    splitHandle.className = 'split-handle';
    splitHandle.style.position = 'absolute';
    splitHandle.style.top = '0';
    splitHandle.style.width = '4px';
    splitHandle.style.height = '100%';
    splitHandle.style.backgroundColor = 'var(--accent-color)';
    splitHandle.style.cursor = 'ew-resize';
    splitHandle.style.display = 'none';
    splitHandle.style.zIndex = '10';
    splitHandle.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    viewWrapper.appendChild(splitHandle);
    this.splitHandle = splitHandle;

    // Small split handle central circle
    const splitCircle = document.createElement('div');
    splitCircle.style.position = 'absolute';
    splitCircle.style.top = '50%';
    splitCircle.style.left = '50%';
    splitCircle.style.transform = 'translate(-50%, -50%)';
    splitCircle.style.width = '24px';
    splitCircle.style.height = '24px';
    splitCircle.style.borderRadius = '50%';
    splitCircle.style.backgroundColor = 'var(--accent-color)';
    splitCircle.style.border = '2px solid #000';
    splitCircle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8l4 4-4 4M6 8l-4 4 4 4"/></svg>`;
    splitCircle.style.display = 'flex';
    splitCircle.style.alignItems = 'center';
    splitCircle.style.justifyContent = 'center';
    splitHandle.appendChild(splitCircle);

    this.container.appendChild(viewWrapper);

    // Save bound listener references for explicit cleanup
    this._boundPointerUp = () => this.onPointerUp();
    this._boundKeyDown = (e) => this.onKeyDown(e);
    this._boundKeyUp = (e) => this.onKeyUp(e);
    this._boundPointerDown = (e) => this.onPointerDown(e);
    this._boundPointerMove = (e) => this.onPointerMove(e);
    this._boundWheel = (e) => this.onWheel(e);

    // Event Listeners for Panning & Zooming
    this.container.addEventListener('pointerdown', this._boundPointerDown);
    this.container.addEventListener('pointermove', this._boundPointerMove);
    window.addEventListener('pointerup', this._boundPointerUp);
    this.container.addEventListener('wheel', this._boundWheel, { passive: false });

    // Keyboard Spacebar & Overlay shortcuts listeners
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);

    // Prevent default context menu
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyDown(e) {
    if (e.code === 'Space') {
      this.isSpacePressed = true;
      this.container.style.cursor = 'grab';
    }
    if (e.code === 'KeyO' && !e.target.closest('input')) {
      const state = this.editState.get();
      this.editState.set('showOverlay', !state.showOverlay);
      this.draw();
    }
  }

  onKeyUp(e) {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.container.style.cursor = 'default';
    }
  }

  destroy() {
    window.removeEventListener('pointerup', this._boundPointerUp);
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);

    if (this.container) {
      this.container.removeEventListener('pointerdown', this._boundPointerDown);
      this.container.removeEventListener('pointermove', this._boundPointerMove);
      this.container.removeEventListener('wheel', this._boundWheel);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Terminate healing web worker to prevent orphaned threads
    if (this.healingWorker) {
      this.healingWorker.terminate();
      this.healingWorker = null;
    }
  }

  setMaskEditingMode(maskId) {
    this.activeMaskId = maskId;
    this.drawGuides();
  }

  clearMaskEditingMode() {
    this.activeMaskId = null;
    this.drawGuides();
  }

  // Set toggle for Before/After split screen
  toggleSplitMode(enabled) {
    this.isSplitMode = enabled;
    if (enabled) {
      this.splitHandle.style.display = 'block';
      this.updateSplitPosition(0.5);
    } else {
      this.splitHandle.style.display = 'none';
      this.editState.set('splitX', 1.0); // full screen edit
    }
  }

  updateSplitPosition(normX) {
    this.splitX = Math.max(0.01, Math.min(0.99, normX));
    this.editState.set('splitX', this.splitX);

    // Position visual handle on top of canvas viewport
    if (this.canvas) {
      const rect = this.canvas.getBoundingClientRect();
      const parentRect = this.container.getBoundingClientRect();
      const canvasLeftInParent = rect.left - parentRect.left;
      
      const xPos = canvasLeftInParent + this.splitX * rect.width;
      this.splitHandle.style.left = `${xPos}px`;
      
      // Sync split handle height to match canvas height
      this.splitHandle.style.height = `${rect.height}px`;
      this.splitHandle.style.top = `${rect.top - parentRect.top}px`;
    }
  }

  onResize() {
    this.fitToScreen();
  }

  // Load new image sizing and reset layout zoom
  setImageSize(w, h) {
    this.imgW = w;
    this.imgH = h;
    // Expose as public aliases for other components
    this.imageWidth = w;
    this.imageHeight = h;

    // Initialize originalCanvas to store current cumulative healed pixels (on CPU)
    this.originalCanvas = document.createElement('canvas');
    this.originalCanvas.width = w;
    this.originalCanvas.height = h;
    const oCtx = this.originalCanvas.getContext('2d');
    if (this.baseImageElement) {
      oCtx.drawImage(this.baseImageElement, 0, 0);
      // Cache RGBA pixel buffer once to accelerate mask generation by 10x-50x
      this._cachedBasePixels = oCtx.getImageData(0, 0, w, h).data;
    }

    // Initialize healMapCanvas to store only healed pixels with alpha values
    this.healMapCanvas = document.createElement('canvas');
    this.healMapCanvas.width = w;
    this.healMapCanvas.height = h;
    const hCtx = this.healMapCanvas.getContext('2d');
    hCtx.clearRect(0, 0, w, h);

    // Initialize strokeMaskCanvas for active user painting
    this.strokeMaskCanvas = document.createElement('canvas');
    this.strokeMaskCanvas.width = w;
    this.strokeMaskCanvas.height = h;

    this.fitToScreen();
  }

  // Compute scale to fit image completely in container
  fitToScreen() {
    if (!this.imgW || !this.imgH || !this.canvas) return;

    const parentW = this.container.clientWidth;
    const parentH = this.container.clientHeight;
    
    // Leave small border padding
    const maxW = parentW - 40;
    const maxH = parentH - 40;

    const scaleW = maxW / this.imgW;
    const scaleH = maxH / this.imgH;
    
    this.zoom = Math.min(scaleW, scaleH);
    this.panX = 0;
    this.panY = 0;

    this.applyTransform();
  }

  zoomTo100() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  // Apply matrix offsets to canvas style
  applyTransform() {
    if (!this.canvas || !this.imgW || !this.imgH) return;

    const w = Math.round(this.imgW * this.zoom);
    const h = Math.round(this.imgH * this.zoom);
    
    // CRITICAL: Only set canvas draw-buffer size when dimensions actually change.
    // Changing canvas.width/height resets the WebGL context, destroying all textures, shaders and FBOs!
    if (this.canvas.width !== this.imgW || this.canvas.height !== this.imgH) {
      this.canvas.width = this.imgW;
      this.canvas.height = this.imgH;
    }
    
    // Set display dimensions (CSS)
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.style.transform = `translate(calc(-50% + ${this.panX}px), calc(-50% + ${this.panY}px))`;

    // Sync overlay canvas size
    if (this.overlayCanvas.width !== this.imgW || this.overlayCanvas.height !== this.imgH) {
      this.overlayCanvas.width = this.imgW;
      this.overlayCanvas.height = this.imgH;
    }
    this.overlayCanvas.style.width = `${w}px`;
    this.overlayCanvas.style.height = `${h}px`;
    this.overlayCanvas.style.transform = `translate(calc(-50% + ${this.panX}px), calc(-50% + ${this.panY}px))`;

    // Re-draw main engine viewport & vector guides
    this.draw();

    // Sync split handle overlay
    if (this.isSplitMode) {
      this.updateSplitPosition(this.splitX);
    }
  }

  draw() {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this.renderer.render(this.editState);
      this.drawGuides();
    });
  }

  drawGuides() {
    if (!this.overlayCanvas) return;
    
    const ctx = this.overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    const state = this.editState.get();
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    // Draw temporary healing brush stroke on overlayCanvas
    if (state.activeTool === 'healing') {
      if (this.strokeMaskCanvas) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.drawImage(this.strokeMaskCanvas, 0, 0);
        ctx.restore();
      }
      return;
    }

    // Draw Lens Blur focal point indicator
    if (state.activeTool === 'lensblur' && state.lensBlur.focalPoint) {
      const fx = state.lensBlur.focalPoint.x * w;
      // Invert Y coordinate back for drawing in canvas space
      const fy = (1.0 - state.lensBlur.focalPoint.y) * h;
      const fr = (state.lensBlur.focalRadius || 0.1) * Math.min(w, h);
      
      ctx.save();
      ctx.strokeStyle = '#ff3e55';
      ctx.lineWidth = Math.max(1, 2 / this.zoom);
      ctx.fillStyle = 'rgba(255, 62, 85, 0.15)';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      
      // Outer border circle
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Center dot
      ctx.fillStyle = '#ff3e55';
      ctx.beginPath();
      ctx.arc(fx, fy, 5 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      
      // Outer dashed target guide
      ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
      ctx.beginPath();
      ctx.arc(fx, fy, fr + 15 / this.zoom, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.restore();
      return;
    }

    const activeId = state.activeMaskId;
    if (!activeId) return;

    const mask = state.masks.find(m => m.id === activeId);
    if (!mask || !mask.visible) return;

    // Set styling relative to viewport zoom factor
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(1, 2 / this.zoom);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;

    if (mask.type === 'linear') {
      const sx = mask.startPoint.x * w;
      const sy = mask.startPoint.y * h;
      const ex = mask.endPoint.x * w;
      const ey = mask.endPoint.y * h;

      // Draw primary gradient guide line
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Perpendicular end lines
      const dx = ex - sx;
      const dy = ey - sy;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const nx = -dy / len * 120 / this.zoom;
        const ny = dx / len * 120 / this.zoom;

        // Draw start perpendicular line
        ctx.beginPath();
        ctx.moveTo(sx - nx, sy - ny);
        ctx.lineTo(sx + nx, sy + ny);
        ctx.stroke();

        // Draw middle divider line
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        ctx.beginPath();
        ctx.moveTo(mx - nx, my - ny);
        ctx.lineTo(mx + nx, my + ny);
        ctx.stroke();

        // Draw end perpendicular line
        ctx.beginPath();
        ctx.moveTo(ex - nx, ey - ny);
        ctx.lineTo(ex + nx, ey + ny);
        ctx.stroke();
      }

      // Draw drag handle circles
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(sx, sy, 7 / this.zoom, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ex, ey, 7 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      
    } else if (mask.type === 'radial') {
      const cx = mask.center.x * w;
      const cy = mask.center.y * h;
      const rx = mask.radiusX * w;
      const ry = mask.radiusY * h;

      // Draw ellipse bounds
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Draw inner feather boundary line
      const feather = mask.feather || 50;
      const rxInner = rx * (1 - feather / 100);
      const ryInner = ry * (1 - feather / 100);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rxInner, ryInner, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Center pivot point
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  onPointerDown(e) {
    if (e.button === 2 || this.isSpacePressed) {
      // Right click or spacebar -> trigger pan dragging
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.container.style.cursor = 'grabbing';
      return;
    }

    const parentRect = this.container.getBoundingClientRect();

    // Check if clicked near split slider handle
    if (this.isSplitMode) {
      const handleRect = this.splitHandle.getBoundingClientRect();
      const d = Math.abs(e.clientX - (handleRect.left + handleRect.width / 2));
      
      if (d < 25) {
        this.isDraggingSplit = true;
        this.splitHandle.style.backgroundColor = 'var(--accent-hover)';
        return;
      }
    }

    // Check tool specific actions first
    const state = this.editState.get();
    if (this.canvas) {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / rect.width * this.imgW);
      const y = Math.round((e.clientY - rect.top) / rect.height * this.imgH);

      // Healing Brush painting trigger
      if (state.activeTool === 'healing') {
        this.isPaintingHealing = true;
        this.lastPaintX = x;
        this.lastPaintY = y;
        this.healStrokeBoundingBox = { minX: x, minY: y, maxX: x, maxY: y };
        
        const sCtx = this.strokeMaskCanvas.getContext('2d');
        this.drawHealingBrush(sCtx, x, y, x, y, state.healingBrushSize, state.healingBrushFeather);
        this.drawGuides();
        return;
      }

      // Lens Blur focal point selector click trigger
      if (state.activeTool === 'lensblur') {
        const fx = Math.max(0, Math.min(1.0, x / this.imgW));
        const fy = Math.max(0, Math.min(1.0, 1.0 - (y / this.imgH)));
        this.editState.set('lensBlur.focalPoint', { x: fx, y: fy });
        this.draw();
        return;
      }
    }

    // Check if mask editing is active
    if (state.activeMaskId) {
      const mask = state.masks.find(m => m.id === state.activeMaskId);
      if (mask && mask.visible) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / rect.width * this.imgW);
        const y = Math.round((e.clientY - rect.top) / rect.height * this.imgH);

        // Brush Mask painting
        if (mask.type === 'brush') {
          this.isPainting = true;
          this.lastPaintX = x;
          this.lastPaintY = y;
          this.drawBrushPixel(mask, x, y);
          this.editState._notify();
          return;
        }

        // Color Range, Luma Range, or Magic Wand sampling click
        if (mask.type === 'colorRange' || mask.type === 'lumaRange' || mask.type === 'magicWand') {
          if (mask.type === 'colorRange' || mask.type === 'lumaRange') {
            const sampled = this.samplePixelColor(x, y);
            if (sampled) {
              if (mask.type === 'colorRange') {
                mask.colorTarget = sampled;
                this.generateColorRangeMask(mask);
              } else {
                const luma = Math.round((0.299 * sampled.r + 0.587 * sampled.g + 0.114 * sampled.b) / 255 * 100);
                mask.lumaMin = Math.max(0, luma - 20);
                mask.lumaMax = Math.min(100, luma + 20);
                this.generateLumaRangeMask(mask);
              }
              this.editState._notify();
              return;
            }
          } else if (mask.type === 'magicWand') {
            mask.wandPoint = { x: x / this.imgW, y: y / this.imgH };
            this.generateMagicWandMask(mask);
            this.editState._notify();
            return;
          }
        }

        // Linear or Radial gradient drag
        if (mask.type === 'linear' || mask.type === 'radial') {
          this.isDraggingGradient = true;
          
          if (mask.type === 'linear') {
            mask.startPoint = { x: x / this.imgW, y: y / this.imgH };
            mask.endPoint = { x: x / this.imgW, y: y / this.imgH };
          } else {
            mask.center = { x: x / this.imgW, y: y / this.imgH };
            mask.radiusX = 0.005;
            mask.radiusY = 0.005;
          }
          this.renderGradientMask(mask);
          this.editState._notify();
          return;
        }
      }
    }

    // Default drag-pan trigger
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.container.style.cursor = 'grabbing';
  }

  onPointerMove(e) {
    if (this.isDraggingSplit) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const relX = (e.clientX - canvasRect.left) / canvasRect.width;
      this.updateSplitPosition(relX);
      return;
    }

    const state = this.editState.get();

    // Healing Brush painting move event
    if (this.isPaintingHealing) {
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / rect.width * this.imgW);
        const y = Math.round((e.clientY - rect.top) / rect.height * this.imgH);
        
        const sCtx = this.strokeMaskCanvas.getContext('2d');
        this.drawHealingBrush(sCtx, this.lastPaintX, this.lastPaintY, x, y, state.healingBrushSize, state.healingBrushFeather);
        
        const r = state.healingBrushSize / 2;
        this.healStrokeBoundingBox.minX = Math.min(this.healStrokeBoundingBox.minX, x - r);
        this.healStrokeBoundingBox.minY = Math.min(this.healStrokeBoundingBox.minY, y - r);
        this.healStrokeBoundingBox.maxX = Math.max(this.healStrokeBoundingBox.maxX, x + r);
        this.healStrokeBoundingBox.maxY = Math.max(this.healStrokeBoundingBox.maxY, y + r);
        
        this.lastPaintX = x;
        this.lastPaintY = y;
        this.drawGuides();
      }
      return;
    }
    
    // Mask brush painting move event
    if (this.isPainting && state.activeMaskId) {
      const mask = state.masks.find(m => m.id === state.activeMaskId);
      if (mask && mask.visible) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / rect.width * this.imgW);
        const y = Math.round((e.clientY - rect.top) / rect.height * this.imgH);

        // Draw brush stroke interpolations
        this.paintBrushStroke(mask, this.lastPaintX, this.lastPaintY, x, y);
        this.lastPaintX = x;
        this.lastPaintY = y;
        this.editState._notify();
        return;
      }
    }

    // Mask gradient drag move event
    if (this.isDraggingGradient && state.activeMaskId) {
      const mask = state.masks.find(m => m.id === state.activeMaskId);
      if (mask && mask.visible) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / rect.width * this.imgW);
        const y = Math.round((e.clientY - rect.top) / rect.height * this.imgH);

        if (mask.type === 'linear') {
          mask.endPoint = { x: x / this.imgW, y: y / this.imgH };
        } else {
          const rx = Math.abs(x / this.imgW - mask.center.x);
          const ry = Math.abs(y / this.imgH - mask.center.y);
          mask.radiusX = Math.max(0.005, rx);
          mask.radiusY = Math.max(0.005, ry);
        }
        
        this.renderGradientMask(mask);
        this.editState._notify();
        return;
      }
    }

    if (!this.isDragging) return;

    // Pan image
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;

    this.panX += dx;
    this.panY += dy;

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    this.applyTransform();
  }

  onPointerUp() {
    this.isDragging = false;
    this.isDraggingSplit = false;
    this.container.style.cursor = this.isSpacePressed ? 'grab' : 'default';
    this.splitHandle.style.backgroundColor = 'var(--accent-color)';

    if (this.isPaintingHealing) {
      this.isPaintingHealing = false;
      this.processHealingStroke();
      return;
    }

    if (this.isPainting || this.isDraggingGradient) {
      this.isPainting = false;
      this.isDraggingGradient = false;
      
      // Auto-save trigger
      this.editState._notify();
    }
  }

  onWheel(e) {
    e.preventDefault();

    const zoomIntensity = 0.1;
    const oldZoom = this.zoom;

    // Zoom factor multiplier
    if (e.deltaY < 0) {
      this.zoom *= (1.0 + zoomIntensity);
    } else {
      this.zoom /= (1.0 + zoomIntensity);
    }

    // Constraints: 0.1x to 10x zoom
    this.zoom = Math.max(0.1, Math.min(10.0, this.zoom));

    const parentRect = this.container.getBoundingClientRect();
    const ratio = this.zoom / oldZoom;
    const cx = e.clientX - parentRect.left;
    const cy = e.clientY - parentRect.top;

    this.panX = cx - parentRect.width / 2 + (parentRect.width / 2 + this.panX - cx) * ratio;
    this.panY = cy - parentRect.height / 2 + (parentRect.height / 2 + this.panY - cy) * ratio;

    this.applyTransform();
  }

  // --- Mask Painting Helpers ---

  drawBrushPixel(mask, x, y) {
    const canvas = mask.canvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = mask.brushSize || 50;
    const feather = mask.brushFeather || 50;

    const r1 = size / 2 * (1 - feather / 100);
    const r2 = size / 2;

    const grad = ctx.createRadialGradient(x, y, r1, x, y, r2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r2, 0, Math.PI * 2);
    ctx.fill();
  }

  paintBrushStroke(mask, lastX, lastY, x, y) {
    const canvas = mask.canvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = mask.brushSize || 50;
    const feather = mask.brushFeather || 50;

    const r1 = size / 2 * (1 - feather / 100);
    const r2 = size / 2;

    // Interpolate points between steps to guarantee a solid smooth line
    const dist = Math.hypot(x - lastX, y - lastY);
    const steps = Math.max(1, Math.ceil(dist / 2));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ix = lastX + (x - lastX) * t;
      const iy = lastY + (y - lastY) * t;

      const grad = ctx.createRadialGradient(ix, iy, r1, ix, iy, r2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ix, iy, r2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderGradientMask(mask) {
    const canvas = mask.canvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height); // clear mask

    const w = canvas.width;
    const h = canvas.height;

    if (mask.type === 'linear') {
      const sx = mask.startPoint.x * w;
      const sy = mask.startPoint.y * h;
      const ex = mask.endPoint.x * w;
      const ey = mask.endPoint.y * h;

      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
    } else if (mask.type === 'radial') {
      const cx = mask.center.x * w;
      const cy = mask.center.y * h;
      
      const rx = mask.radiusX * w;
      const ry = mask.radiusY * h;
      const r = Math.max(rx, ry);

      const feather = mask.feather || 50;
      const rInner = r * (1 - feather / 100);

      const grad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Draw a circular radial mask
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getBaseImagePixels() {
    if (this._cachedBasePixels && this._cachedBasePixels.length === this.imgW * this.imgH * 4) {
      return this._cachedBasePixels;
    }
    if (!this.baseImageElement || !this.imgW || !this.imgH) return null;
    const canvas = document.createElement('canvas');
    canvas.width = this.imgW;
    canvas.height = this.imgH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(this.baseImageElement, 0, 0);
    this._cachedBasePixels = ctx.getImageData(0, 0, this.imgW, this.imgH).data;
    return this._cachedBasePixels;
  }

  samplePixelColor(x, y) {
    const pixels = this.getBaseImagePixels();
    if (!pixels) return null;
    const px = Math.max(0, Math.min(this.imgW - 1, x));
    const py = Math.max(0, Math.min(this.imgH - 1, y));
    const i = (py * this.imgW + px) * 4;
    return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
  }

  generateColorRangeMask(mask) {
    const canvas = mask.canvas;
    const pixels = this.getBaseImagePixels();
    if (!canvas || !pixels) return;

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');

    const target = mask.colorTarget || { r: 128, g: 128, b: 128 };
    const tolerance = (mask.colorTolerance !== undefined ? mask.colorTolerance : 30) / 100 * 255;

    const maskImgData = ctx.createImageData(w, h);
    const mPixels = maskImgData.data;

    const tr = target.r;
    const tg = target.g;
    const tb = target.b;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      const dist = Math.sqrt(0.299 * (r - tr) ** 2 + 0.587 * (g - tg) ** 2 + 0.114 * (b - tb) ** 2);
      
      let alpha = 0;
      if (dist < tolerance) {
        const t = dist / tolerance;
        alpha = Math.round(255 * (1.0 - t * t));
      }

      mPixels[i] = 255;
      mPixels[i + 1] = 255;
      mPixels[i + 2] = 255;
      mPixels[i + 3] = alpha;
    }

    ctx.putImageData(maskImgData, 0, 0);
  }

  generateLumaRangeMask(mask) {
    const canvas = mask.canvas;
    const pixels = this.getBaseImagePixels();
    if (!canvas || !pixels) return;

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');

    const minLuma = (mask.lumaMin !== undefined ? mask.lumaMin : 0) / 100 * 255;
    const maxLuma = (mask.lumaMax !== undefined ? mask.lumaMax : 100) / 100 * 255;
    const feather = (mask.lumaFeather !== undefined ? mask.lumaFeather : 20) / 100 * 255;

    const maskImgData = ctx.createImageData(w, h);
    const mPixels = maskImgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      
      let alpha = 255;
      if (luma < minLuma) {
        const d = minLuma - luma;
        alpha = d > feather ? 0 : Math.round(255 * (1 - d / feather));
      } else if (luma > maxLuma) {
        const d = luma - maxLuma;
        alpha = d > feather ? 0 : Math.round(255 * (1 - d / feather));
      }

      mPixels[i] = 255;
      mPixels[i + 1] = 255;
      mPixels[i + 2] = 255;
      mPixels[i + 3] = alpha;
    }

    ctx.putImageData(maskImgData, 0, 0);
  }

  generateMagicWandMask(mask) {
    const canvas = mask.canvas;
    const pixels = this.getBaseImagePixels();
    if (!canvas || !pixels || !mask.wandPoint) return;

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');

    const sx = Math.max(0, Math.min(w - 1, Math.round(mask.wandPoint.x * w)));
    const sy = Math.max(0, Math.min(h - 1, Math.round(mask.wandPoint.y * h)));
    const seedIdx = (sy * w + sx) * 4;
    const sr = pixels[seedIdx];
    const sg = pixels[seedIdx + 1];
    const sb = pixels[seedIdx + 2];

    const tol = (mask.wandTolerance !== undefined ? mask.wandTolerance : 25) / 100 * 255;

    const visited = new Uint8Array(w * h);
    const queue = [sx + sy * w];
    visited[sx + sy * w] = 1;

    const maskImgData = ctx.createImageData(w, h);
    const mPixels = maskImgData.data;

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const px = idx % w;
      const py = Math.floor(idx / w);

      const pIdx = idx * 4;
      const r = pixels[pIdx];
      const g = pixels[pIdx + 1];
      const b = pixels[pIdx + 2];

      const diff = Math.sqrt(0.299 * (r - sr) ** 2 + 0.587 * (g - sg) ** 2 + 0.114 * (b - sb) ** 2);

      if (diff <= tol) {
        mPixels[pIdx] = 255;
        mPixels[pIdx + 1] = 255;
        mPixels[pIdx + 2] = 255;
        mPixels[pIdx + 3] = 255;

        const neighbors = [];
        if (px > 0) neighbors.push(idx - 1);
        if (px < w - 1) neighbors.push(idx + 1);
        if (py > 0) neighbors.push(idx - w);
        if (py < h - 1) neighbors.push(idx + w);

        for (let i = 0; i < neighbors.length; i++) {
          const nIdx = neighbors[i];
          if (!visited[nIdx]) {
            visited[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }

    ctx.putImageData(maskImgData, 0, 0);
  }

  generateAISkyMask(mask) {
    const canvas = mask.canvas;
    const pixels = this.getBaseImagePixels();
    if (!canvas || !pixels) return;

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');

    const maskImgData = ctx.createImageData(w, h);
    const mPixels = maskImgData.data;

    for (let y = 0; y < h; y++) {
      const verticalWeight = 1.0 - (y / h) * 1.1;
      if (verticalWeight <= 0) continue;

      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const blueDom = b - r;
        const isSkyLike = (blueDom > 10 || (luma > 180 && r < 230));

        if (isSkyLike && verticalWeight > 0.05) {
          const score = Math.min(1.0, (blueDom > 0 ? blueDom / 50 : 0.5) * verticalWeight);
          const alpha = Math.round(255 * Math.max(0, score));
          mPixels[i] = 255;
          mPixels[i + 1] = 255;
          mPixels[i + 2] = 255;
          mPixels[i + 3] = alpha;
        }
      }
    }

    ctx.putImageData(maskImgData, 0, 0);
  }

  generateAISubjectMask(mask) {
    const canvas = mask.canvas;
    const pixels = this.getBaseImagePixels();
    if (!canvas || !pixels) return;

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');

    const maskImgData = ctx.createImageData(w, h);
    const mPixels = maskImgData.data;

    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.hypot(cx, cy);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const distFromCenter = Math.hypot(x - cx, y - cy) / maxRadius;
        const centerWeight = Math.max(0, 1.0 - distFromCenter * 1.2);

        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        if (centerWeight > 0.15 && luma > 30 && luma < 240) {
          const alpha = Math.round(255 * centerWeight);
          mPixels[i] = 255;
          mPixels[i + 1] = 255;
          mPixels[i + 2] = 255;
          mPixels[i + 3] = alpha;
        }
      }
    }

    ctx.putImageData(maskImgData, 0, 0);
  }

  drawHealingBrush(ctx, x1, y1, x2, y2, size, feather) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (feather > 0) {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(dist / 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ix = x1 + (x2 - x1) * t;
        const iy = y1 + (y2 - y1) * t;
        
        const rInner = (size / 2) * (1 - feather / 100);
        const rOuter = size / 2;
        
        const grad = ctx.createRadialGradient(ix, iy, rInner, ix, iy, rOuter);
        grad.addColorStop(0, 'rgba(235, 50, 50, 0.7)');
        grad.addColorStop(1, 'rgba(235, 50, 50, 0.0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ix, iy, rOuter, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(235, 50, 50, 0.7)';
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  processHealingStroke() {
    const state = this.editState.get();
    const size = state.healingBrushSize || 30;
    const feather = state.healingBrushFeather || 50;
    
    const pad = Math.ceil(size + feather);
    const box = this.healStrokeBoundingBox;
    
    const x = Math.max(0, Math.floor(box.minX - pad));
    const y = Math.max(0, Math.floor(box.minY - pad));
    const w = Math.min(this.imgW - x, Math.ceil((box.maxX - box.minX) + 2 * pad));
    const h = Math.min(this.imgH - y, Math.ceil((box.maxY - box.minY) + 2 * pad));
    
    if (w > 0 && h > 0) {
      Toast.info('Healing selection...');
      this.activeHealRect = { x, y, w, h };
      
      const ctxOrig = this.originalCanvas.getContext('2d');
      const ctxMask = this.strokeMaskCanvas.getContext('2d');
      
      const imgData = ctxOrig.getImageData(x, y, w, h);
      const maskData = ctxMask.getImageData(x, y, w, h);
      
      // Extract alpha channel to 1-channel array
      const maskAlpha = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        maskAlpha[i] = maskData.data[i * 4 + 3];
      }
      
      this.healingWorker.postMessage({
        pixels: imgData.data,
        mask: maskAlpha,
        width: w,
        height: h
      }, [imgData.data.buffer]);
    } else {
      // Clear temporary canvas
      const sCtx = this.strokeMaskCanvas.getContext('2d');
      sCtx.clearRect(0, 0, this.imgW, this.imgH);
      this.drawGuides();
    }
  }

  applyHealedPixels(result, width, height) {
    if (!this.originalCanvas || !this.healMapCanvas || !this.activeHealRect) return;

    const { x, y, w, h } = this.activeHealRect;
    const ctxOrig = this.originalCanvas.getContext('2d');
    const ctxHeal = this.healMapCanvas.getContext('2d');

    // Create ImageData and put it on originalCanvas (cumulative update)
    const healedImgData = new ImageData(new Uint8ClampedArray(result), w, h);
    ctxOrig.putImageData(healedImgData, x, y);

    // Draw the healed pixels onto the healMapCanvas
    ctxHeal.putImageData(healedImgData, x, y);

    // Upload healMapCanvas to the renderer
    this.renderer.textures.createImageTexture('healMap', this.healMapCanvas);

    // Update editState
    const dataURL = this.healMapCanvas.toDataURL('image/png');
    this.editState.set('healMapPngData', dataURL);
    
    // Clear temporary stroke mask canvas
    if (this.strokeMaskCanvas) {
      const sCtx = this.strokeMaskCanvas.getContext('2d');
      sCtx.clearRect(0, 0, this.imgW, this.imgH);
    }

    Toast.success('Region healed.');
    this.applyTransform();
  }

  async syncHealMap(healMapPngData) {
    if (!this.originalCanvas || !this.healMapCanvas) return;
    
    const oCtx = this.originalCanvas.getContext('2d');
    const hCtx = this.healMapCanvas.getContext('2d');
    
    // Clear healMapCanvas
    hCtx.clearRect(0, 0, this.imgW, this.imgH);
    
    // Reset originalCanvas to base image
    if (this.baseImageElement) {
      oCtx.drawImage(this.baseImageElement, 0, 0);
    }
    
    if (healMapPngData) {
      const healImg = new Image();
      healImg.src = healMapPngData;
      await new Promise(resolve => {
        healImg.onload = resolve;
        healImg.onerror = resolve;
      });
      
      hCtx.drawImage(healImg, 0, 0);
      oCtx.drawImage(healImg, 0, 0);
      
      // Update GL texture
      this.renderer.textures.createImageTexture('healMap', this.healMapCanvas);
    } else {
      // Delete GL texture if no healing
      this.renderer.textures.destroyTexture('healMap');
    }
    
    this.applyTransform();
  }
}
