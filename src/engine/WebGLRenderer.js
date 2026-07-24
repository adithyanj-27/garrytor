import { ShaderProgram } from './ShaderProgram';
import { TextureManager } from './TextureManager';

// Shader source imports via Vite raw loader (?raw)
import vertexSource from '../shaders/vertex.glsl?raw';
import basicSource from '../shaders/basic-adjustments.glsl?raw';
import curveSource from '../shaders/tone-curve.glsl?raw';
import hslSource from '../shaders/hsl-mixer.glsl?raw';
import sharpenSource from '../shaders/sharpening.glsl?raw';
import vignetteSource from '../shaders/vignette.glsl?raw';
import outputSource from '../shaders/output.glsl?raw';
import maskAdjustmentsSource from '../shaders/mask-adjustments.glsl?raw';
import healingSource from '../shaders/healing.glsl?raw';
import lensBlurSource from '../shaders/lens-blur.glsl?raw';

export class WebGLRenderer {
  constructor() {
    this.canvas = null;
    this.gl = null;
    
    // Shader Programs
    this.shaders = {};
    
    // Textures & FBOs
    this.textures = null;
    this.fboA = null;
    this.fboB = null;
    this.fboTextureA = null;
    this.fboTextureB = null;
    this.lastProcessedFBO = null;
    
    // Image scale & viewport dimensions
    this.imageWidth = 0;
    this.imageHeight = 0;
    
    // Quad Geometry buffers
    this.quadVAO = null;
    this.quadVBO = null;
  }

  // Initialize WebGL context
  init(canvas) {
    this.canvas = canvas;

    if (!this._contextListenersBound) {
      this._contextListenersBound = true;
      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('WebGL context lost');
      }, false);
      
      this.canvas.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored');
        this.init(this.canvas);
        // We'd need the viewport to redraw, but we don't have a direct reference here.
        // Usually the app level would listen, but this attempts to recover internal state.
      }, false);
    }
    this.gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true // Crucial for reading pixels on export
    });

    if (!this.gl) {
      throw new Error('WebGL 2.0 context is not supported by your browser.');
    }

    const gl = this.gl;
    this.textures = new TextureManager(gl);

    // Compile shader programs
    this.shaders.basic = new ShaderProgram(gl, vertexSource, basicSource);
    this.shaders.curve = new ShaderProgram(gl, vertexSource, curveSource);
    this.shaders.hsl = new ShaderProgram(gl, vertexSource, hslSource);
    this.shaders.sharpen = new ShaderProgram(gl, vertexSource, sharpenSource);
    this.shaders.vignette = new ShaderProgram(gl, vertexSource, vignetteSource);
    this.shaders.output = new ShaderProgram(gl, vertexSource, outputSource);
    this.shaders.maskAdjustments = new ShaderProgram(gl, vertexSource, maskAdjustmentsSource);
    this.shaders.healing = new ShaderProgram(gl, vertexSource, healingSource);
    this.shaders.lensBlur = new ShaderProgram(gl, vertexSource, lensBlurSource);

    // Setup fullscreen quad geometry
    this._initQuadGeometry();
  }

  // Upload source image and prepare FBOs
  loadImage(imageElement) {
    this.imageWidth = imageElement.naturalWidth || imageElement.width;
    this.imageHeight = imageElement.naturalHeight || imageElement.height;

    // Reset texture cache
    this.textures.destroy();

    // Upload original image as base texture
    this.textures.createImageTexture('source', imageElement);

    // Set up ping-pong Framebuffers matching source image dimensions
    this._recreateFBOs(this.imageWidth, this.imageHeight);
  }

  render(editState) {
    if (!this.gl || !this.textures.get('source')) return;

    const gl = this.gl;
    const state = editState.get();
    const basicState = state.basic;

    // Bind Quad Vertex Array
    gl.bindVertexArray(this.quadVAO);

    // Dynamic FBO swap tracking
    let currentInputTex = null;
    let currentOutputFBO = this.fboA;

    // ── Pass 0: Healing brush compositing ────────────────────────────────
    // If there is a heal map texture, composite healed patches first
    const pHealing = this.shaders.healing;
    pHealing.use();
    this._bindFBO(this.fboA);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    this.textures.bind('source', 0);
    pHealing.setInt('u_image', 0);
    
    if (this.textures.get('healMap')) {
      this.textures.bind('healMap', 1);
      pHealing.setInt('u_healMap', 1);
      pHealing.setBool('u_hasHealMap', true);
    } else {
      pHealing.setBool('u_hasHealMap', false);
    }
    this._drawQuad();

    // After Pass 0: FBO A contains the healed source
    currentInputTex = this.fboTextureA;
    currentOutputFBO = this.fboB;


    const swapPingPong = () => {
      if (currentInputTex === this.fboTextureA) {
        currentInputTex = this.fboTextureB;
        currentOutputFBO = this.fboA;
      } else {
        currentInputTex = this.fboTextureA;
        currentOutputFBO = this.fboB;
      }
    };

    // ── Pass 1: Basic adjustments ─────────────────────────────────────────
    this._bindFBO(currentOutputFBO);
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    const pBasic = this.shaders.basic;
    pBasic.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
    pBasic.setInt('u_image', 0);
    pBasic.setFloat('u_exposure', basicState.exposure);
    pBasic.setFloat('u_contrast', basicState.contrast);
    pBasic.setFloat('u_highlights', basicState.highlights);
    pBasic.setFloat('u_shadows', basicState.shadows);
    pBasic.setFloat('u_whites', basicState.whites);
    pBasic.setFloat('u_blacks', basicState.blacks);
    const normalizedTemp = (basicState.temperature - 6500) / (basicState.temperature > 6500 ? 43500 : 4500);
    pBasic.setFloat('u_temperature', normalizedTemp * 100.0);
    pBasic.setFloat('u_tint', basicState.tint);
    pBasic.setFloat('u_vibrance', basicState.vibrance);
    pBasic.setFloat('u_saturation', basicState.saturation);
    pBasic.setFloat('u_clarity', basicState.clarity);
    this._drawQuad();
    swapPingPong();

    // ── Pass 2: Tone Curve ────────────────────────────────────────────────
    this._bindFBO(currentOutputFBO);
    this.textures.createCurveLUTTexture('curveLUT', state.curve);
    const pCurve = this.shaders.curve;
    pCurve.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
    pCurve.setInt('u_image', 0);
    this.textures.bind('curveLUT', 1);
    pCurve.setInt('u_curveLUT', 1);
    this._drawQuad();
    swapPingPong();

    // ── Pass 3: HSL Mixer ─────────────────────────────────────────────────
    this._bindFBO(currentOutputFBO);
    
    const pHSL = this.shaders.hsl;
    pHSL.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
    pHSL.setInt('u_image', 0);
    
    // Pass HSL color channel adjustments
    const hsl = state.hsl;
    pHSL.setVec3('u_red', hsl.red.h, hsl.red.s, hsl.red.l);
    pHSL.setVec3('u_orange', hsl.orange.h, hsl.orange.s, hsl.orange.l);
    pHSL.setVec3('u_yellow', hsl.yellow.h, hsl.yellow.s, hsl.yellow.l);
    pHSL.setVec3('u_green', hsl.green.h, hsl.green.s, hsl.green.l);
    pHSL.setVec3('u_aqua', hsl.aqua.h, hsl.aqua.s, hsl.aqua.l);
    pHSL.setVec3('u_blue', hsl.blue.h, hsl.blue.s, hsl.blue.l);
    pHSL.setVec3('u_purple', hsl.purple.h, hsl.purple.s, hsl.purple.l);
    pHSL.setVec3('u_magenta', hsl.magenta.h, hsl.magenta.s, hsl.magenta.l);
    
    this._drawQuad();
    swapPingPong();

    // Pass 4: Local Mask Adjustments
    if (state.masks && state.masks.length > 0) {
      const pMaskAdj = this.shaders.maskAdjustments;
      pMaskAdj.use();

      const currentMaskIds = new Set();

      for (const mask of state.masks) {
        if (!mask.canvas || mask.visible === false) continue;

        const texKey = 'mask_' + mask.id;
        currentMaskIds.add(texKey);

        // Upload/bind the mask pixels to WebGL texture
        this.textures.createImageTexture(texKey, mask.canvas);

        this._bindFBO(currentOutputFBO);
        
        // Bind input image to unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
        pMaskAdj.setInt('u_image', 0);

        // Bind mask texture to unit 1
        this.textures.bind(texKey, 1);
        pMaskAdj.setInt('u_mask', 1);

        // Set mask settings uniforms
        const s = mask.settings;
        pMaskAdj.setFloat('u_exposure', s.exposure || 0);
        pMaskAdj.setFloat('u_contrast', s.contrast || 0);
        pMaskAdj.setFloat('u_highlights', s.highlights || 0);
        pMaskAdj.setFloat('u_shadows', s.shadows || 0);
        pMaskAdj.setFloat('u_whites', s.whites || 0);
        pMaskAdj.setFloat('u_blacks', s.blacks || 0);
        pMaskAdj.setFloat('u_temperature', s.temperature || 0);
        pMaskAdj.setFloat('u_tint', s.tint || 0);
        pMaskAdj.setFloat('u_saturation', s.saturation || 0);
        pMaskAdj.setFloat('u_clarity', s.clarity || 0);
        pMaskAdj.setFloat('u_inverted', mask.inverted ? 1.0 : 0.0);
        pMaskAdj.setFloat('u_opacity', mask.opacity !== undefined ? mask.opacity / 100.0 : 1.0);

        this._drawQuad();
        swapPingPong();
      }

      // Free textures for masks that no longer exist
      for (const key of this.textures.textures.keys()) {
        if (key.startsWith('mask_') && !currentMaskIds.has(key)) {
          this.textures.destroyTexture(key);
        }
      }
    } else {
      // Clean up all mask textures if there are no masks
      for (const key of this.textures.textures.keys()) {
        if (key.startsWith('mask_')) {
          this.textures.destroyTexture(key);
        }
      }
    }

    // Pass 5: Sharpening
    this._bindFBO(currentOutputFBO);
    
    const pSharpen = this.shaders.sharpen;
    pSharpen.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
    pSharpen.setInt('u_image', 0);
    pSharpen.setVec2('u_resolution', this.imageWidth, this.imageHeight);
    pSharpen.setFloat('u_amount', state.sharpening.amount);
    
    this._drawQuad();
    swapPingPong();

    // Pass 6: Vignette
    this._bindFBO(currentOutputFBO);
    
    const pVignette = this.shaders.vignette;
    pVignette.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
    pVignette.setInt('u_image', 0);
    
    const vig = state.vignette;
    pVignette.setFloat('u_amount', vig.amount);
    pVignette.setFloat('u_midpoint', vig.midpoint);
    pVignette.setFloat('u_roundness', vig.roundness);
    pVignette.setFloat('u_feather', vig.feather);
    
    this._drawQuad();
    swapPingPong();

    // ── Pass 7: Lens Blur (Depth of Field) ──────────────────────────────
    const lb = state.lensBlur;
    if (lb && lb.amount > 0 && lb.focalPoint) {
      this._bindFBO(currentOutputFBO);
      const pLensBlur = this.shaders.lensBlur;
      pLensBlur.use();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
      pLensBlur.setInt('u_image', 0);
      pLensBlur.setFloat('u_amount', lb.amount / 100.0);
      pLensBlur.setFloat('u_focalX', lb.focalPoint.x);
      pLensBlur.setFloat('u_focalY', lb.focalPoint.y);
      pLensBlur.setFloat('u_focalRadius', lb.focalRadius !== undefined ? lb.focalRadius : 0.1);
      pLensBlur.setFloat('u_maxRadius', (lb.amount / 100.0) * 40.0 + 5.0);
      pLensBlur.setVec2('u_resolution', this.imageWidth, this.imageHeight);
      pLensBlur.setInt('u_bokehShape', lb.bokehShape === 'hexagon' ? 1 : 0);
      this._drawQuad();
      swapPingPong();
    }

    // Track which FBO holds the final processed output
    this.lastProcessedFBO = (currentInputTex === this.fboTextureA) ? this.fboA : this.fboB;

    // ── Pass 8: Output / Dither to Screen canvas ─────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    const pOutput = this.shaders.output;
    pOutput.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentInputTex);
    pOutput.setInt('u_image', 0);
    
    // Bind original source texture to unit 1
    this.textures.bind('source', 1);
    pOutput.setInt('u_sourceImage', 1);
    
    // Set split location (defaults to 1.0 = fully edited)
    const splitX = state.splitX !== undefined ? state.splitX : 1.0;
    pOutput.setFloat('u_splitX', splitX);

    // Bind current active mask texture to unit 2 for overlay display
    if (state.showOverlay && state.activeMaskId) {
      const activeMask = state.masks.find(m => m.id === state.activeMaskId);
      if (activeMask && activeMask.canvas) {
        this.textures.bind('mask_' + state.activeMaskId, 2);
        pOutput.setInt('u_overlayMask', 2);
        pOutput.setBool('u_showOverlay', true);
      } else {
        pOutput.setBool('u_showOverlay', false);
      }
    } else {
      pOutput.setBool('u_showOverlay', false);
    }
    
    this._drawQuad();

    // Cleanup active VAO binding
    gl.bindVertexArray(null);
  }

  // High-speed downsampled readback for histogram (<0.2ms vs 80ms)
  readHistogramPixels() {
    const gl = this.gl;
    if (!this.lastProcessedFBO || !this.gl) return null;
    
    const w = 256;
    const h = 144;

    if (!this._histFBO) {
      this._histTex = this._createFBOTexture(w, h);
      this._histFBO = this._createFBO(this._histTex);
    }

    const prevFBO = this.lastProcessedFBO;
    this._bindFBO(this._histFBO);
    gl.viewport(0, 0, w, h);

    const pOutput = this.shaders.output;
    pOutput.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, prevFBO === this.fboA ? this.fboTextureA : this.fboTextureB);
    pOutput.setInt('u_image', 0);
    pOutput.setBool('u_showOverlay', false);
    this._drawQuad();

    if (!this._histPixels) {
      this._histPixels = new Uint8Array(w * h * 4);
    }

    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, this._histPixels);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    return this._histPixels;
  }

  // Read WebGL canvas pixels for PNG/JPEG export
  readPixels() {
    const gl = this.gl;
    const w = this.imageWidth;
    const h = this.imageHeight;
    
    // We bind FBO containing the last processed full-res image
    this._bindFBO(this.lastProcessedFBO || this.fboA);
    
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    // Unbind FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // Flip image vertically (WebGL texture origin is bottom-left, canvas is top-left)
    const flippedPixels = new Uint8Array(w * h * 4);
    const rowBytes = w * 4;
    for (let r = 0; r < h; r++) {
      const srcIdx = r * rowBytes;
      const destIdx = (h - r - 1) * rowBytes;
      flippedPixels.set(pixels.subarray(srcIdx, srcIdx + rowBytes), destIdx);
    }
    
    return new ImageData(new Uint8ClampedArray(flippedPixels), w, h);
  }

  // Create standard 2D vertex coordinates covering the screen (-1 to 1)
  _initQuadGeometry() {
    const gl = this.gl;
    
    // Fullscreen quad vertices (pos.x, pos.y)
    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]);

    this.quadVAO = gl.createVertexArray();
    this.quadVBO = gl.createBuffer();

    gl.bindVertexArray(this.quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // position attribute (2 floats)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  // Helper to bind framebuffers
  _bindFBO(fbo) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
  }

  // Perform draw call
  _drawQuad() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  // Recreate framebuffers matching source image dimensions
  _recreateFBOs(w, h) {
    const gl = this.gl;

    // Delete existing
    if (this.fboA) gl.deleteFramebuffer(this.fboA);
    if (this.fboB) gl.deleteFramebuffer(this.fboB);
    if (this.fboTextureA) gl.deleteTexture(this.fboTextureA);
    if (this.fboTextureB) gl.deleteTexture(this.fboTextureB);

    // Create textures
    this.fboTextureA = this._createFBOTexture(w, h);
    this.fboTextureB = this._createFBOTexture(w, h);

    // Create FBOs
    this.fboA = this._createFBO(this.fboTextureA);
    this.fboB = this._createFBO(this.fboTextureB);
  }

  _createFBOTexture(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }

  _createFBO(tex) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer creation failed: status ${status}`);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fbo;
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;

    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    if (this.quadVBO) gl.deleteBuffer(this.quadVBO);
    
    if (this.fboA) gl.deleteFramebuffer(this.fboA);
    if (this.fboB) gl.deleteFramebuffer(this.fboB);
    if (this.fboTextureA) gl.deleteTexture(this.fboTextureA);
    if (this.fboTextureB) gl.deleteTexture(this.fboTextureB);

    this.textures.destroy();
    
    for (const key in this.shaders) {
      this.shaders[key].destroy();
    }
  }
}
