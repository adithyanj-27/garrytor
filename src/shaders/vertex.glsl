#version 300 es
in vec2 position;
out vec2 v_texCoord;

void main() {
  // Map positions from [-1, 1] to [0, 1] for texture coordinates
  v_texCoord = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
