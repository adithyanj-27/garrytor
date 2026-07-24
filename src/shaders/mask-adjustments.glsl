#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform sampler2D u_mask;

uniform float u_exposure;     // -5.0 to 5.0
uniform float u_contrast;     // -100.0 to 100.0
uniform float u_highlights;   // -100.0 to 100.0
uniform float u_shadows;      // -100.0 to 100.0
uniform float u_whites;       // -100.0 to 100.0
uniform float u_blacks;       // -100.0 to 100.0
uniform float u_temperature;  // -100.0 to 100.0
uniform float u_tint;         // -100.0 to 100.0
uniform float u_saturation;   // -100.0 to 100.0
uniform float u_clarity;      // -100.0 to 100.0
uniform float u_inverted;     // 0.0 or 1.0
uniform float u_opacity;      // 0.0 to 1.0

float getLuminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 texColor = texture(u_image, v_texCoord);
  float maskVal = texture(u_mask, v_texCoord).r;

  if (u_inverted > 0.5) {
    maskVal = 1.0 - maskVal;
  }
  maskVal *= u_opacity;

  // If mask is completely black, pass through the color unmodified
  if (maskVal <= 0.0) {
    fragColor = texColor;
    return;
  }

  vec3 color = texColor.rgb;

  // Apply Adjustments:
  // 1. Exposure
  color *= pow(2.0, u_exposure);

  // 2. Temperature & Tint
  float t = u_temperature / 100.0;
  float tint = u_tint / 100.0;
  color.r += t * 0.15;
  color.b -= t * 0.15;
  color.g += tint * 0.1;

  // 3. Highlights & Shadows
  float luma = getLuminance(color);
  
  float hiWeight = smoothstep(0.4, 0.9, luma);
  float hiAdjustment = u_highlights / 100.0 * 0.4;
  color += color * hiAdjustment * hiWeight;

  float shWeight = 1.0 - smoothstep(0.1, 0.6, luma);
  float shAdjustment = u_shadows / 100.0 * 0.4;
  color += color * shAdjustment * shWeight;

  // 4. Whites & Blacks
  float whiteWeight = smoothstep(0.7, 1.0, luma);
  float whiteAdjustment = u_whites / 100.0 * 0.5;
  color += color * whiteAdjustment * whiteWeight;

  float blackWeight = 1.0 - smoothstep(0.0, 0.3, luma);
  float blackAdjustment = u_blacks / 100.0 * 0.5;
  color += color * blackAdjustment * blackWeight;

  // 5. Contrast (S-shaped curve)
  if (u_contrast != 0.0) {
    float c = u_contrast / 100.0;
    vec3 sCurve = color * color * (3.0 - 2.0 * color);
    if (c > 0.0) {
      color = mix(color, sCurve, c);
    } else {
      color = mix(color, vec3(0.5), -c);
    }
  }

  // 6. Clarity
  if (u_clarity != 0.0) {
    float clarityFactor = u_clarity / 100.0 * 0.25;
    vec3 diff = color - vec3(luma);
    color += diff * clarityFactor * (1.0 - abs(diff));
  }

  // 7. Saturation
  if (u_saturation != 0.0) {
    float satFactor = (u_saturation + 100.0) / 100.0;
    color = mix(vec3(getLuminance(color)), color, satFactor);
  }

  color = clamp(color, 0.0, 1.0);

  // Mix adjusted color with original based on mask strength
  vec3 finalColor = mix(texColor.rgb, color, maskVal);

  fragColor = vec4(finalColor, texColor.a);
}
