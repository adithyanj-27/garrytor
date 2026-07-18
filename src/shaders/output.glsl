#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;       // Processed texture
uniform sampler2D u_sourceImage; // Original unedited texture
uniform float u_splitX;          // 0.0 to 1.0 (split position)

uniform sampler2D u_overlayMask;  // Current mask texture for overlay
uniform bool u_showOverlay;       // Whether to show the overlay

// Classic pseudorandom generator for dithering
float random(vec2 uv) {
  return fract(sin(dot(uv.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec4 processed = texture(u_image, v_texCoord);
  vec4 original = texture(u_sourceImage, v_texCoord);
  
  vec3 color = (v_texCoord.x < u_splitX) ? processed.rgb : original.rgb;

  // Add micro-noise dithering (1/256 amplitude) to smooth out curves and HSL banding
  float dither = (random(v_texCoord) - 0.5) / 256.0;
  color += vec3(dither);

  // Apply ruby red mask overlay if requested
  if (u_showOverlay) {
    float maskVal = texture(u_overlayMask, v_texCoord).r;
    if (maskVal > 0.0) {
      vec3 rubyRed = vec3(0.9, 0.15, 0.15);
      color = mix(color, rubyRed, maskVal * 0.55);
    }
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), processed.a);
}
