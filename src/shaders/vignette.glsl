#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform float u_amount;    // -100.0 to 100.0 (negative darkens, positive lightens)
uniform float u_midpoint;  // 0.0 to 100.0 (size of inner circle)
uniform float u_roundness; // -100.0 to 100.0 (warps width vs height)
uniform float u_feather;   // 0.0 to 100.0 (smoothness of transition)

void main() {
  vec4 texColor = texture(u_image, v_texCoord);
  vec3 color = texColor.rgb;

  if (u_amount == 0.0) {
    fragColor = texColor;
    return;
  }

  // Centred coordinate system (-0.5 to 0.5)
  vec2 uv = v_texCoord - vec2(0.5);

  // Apply roundness: warp vertical vs horizontal aspect
  float aspectWarp = 1.0 + (u_roundness / 100.0) * 0.5;
  if (u_roundness > 0.0) {
    uv.x *= aspectWarp;
  } else {
    uv.y *= (1.0 - (u_roundness / 100.0) * 0.5);
  }

  float d = length(uv);

  // Midpoint maps size of vignette
  float mid = (u_midpoint / 100.0) * 0.5;
  // Feather maps transition width
  float feat = (u_feather / 100.0) * 0.5 + 0.01;

  // Calculate interpolation factor
  float start = max(0.0, mid - feat * 0.5);
  float end = min(1.0, mid + feat * 0.5);
  float vignFactor = smoothstep(start, end, d);

  float amt = u_amount / 100.0;
  if (amt < 0.0) {
    // Darken edge pixels
    color = mix(color, color * (1.0 + amt), vignFactor);
  } else {
    // Lighten edge pixels (white vignette)
    color = mix(color, mix(color, vec3(1.0), amt), vignFactor);
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
