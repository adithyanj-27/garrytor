// RAW Image Preview Extractor Web Worker
// Extracts the high-resolution embedded JPEG preview from camera RAW files (DNG, CR2, NEF, ARW, etc.)
// Runs in background thread using fast binary signature carving (SOI 0xFFD8 -> EOI 0xFFD9)

self.onmessage = (e) => {
  const { arrayBuffer } = e.data;
  
  try {
    const jpegBytes = extractLargestEmbeddedJPEG(arrayBuffer);
    if (jpegBytes) {
      // Transfer the buffer back to the main thread without copying
      self.postMessage({ success: true, jpegBytes }, [jpegBytes.buffer]);
    } else {
      self.postMessage({ success: false, error: 'No valid embedded JPEG preview found in this RAW file.' });
    }
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};

function extractLargestEmbeddedJPEG(arrayBuffer) {
  const view = new Uint8Array(arrayBuffer);
  const len = view.length;
  let largestStart = -1;
  let largestEnd = -1;
  let largestSize = 0;
  
  // Find all SOI markers (Start of Image: 0xFFD8)
  const soiIndices = [];
  for (let i = 0; i < len - 1; i++) {
    if (view[i] === 0xFF && view[i + 1] === 0xD8) {
      soiIndices.push(i);
      // Skip ahead past the marker to search faster
      i += 100;
    }
  }
  
  // For each SOI, find its corresponding EOI (End of Image: 0xFFD9)
  for (const start of soiIndices) {
    let end = -1;
    // Previews are usually >50KB, so scan starting at +10KB offset
    const searchStart = Math.min(len - 2, start + 10000);
    for (let j = searchStart; j < len - 1; j++) {
      if (view[j] === 0xFF && view[j + 1] === 0xD9) {
        end = j + 2; // Include the 0xD9 byte
        break;
      }
    }
    
    if (end !== -1) {
      const size = end - start;
      if (size > largestSize) {
        largestSize = size;
        largestStart = start;
        largestEnd = end;
      }
    }
  }
  
  if (largestStart !== -1 && largestEnd !== -1) {
    // Return a copy slice of the array to transfer ownership safely
    const result = new Uint8Array(largestSize);
    result.set(view.subarray(largestStart, largestEnd));
    return result;
  }
  
  return null;
}
