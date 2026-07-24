const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c ^= buf[n];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateAperturePNG(size, isMaskable = false) {
  const width = size;
  const height = size;
  
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;

  // Maskable icons use smaller safe zone (60% of size)
  const scale = isMaskable ? 0.75 : 1.0;
  const outerR = size * 0.44 * scale;
  const innerR = size * 0.40 * scale;
  const strokeW = Math.max(3, size * 0.05 * scale);

  const lines = [
    { x1: (0.5 + (0.596 - 0.5) * scale) * size, y1: (0.5 + (0.333 - 0.5) * scale) * size, x2: (0.5 + (0.835 - 0.5) * scale) * size, y2: (0.5 + (0.748 - 0.5) * scale) * size },
    { x1: (0.5 + (0.404 - 0.5) * scale) * size, y1: (0.5 + (0.333 - 0.5) * scale) * size, x2: (0.5 + (0.882 - 0.5) * scale) * size, y2: (0.5 + (0.333 - 0.5) * scale) * size },
    { x1: (0.5 + (0.308 - 0.5) * scale) * size, y1: (0.5 + (0.500 - 0.5) * scale) * size, x2: (0.5 + (0.547 - 0.5) * scale) * size, y2: (0.5 + (0.086 - 0.5) * scale) * size },
    { x1: (0.5 + (0.404 - 0.5) * scale) * size, y1: (0.5 + (0.667 - 0.5) * scale) * size, x2: (0.5 + (0.165 - 0.5) * scale) * size, y2: (0.5 + (0.252 - 0.5) * scale) * size },
    { x1: (0.5 + (0.596 - 0.5) * scale) * size, y1: (0.5 + (0.667 - 0.5) * scale) * size, x2: (0.5 + (0.118 - 0.5) * scale) * size, y2: (0.5 + (0.667 - 0.5) * scale) * size },
    { x1: (0.5 + (0.693 - 0.5) * scale) * size, y1: (0.5 + (0.500 - 0.5) * scale) * size, x2: (0.5 + (0.453 - 0.5) * scale) * size, y2: (0.5 + (0.914 - 0.5) * scale) * size }
  ];

  function distToSegment(px, py, l) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - l.x1, py - l.y1);
    let t = ((px - l.x1) * dx + (py - l.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = l.x1 + t * dx;
    const projY = l.y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;

    for (let x = 0; x < width; x++) {
      const idx = rowOffset + 1 + x * 4;
      const distToCenter = Math.hypot(x - cx, y - cy);

      const inCircle = Math.abs(distToCenter - (outerR + innerR) / 2) <= (strokeW / 2 + 0.5);

      let inLine = false;
      if (distToCenter <= outerR + 1) {
        for (const line of lines) {
          if (distToSegment(x, y, line) <= (strokeW / 2 + 0.5)) {
            inLine = true;
            break;
          }
        }
      }

      if (inCircle || inLine) {
        const factor = (x + y) / (width + height);
        const r = 255;
        const g = Math.round(140 * (1 - factor) + 62 * factor);
        const b = Math.round(66 * (1 - factor) + 85 * factor);
        const a = 255;

        rawData[idx] = r;
        rawData[idx + 1] = g;
        rawData[idx + 2] = b;
        rawData[idx + 3] = a;
      } else {
        if (isMaskable) {
          // Dark theme background #0d0d0f for maskable icons
          rawData[idx] = 13;
          rawData[idx + 1] = 13;
          rawData[idx + 2] = 15;
          rawData[idx + 3] = 255;
        } else {
          // 100% TRANSPARENT BACKGROUND FOR Standard ("purpose": "any") Icons
          rawData[idx] = 0;
          rawData[idx + 1] = 0;
          rawData[idx + 2] = 0;
          rawData[idx + 3] = 0;
        }
      }
    }
  }

  const signature = Buffer.from([139, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = writeChunk('IHDR', ihdr);

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = writeChunk('IDAT', compressedData);
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate Standard Transparent Icons ("purpose": "any")
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generateAperturePNG(192, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generateAperturePNG(512, false));

// Generate Dark Theme Maskable Icons ("purpose": "maskable")
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), generateAperturePNG(192, true));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), generateAperturePNG(512, true));

console.log('Successfully generated transparent & dark theme PWA PNG icons!');
