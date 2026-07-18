import { getCurveValues } from '../utils/MathUtils';

export class TextureManager {
  constructor(gl) {
    this.gl = gl;
    this.textures = new Map();
  }

  // Create texture from image element
  createImageTexture(key, image) {
    this.destroyTexture(key);
    
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    // Set configuration for high-fidelity resizing
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Flip Y pixels (WebGL texture coordinates start at bottom-left, canvas starts at top-left)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Upload pixels
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    // Reset flip flag so it doesn't affect subsequent WebGL operations (FBO creation, etc.)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    
    this.textures.set(key, tex);
    return tex;
  }

  // Create 1D LUT texture (256x1 RGBA) from Curve states
  createCurveLUTTexture(key, curveState) {
    this.destroyTexture(key);

    const gl = this.gl;
    const rValues = getCurveValues(curveState.r);
    const gValues = getCurveValues(curveState.g);
    const bValues = getCurveValues(curveState.b);
    const rgbValues = getCurveValues(curveState.rgb);

    const lutData = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      lutData[i * 4 + 0] = rValues[i];   // R channel
      lutData[i * 4 + 1] = gValues[i];   // G channel
      lutData[i * 4 + 2] = bValues[i];   // B channel
      lutData[i * 4 + 3] = rgbValues[i]; // A channel
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    // Turn off wrapping & mipmapping (curves need direct coordinate lookups)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(
      gl.TEXTURE_2D, 
      0, 
      gl.RGBA, 
      256, 
      1, 
      0, 
      gl.RGBA, 
      gl.UNSIGNED_BYTE, 
      lutData
    );

    this.textures.set(key, tex);
    return tex;
  }

  // Get active texture reference
  get(key) {
    return this.textures.get(key);
  }

  // Bind texture to a specific unit, e.g. gl.TEXTURE0
  bind(key, unit = 0) {
    const tex = this.textures.get(key);
    if (!tex) return false;

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return true;
  }

  // Remove texture and free memory
  destroyTexture(key) {
    const tex = this.textures.get(key);
    if (tex) {
      this.gl.deleteTexture(tex);
      this.textures.delete(key);
    }
  }

  destroy() {
    for (const key of this.textures.keys()) {
      this.destroyTexture(key);
    }
  }
}
