// Math and Color Space Utilities

export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

export const lerp = (a, b, t) => a + (b - a) * t;

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
};

// Catmull-Rom Spline Interpolation for curves
export const catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;

  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
};

// Calculate curve values across 0-255 using control points
// Control points: array of [x, y] sorted by x
export const getCurveValues = (points) => {
  if (points.length < 2) {
    return Array.from({ length: 256 }, (_, i) => i);
  }

  const values = new Uint8Array(256);
  
  // Interpolate between control points
  for (let i = 0; i < 256; i++) {
    // Find segment
    let idx = 0;
    while (idx < points.length - 1 && points[idx + 1][0] < i) {
      idx++;
    }

    const p1 = points[idx];
    const p2 = points[idx + 1];

    if (p1[0] === p2[0]) {
      values[i] = clamp(p1[1], 0, 255);
      continue;
    }

    // Use Catmull-Rom if possible, else linear
    const p0 = idx > 0 ? points[idx - 1] : p1;
    const p3 = idx < points.length - 2 ? points[idx + 2] : p2;

    // Normalised t within segment based on x
    const t = (i - p1[0]) / (p2[0] - p1[0]);

    // Catmull-Rom requires single coordinates
    const y = catmullRom(p0[1], p1[1], p2[1], p3[1], t);
    values[i] = clamp(Math.round(y), 0, 255);
  }

  return values;
};

// Color conversions (RGB ranges 0-255, HSL: H 0-360, S 0-100, L 0-100)
export const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

export const hslToRgb = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
};
