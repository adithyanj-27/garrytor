export class Histogram {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Bin arrays (size 256)
    this.rBin = new Uint32Array(256);
    this.gBin = new Uint32Array(256);
    this.bBin = new Uint32Array(256);
    this.lBin = new Uint32Array(256);
  }

  // Update histogram counts from raw pixel data
  // pixels: Uint8Array containing RGBA values
  update(pixels) {
    if (!pixels || pixels.length === 0) return;

    // Reset bins
    this.rBin.fill(0);
    this.gBin.fill(0);
    this.bBin.fill(0);
    this.lBin.fill(0);

    const length = pixels.length;
    // Downsample parsing: skip pixels to keep histogram calculation under 1ms
    // e.g. step by 16 channels (4 pixels) or more depending on size
    const step = length > 1000000 ? 16 : 4; 

    for (let i = 0; i < length; i += step) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      
      // Standard luminance coefficient
      const l = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

      this.rBin[r]++;
      this.gBin[g]++;
      this.bBin[b]++;
      this.lBin[l]++;
    }

    this.draw();
  }

  // Draw smooth overlay curves on the 2D canvas
  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear background
    ctx.clearRect(0, 0, w, h);

    // Find peak value across bins (to normalize height scaling)
    let maxVal = 0;
    for (let i = 2; i < 254; i++) { // Ignore extreme clipping values for scaling
      maxVal = Math.max(maxVal, this.rBin[i], this.gBin[i], this.bBin[i], this.lBin[i]);
    }

    if (maxVal === 0) return;

    // Draw channels
    this._drawChannel(this.rBin, 'rgba(244, 63, 94, 0.45)', maxVal); // Red
    this._drawChannel(this.gBin, 'rgba(16, 185, 129, 0.45)', maxVal); // Green
    this._drawChannel(this.bBin, 'rgba(59, 130, 246, 0.45)', maxVal); // Blue
    this._drawChannel(this.lBin, 'rgba(240, 240, 243, 0.18)', maxVal); // Luminance / Gray
  }

  // Helper to draw a filled histogram path
  _drawChannel(bin, color, maxVal) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);

    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * w;
      // Clamp height to leave small spacing at the top
      const val = (bin[i] / maxVal) * (h - 4);
      const y = h - val;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
}
