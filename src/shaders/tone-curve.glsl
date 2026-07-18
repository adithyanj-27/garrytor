#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform sampler2D u_curveLUT; // 256x1 texture. R=Red curve, G=Green, B=Blue, A=Composite RGB

void main() {
  vec4 texColor = texture(u_image, v_texCoord);
  vec3 color = texColor.rgb;

  // 1. Apply RGB Composite curve (stored in alpha channel)
  // We look up the new value using the color channel value as the U coordinate
  float rComp = texture(u_curveLUT, vec2(color.r, 0.5)).a;
  float gComp = texture(u_curveLUT, vec2(color.g, 0.5)).a;
  float bComp = texture(u_curveLUT, vec2(color.b, 0.5)).a;

  // 2. Apply individual channel curves on top of the composite
  color.r = texture(u_curveLUT, vec2(rComp, 0.5)).r;
  color.g = texture(u_curveLUT, vec2(gComp, 0.5)).g;
  color.b = texture(u_curveLUT, vec2(bComp, 0.5)).b;

  // Clamp color to range [0, 1]
  color = clamp(color, 0.0, 1.0);

  fragColor = vec4(color, texColor.a);
}
