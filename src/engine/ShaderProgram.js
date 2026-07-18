export class ShaderProgram {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    this.program = this._createProgram(vertexSource, fragmentSource);
    this.uniforms = {};
    this._cacheUniforms();
  }

  // Bind the program
  use() {
    this.gl.useProgram(this.program);
  }

  // Set uniform values
  setFloat(name, val) {
    const loc = this._getUniformLocation(name);
    if (loc) this.gl.uniform1f(loc, val);
  }

  setVec2(name, x, y) {
    const loc = this._getUniformLocation(name);
    if (loc) this.gl.uniform2f(loc, x, y);
  }

  setVec3(name, x, y, z) {
    const loc = this._getUniformLocation(name);
    if (loc) this.gl.uniform3f(loc, x, y, z);
  }

  setMat3(name, transpose, valArray) {
    const loc = this._getUniformLocation(name);
    if (loc) this.gl.uniformMatrix3fv(loc, transpose, valArray);
  }

  setInt(name, val) {
    const loc = this._getUniformLocation(name);
    if (loc !== null) this.gl.uniform1i(loc, val);
  }

  setBool(name, val) {
    const loc = this._getUniformLocation(name);
    if (loc !== null) this.gl.uniform1i(loc, val ? 1 : 0);
  }

  // Get uniform location
  _getUniformLocation(name) {
    if (this.uniforms[name] !== undefined) {
      return this.uniforms[name];
    }
    const loc = this.gl.getUniformLocation(this.program, name);
    this.uniforms[name] = loc;
    return loc;
  }

  // Cache standard active uniforms
  _cacheUniforms() {
    const numUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = this.gl.getActiveUniform(this.program, i);
      this._getUniformLocation(info.name);
    }
  }

  // Compile individual shader
  _compileShader(source, type) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const log = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${log}\nSource: ${source}`);
    }
    return shader;
  }

  // Link vertex and fragment shader
  _createProgram(vertexSource, fragmentSource) {
    const vs = this._compileShader(vertexSource, this.gl.VERTEX_SHADER);
    const fs = this._compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);
    
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    
    // Detach and delete shaders once linked
    this.gl.detachShader(program, vs);
    this.gl.detachShader(program, fs);
    this.gl.deleteShader(vs);
    this.gl.deleteShader(fs);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const log = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Program link failed: ${log}`);
    }
    return program;
  }

  // Clean up
  destroy() {
    this.gl.deleteProgram(this.program);
  }
}
