import { getCurveValues } from '../../utils/MathUtils';

export class CurvesPanel {
  constructor(container, editState, mainApp = null) {
    this.container = container;
    this.editState = editState;
    this.mainApp = mainApp;
    this.activeChannel = 'rgb'; // 'rgb', 'r', 'g', 'b'
    this.draggedPointIdx = -1;
    this.activePointIdx = -1;
    
    this.init();
    
    // Subscribe to state to update if reset/preset applied
    this.unsubscribe = this.editState.onChange(() => this.draw());
  }

  init() {
    this.container.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'curves-container';

    // Channel Selector tabs
    const tabs = document.createElement('div');
    tabs.className = 'curves-tabs';
    
    const channels = [
      { key: 'rgb', label: 'RGB' },
      { key: 'r', label: 'Red' },
      { key: 'g', label: 'Green' },
      { key: 'b', label: 'Blue' }
    ];

    channels.forEach(ch => {
      const tab = document.createElement('div');
      tab.className = `curve-tab curve-tab-${ch.key} ${ch.key === this.activeChannel ? 'active' : ''}`;
      tab.textContent = ch.label;
      tab.addEventListener('click', () => {
        // Change active channel
        document.querySelectorAll('.curve-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeChannel = ch.key;
        this.draw();
      });
      tabs.appendChild(tab);
    });

    panel.appendChild(tabs);

    // Canvas Element
    const canvas = document.createElement('canvas');
    canvas.className = 'curves-canvas';
    canvas.width = 256;
    canvas.height = 256;
    panel.appendChild(canvas);

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this._boundPointerUp = () => this.onPointerUp();
    // Add pointer events for dragging
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', this._boundPointerUp);
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

    this.container.appendChild(panel);
    this.draw();
  }

  // Cleanup is handled in the unified destroy() method at the bottom of this class

  // Get curve control points for current active channel
  getPoints() {
    return this.editState.get().curve[this.activeChannel];
  }

  setPoints(points) {
    this.editState.set(`curve.${this.activeChannel}`, points);
  }

  // Draw grid, histogram background, curve, and points
  draw() {
    if (!this.canvas) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear
    ctx.clearRect(0, 0, w, h);

    // 1. Draw Grid lines
    ctx.strokeStyle = '#222226';
    ctx.lineWidth = 1;
    for (let i = 64; i < 256; i += 64) {
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();

      // Vertical
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    
    // Diagonal reference line
    ctx.strokeStyle = '#2b2b30';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.stroke();

    // 2. Draw Histogram if main app has it
    if (this.mainApp && this.mainApp.histogramData) {
      this._drawHistogramBackground();
    }

    // 3. Draw Spline Curve line
    const points = this.getPoints();
    const values = getCurveValues(points);

    // Color curve according to active channel
    let curveColor = '#ffffff';
    if (this.activeChannel === 'r') curveColor = '#f43f5e';
    if (this.activeChannel === 'g') curveColor = '#10b981';
    if (this.activeChannel === 'b') curveColor = '#3b82f6';

    ctx.strokeStyle = curveColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h - values[0]);

    for (let i = 1; i < 256; i++) {
      ctx.lineTo(i, h - values[i]);
    }
    ctx.stroke();

    // 4. Draw control points
    points.forEach((pt, idx) => {
      ctx.fillStyle = idx === this.activePointIdx ? '#ff8c42' : curveColor;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      // Y-axis in WebGL starts from bottom, canvas starts from top
      ctx.arc(pt[0], h - pt[1], idx === this.activePointIdx ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  // Draw semi-transparent histogram in curves panel
  _drawHistogramBackground() {
    const data = this.mainApp.histogramData;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    let bin = data.lBin; // Default luminance
    let color = 'rgba(255, 255, 255, 0.04)';

    if (this.activeChannel === 'r') { bin = data.rBin; color = 'rgba(244, 63, 94, 0.04)'; }
    if (this.activeChannel === 'g') { bin = data.gBin; color = 'rgba(16, 185, 129, 0.04)'; }
    if (this.activeChannel === 'b') { bin = data.bBin; color = 'rgba(59, 130, 246, 0.04)'; }

    // Find peak
    let max = 0;
    for (let i = 5; i < 250; i++) max = Math.max(max, bin[i]);
    if (max === 0) return;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);

    for (let i = 0; i < 256; i++) {
      const x = i;
      const y = h - (bin[i] / max) * (h * 0.7); // scale height slightly down
      ctx.lineTo(x, y);
    }
    
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // Convert mouse event to canvas coordinate [x, y]
  _getEventCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(rect.bottom - e.clientY); // flip Y axis to match curves
    return [Math.max(0, Math.min(255, x)), Math.max(0, Math.min(255, y))];
  }

  onPointerDown(e) {
    const [x, y] = this._getEventCoords(e);
    const points = this.getPoints();

    // Support double-tap to delete points on touch screens
    const now = Date.now();
    const isDoubleTap = (now - (this.lastTapTime || 0) < 300);
    this.lastTapTime = now;

    if (isDoubleTap) {
      let clickedIdx = -1;
      for (let i = 0; i < points.length; i++) {
        const d = Math.hypot(points[i][0] - x, points[i][1] - y);
        if (d < 8) {
          clickedIdx = i;
          break;
        }
      }
      if (clickedIdx > 0 && clickedIdx < points.length - 1) {
        const updated = [...points];
        updated.splice(clickedIdx, 1);
        this.setPoints(updated);
        this.draggedPointIdx = -1;
        this.activePointIdx = -1;
        this.draw();
        return;
      }
    }
    
    // Find if clicked near an existing control point (within 8 pixels)
    let foundIdx = -1;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i][0] - x, points[i][1] - y);
      if (d < 8) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== -1) {
      // Clicked on a point
      this.draggedPointIdx = foundIdx;
      this.activePointIdx = foundIdx;
    } else {
      // Clicked on empty space -> add new point
      // Endpoints cannot be split, new point inserts between existing points
      const newPt = [x, y];
      let insertIdx = 0;
      while (insertIdx < points.length && points[insertIdx][0] < x) {
        insertIdx++;
      }

      // Add point
      const updated = [...points];
      updated.splice(insertIdx, 0, newPt);
      this.setPoints(updated);
      
      this.draggedPointIdx = insertIdx;
      this.activePointIdx = insertIdx;
    }

    this.draw();
  }

  onPointerMove(e) {
    if (this.draggedPointIdx === -1) return;

    const [x, y] = this._getEventCoords(e);
    const points = [...this.getPoints()];
    const idx = this.draggedPointIdx;

    // Boundary constraints: point X value cannot cross adjacent points
    const minX = idx > 0 ? points[idx - 1][0] + 1 : 0;
    const maxX = idx < points.length - 1 ? points[idx + 1][0] - 1 : 255;

    // Apply constraints
    // Endpoints (0 and length-1) can only move vertically (Y axis), X is fixed
    if (idx === 0) {
      points[idx] = [0, y];
    } else if (idx === points.length - 1) {
      points[idx] = [255, y];
    } else {
      points[idx] = [Math.max(minX, Math.min(maxX, x)), y];
    }

    this.setPoints(points);
    this.draw();
  }

  onPointerUp() {
    this.draggedPointIdx = -1;
  }

  onDoubleClick(e) {
    const [x, y] = this._getEventCoords(e);
    const points = this.getPoints();

    // Find point clicked
    let clickedIdx = -1;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i][0] - x, points[i][1] - y);
      if (d < 8) {
        clickedIdx = i;
        break;
      }
    }

    // Endpoints cannot be deleted
    if (clickedIdx > 0 && clickedIdx < points.length - 1) {
      const updated = [...points];
      updated.splice(clickedIdx, 1);
      this.setPoints(updated);
      
      this.draggedPointIdx = -1;
      this.activePointIdx = -1;
      this.draw();
    }
  }

  destroy() {
    window.removeEventListener('pointerup', this._boundPointerUp);
    this.unsubscribe();
  }
}
