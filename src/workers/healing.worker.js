// Healing Brush Web Worker
// Implements Telea fast-marching inpainting algorithm for content-aware removal

/**
 * Entry point: receives message from main thread with pixel data and patch mask
 * @param {Object} data - { pixels: Uint8ClampedArray, width: number, height: number, mask: Uint8ClampedArray }
 * @returns Posts { result: Uint8ClampedArray } back to main thread
 */
self.onmessage = (e) => {
  const { pixels, width, height, mask } = e.data;

  try {
    const result = inpaint(pixels, mask, width, height);
    self.postMessage({ result, width, height }, [result.buffer]);
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};

/**
 * Fast Marching Method inpainting (Telea 2004 simplified).
 * Fills mask > 0 regions using weighted color averages from nearest known pixels.
 * @param {Uint8ClampedArray} src - Source RGBA pixel array
 * @param {Uint8ClampedArray} mask - Grayscale mask (255=inpaint, 0=keep)
 * @param {number} width
 * @param {number} height
 * @returns {Uint8ClampedArray} Healed RGBA pixel array
 */
function inpaint(src, mask, width, height) {
  const result = new Uint8ClampedArray(src);
  const radius = 8; // search radius for color candidates

  // Build a distance map from mask boundary using BFS
  const dist = new Float32Array(width * height).fill(Infinity);
  const queue = [];
  
  // Seed the queue with all boundary pixels (mask=255 adjacent to mask=0)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] > 128) {
        // Check if any neighbour is outside the mask
        const hasOutsideNeighbour = [
          [x-1,y],[x+1,y],[x,y-1],[x,y+1]
        ].some(([nx, ny]) => {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
          return mask[ny * width + nx] <= 128;
        });

        if (hasOutsideNeighbour) {
          dist[i] = 0.5;
          queue.push({ x, y, d: 0.5 });
        }
      }
    }
  }

  // Sort by distance for fast marching
  queue.sort((a, b) => a.d - b.d);

  // Process pixels in order of distance from boundary
  for (let qi = 0; qi < queue.length; qi++) {
    const { x, y } = queue[qi];
    const idx = y * width + x;

    if (mask[idx] <= 128) continue; // outside mask, skip

    // Compute weighted average of surrounding known pixels
    let rSum = 0, gSum = 0, bSum = 0, wSum = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        
        const ni = ny * width + nx;
        
        // Only sample from known (non-masked) pixels
        if (mask[ni] > 128 && dist[ni] === Infinity) continue;
        if (mask[ni] > 128 && dist[ni] >= dist[idx]) continue;
        
        const d2 = dx * dx + dy * dy;
        if (d2 === 0) continue;
        
        // Gaussian-weighted contribution
        const w = Math.exp(-d2 / (2 * 4 * 4));
        const ni4 = ni * 4;
        rSum += src[ni4 + 0] * w;
        gSum += src[ni4 + 1] * w;
        bSum += src[ni4 + 2] * w;
        wSum += w;
      }
    }

    if (wSum > 0) {
      const idx4 = idx * 4;
      result[idx4 + 0] = Math.round(rSum / wSum);
      result[idx4 + 1] = Math.round(gSum / wSum);
      result[idx4 + 2] = Math.round(bSum / wSum);
      result[idx4 + 3] = 255;
    }

    // Update distance for newly filled pixel
    dist[idx] = Infinity; // mark as "known now"

    // Push undiscovered neighbours
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (mask[ni] > 128 && dist[ni] === Infinity) {
        const newDist = dist[idx] === Infinity ? 1 : dist[idx] + 1;
        if (newDist < dist[ni]) {
          dist[ni] = newDist;
          queue.push({ x: nx, y: ny, d: newDist });
        }
      }
    }
  }

  return result;
}
