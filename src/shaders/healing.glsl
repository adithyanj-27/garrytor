#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform sampler2D u_healMap;   // Rgba: rgb = healed pixels, a = blend weight (0=no heal, 1=full heal)
uniform bool u_hasHealMap;     // true if a heal texture exists

void main() {
  vec4 color = texture(u_image, v_texCoord);

  if (u_hasHealMap) {
    vec4 healData = texture(u_healMap, v_texCoord);
    float blendAlpha = healData.a;
    if (blendAlpha > 0.0) {
      color.rgb = mix(color.rgb, healData.rgb, blendAlpha);
    }
  }

  fragColor = color;
}
