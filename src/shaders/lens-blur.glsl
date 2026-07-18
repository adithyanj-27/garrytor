#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform float u_amount;        // 0.0 = no blur, 1.0 = full bokeh effect
uniform float u_focalX;        // Normalized focal point X (0.0 to 1.0)
uniform float u_focalY;        // Normalized focal point Y (0.0 to 1.0)
uniform float u_focalRadius;   // Inner radius where no blur occurs (0.0 to 1.0)
uniform float u_maxRadius;     // Max disc blur radius in pixels
uniform vec2 u_resolution;     // Image pixel dimensions
uniform int u_bokehShape;      // 0=circle, 1=hexagon

// Simple hash-based pseudo-random
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Poisson disc sample positions (pre-computed for quality blur)
// 16-sample disc spread
const int NUM_SAMPLES = 16;
vec2 discSamples[16];

void initSamples() {
  // Uniform disc sampling using golden angle spiral
  float goldenAngle = 2.399963;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    float r = sqrt(float(i + 1) / float(NUM_SAMPLES));
    float theta = float(i) * goldenAngle;
    discSamples[i] = vec2(r * cos(theta), r * sin(theta));
  }
}

void main() {
  initSamples();
  
  vec2 uv = v_texCoord;
  vec2 focalUV = vec2(u_focalX, u_focalY);
  
  // Compute circle of confusion (CoC) based on distance from focal point
  float dist = distance(uv, focalUV);
  
  // Inner focal region = no blur
  float coc = smoothstep(u_focalRadius, u_focalRadius + 0.25, dist);
  coc *= u_amount;
  
  if (coc <= 0.0) {
    fragColor = texture(u_image, uv);
    return;
  }
  
  // Compute actual pixel blur radius from CoC
  float blurRadius = coc * u_maxRadius;
  vec2 texelSize = 1.0 / u_resolution;
  
  // Accumulate bokeh disc samples
  vec4 colorSum = vec4(0.0);
  float weightSum = 0.0;
  
  for (int i = 0; i < NUM_SAMPLES; i++) {
    vec2 offset = discSamples[i] * blurRadius * texelSize;
    vec2 sampleUV = uv + offset;
    
    // Clamp to texture bounds
    sampleUV = clamp(sampleUV, vec2(0.0), vec2(1.0));
    
    vec4 sampleColor = texture(u_image, sampleUV);
    
    // Boost highlights for bokeh glow effect
    float brightness = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
    float highlight = pow(max(brightness - 0.65, 0.0) * 3.0, 2.0);
    float weight = 1.0 + highlight * 3.0;
    
    colorSum += sampleColor * weight;
    weightSum += weight;
  }

  vec4 blurred = colorSum / weightSum;
  vec4 sharp = texture(u_image, uv);
  
  // Blend based on CoC value
  fragColor = mix(sharp, blurred, coc);
}
