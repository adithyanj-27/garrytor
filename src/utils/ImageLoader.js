// Image Loading, Validation, and EXIF Helper

export const validateFile = (file) => {
  const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.webp|\.dng|\.nef|\.arw|\.cr2|\.cr3|\.orf|\.raf|\.rw2)$/i;
  if (!allowedExtensions.exec(file.name)) {
    return { valid: false, error: 'Unsupported file format. Please upload JPG, PNG, WebP or RAW.' };
  }

  const maxSize = 30 * 1024 * 1024; // 30 MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 30MB limit.' };
  }

  return { valid: true, error: null };
};

// Check if file is RAW based on extension
export const isRawFile = (filename) => {
  const rawExtensions = /(\.dng|\.nef|\.arw|\.cr2|\.cr3|\.orf|\.raf|\.rw2)$/i;
  return rawExtensions.test(filename);
};

// Load HTMLImageElement from File or URL
export const loadImageElement = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image. Check the URL or file path.'));
    img.src = src;
  });
};

// Generate a compressed thumbnail Blob for the project library card
export const generateThumbnail = (imageElement, maxDim = 320) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    let w = imageElement.naturalWidth || imageElement.width;
    let h = imageElement.naturalHeight || imageElement.height;

    // Scale maintaining aspect ratio
    if (w > h) {
      if (w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      }
    } else {
      if (h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, w, h);
    
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.82); // Good quality-to-size balance
  });
};
