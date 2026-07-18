// Export and Download Utilities

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

// Export canvas as blob and trigger download
export const exportCanvas = (canvas, format = 'image/jpeg', quality = 0.92, filename = 'garrytor_export.jpg') => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, filename);
        resolve(blob);
      } else {
        reject(new Error('Failed to generate export blob'));
      }
    }, format, quality);
  });
};
