#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;

// Uniforms: vec3(hueShift, satMult, lumMult)
// shifts: -180 to 180 (will map to -0.5 to 0.5 in shader)
// multipliers: -100 to 100 (will map to -1.0 to 1.0 in shader)
uniform vec3 u_red;
uniform vec3 u_orange;
uniform vec3 u_yellow;
uniform vec3 u_green;
uniform vec3 u_aqua;
uniform vec3 u_blue;
uniform vec3 u_purple;
uniform vec3 u_magenta;

// RGB -> HSL Conversion
vec3 rgb2hsl(vec3 c) {
  float minVal = min(min(c.r, c.g), c.b);
  float maxVal = max(max(c.r, c.g), c.b);
  float delta = maxVal - minVal;

  vec3 hsl = vec3(0.0);
  hsl.z = (maxVal + minVal) * 0.5; // Lightness

  if (delta == 0.0) {
    hsl.x = 0.0; // Hue
    hsl.y = 0.0; // Saturation
  } else {
    // Saturation
    if (hsl.z < 0.5) {
      hsl.y = delta / (maxVal + minVal);
    } else {
      hsl.y = delta / (2.0 - maxVal - minVal);
    }

    // Hue
    if (c.r == maxVal) {
      hsl.x = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
    } else if (c.g == maxVal) {
      hsl.x = (c.b - c.r) / delta + 2.0;
    } else {
      hsl.x = (c.r - c.g) / delta + 4.0;
    }
    hsl.x /= 6.0;
  }
  return hsl;
}

// HSL Helper
float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0 / 2.0) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

// HSL -> RGB Conversion
vec3 hsl2rgb(vec3 hsl) {
  vec3 rgb;

  if (hsl.y == 0.0) {
    rgb = vec3(hsl.z); // achromatic
  } else {
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;

    rgb.r = hue2rgb(p, q, hsl.x + 1.0 / 3.0);
    rgb.g = hue2rgb(p, q, hsl.x);
    rgb.b = hue2rgb(p, q, hsl.x - 1.0 / 3.0);
  }
  return rgb;
}

// Calculate color zone weight based on Hue (0.0 to 1.0 range)
float getZoneWeight(float hue, float center, float width) {
  float d = abs(hue - center);
  if (d > 0.5) d = 1.0 - d; // Handle circular wrapping at 1.0 -> 0.0
  return smoothstep(width, 0.0, d);
}

void main() {
  vec4 texColor = texture(u_image, v_texCoord);
  vec3 color = texColor.rgb;

  // Convert to HSL
  vec3 hsl = rgb2hsl(color);
  float h = hsl.x;

  // Define HSL center points in 0-1 scale
  float c_red = 0.0;
  float c_orange = 30.0 / 360.0;
  float c_yellow = 60.0 / 360.0;
  float c_green = 120.0 / 360.0;
  float c_aqua = 180.0 / 360.0;
  float c_blue = 240.0 / 360.0;
  float c_purple = 290.0 / 360.0;
  float c_magenta = 330.0 / 360.0;

  // Widths (ranges) for each color zone (overlap allowed for smooth transitions)
  float w_red = 35.0 / 360.0;
  float w_orange = 25.0 / 360.0;
  float w_yellow = 35.0 / 360.0;
  float w_green = 65.0 / 360.0;
  float w_aqua = 45.0 / 360.0;
  float w_blue = 60.0 / 360.0;
  float w_purple = 40.0 / 360.0;
  float w_magenta = 45.0 / 360.0;

  // Calculate weights
  float rW = getZoneWeight(h, c_red, w_red);
  float oW = getZoneWeight(h, c_orange, w_orange);
  float yW = getZoneWeight(h, c_yellow, w_yellow);
  float gW = getZoneWeight(h, c_green, w_green);
  float aW = getZoneWeight(h, c_aqua, w_aqua);
  float bW = getZoneWeight(h, c_blue, w_blue);
  float pW = getZoneWeight(h, c_purple, w_purple);
  float mW = getZoneWeight(h, c_magenta, w_magenta);

  // Normalize weights so they sum up cleanly (avoiding amplification)
  float totalWeight = rW + oW + yW + gW + aW + bW + pW + mW;
  if (totalWeight > 0.0) {
    rW /= totalWeight;
    oW /= totalWeight;
    yW /= totalWeight;
    gW /= totalWeight;
    aW /= totalWeight;
    bW /= totalWeight;
    pW /= totalWeight;
    mW /= totalWeight;
  }

  // Interpolate the adjustments based on the weights
  // Hue shift: map -180..180 -> -0.5..0.5 in 0-1 scale
  float hueShift = (
    u_red.x * rW + 
    u_orange.x * oW + 
    u_yellow.x * yW + 
    u_green.x * gW + 
    u_aqua.x * aW + 
    u_blue.x * bW + 
    u_purple.x * pW + 
    u_magenta.x * mW
  ) / 360.0;

  // Saturation multiplier: map -100..100 -> -1.0..1.0
  float satMult = (
    u_red.y * rW + 
    u_orange.y * oW + 
    u_yellow.y * yW + 
    u_green.y * gW + 
    u_aqua.y * aW + 
    u_blue.y * bW + 
    u_purple.y * pW + 
    u_magenta.y * mW
  ) / 100.0;

  // Lightness multiplier: map -100..100 -> -1.0..1.0
  float lumMult = (
    u_red.z * rW + 
    u_orange.z * oW + 
    u_yellow.z * yW + 
    u_green.z * gW + 
    u_aqua.z * aW + 
    u_blue.z * bW + 
    u_purple.z * pW + 
    u_magenta.z * mW
  ) / 100.0;

  // Apply shifts to HSL representation
  
  // 1. Hue Shift (with wrap-around)
  hsl.x = fract(hsl.x + hueShift);

  // 2. Saturation Adjustment (scale up/down safely)
  if (satMult > 0.0) {
    hsl.y = mix(hsl.y, 1.0, satMult);
  } else {
    hsl.y = mix(hsl.y, 0.0, -satMult);
  }

  // 3. Lightness Adjustment
  if (lumMult > 0.0) {
    hsl.z = mix(hsl.z, 1.0, lumMult * 0.8); // 0.8 to prevent complete blowout
  } else {
    hsl.z = mix(hsl.z, 0.0, -lumMult * 0.8);
  }

  // Convert back to RGB
  vec3 finalColor = hsl2rgb(hsl);
  
  // Ensure alpha is preserved
  fragColor = vec4(finalColor, texColor.a);
}
