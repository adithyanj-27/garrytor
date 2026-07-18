#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform vec2 u_resolution; // Dimensions of texture
uniform float u_amount;    // 0 to 100

void main() {
  vec4 centerColor = texture(u_image, v_texCoord);
  
  if (u_amount <= 0.0) {
    fragColor = centerColor;
    return;
  }

  vec2 step = 1.0 / u_resolution;

  // Sample 4-point neighbors for a simple box blur
  vec3 neighborColors = (
    texture(u_image, v_texCoord + vec2(0.0, step.y)).rgb +
    texture(u_image, v_texCoord - vec2(0.0, step.y)).rgb +
    texture(u_image, v_texCoord + vec2(step.x, 0.0)).rgb +
    texture(u_image, v_texCoord - vec2(step.x, 0.0)).rgb
  ) * 0.25;

  // Unsharp mask formula
  float factor = u_amount / 100.0 * 1.5;
  vec3 sharpened = centerColor.rgb + (centerColor.rgb - neighborColors) * factor;

  fragColor = vec4(clamp(sharpened, 0.0, 1.0), centerColor.a);
}
