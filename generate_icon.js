import fs from 'fs';
import path from 'path';

// Minimal PNG data generator for 512x512 MedWatch icon
// Uses pure JS bitmap to PNG generator to create MedWatch icon PNG file
function createMedWatchPng() {
  const width = 512;
  const height = 512;
  
  // Create a canvas-like buffer for raw RGBA values
  const buffer = Buffer.alloc(width * height * 4);
  
  const cx = width / 2;
  const cy = height / 2;
  const radius = 220;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Gradient background from blue (#3b82f6) to cyan (#06b6d4)
        const t = (x + y) / (width + height);
        const r = Math.round(59 * (1 - t) + 6 * t);
        const g = Math.round(130 * (1 - t) + 182 * t);
        const b = Math.round(246 * (1 - t) + 212 * t);

        // Draw cross in the center (pill cross)
        const isCrossX = Math.abs(dx) < 35 && Math.abs(dy) < 110;
        const isCrossY = Math.abs(dy) < 35 && Math.abs(dx) < 110;

        if (isCrossX || isCrossY) {
          buffer[idx] = 255;     // R
          buffer[idx + 1] = 255; // G
          buffer[idx + 2] = 255; // B
          buffer[idx + 3] = 255; // A
        } else {
          buffer[idx] = r;
          buffer[idx + 1] = g;
          buffer[idx + 2] = b;
          buffer[idx + 3] = 255;
        }
      } else {
        // Transparent outside circle
        buffer[idx] = 11;
        buffer[idx + 1] = 15;
        buffer[idx + 2] = 25;
        buffer[idx + 3] = 255;
      }
    }
  }

  return buffer;
}

// Convert raw RGBA to uncompressed PNG using zlib
import zlib from 'zlib';

function rgbaToPng(rgba, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with filter byte (0) per scanline
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (width * 4 + 1)] = 0; // filter type 0
    rgba.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(scanlines);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  
  const crc = crc32(buf.subarray(4, 4 + 4 + len));
  buf.writeUInt32BE(crc, 4 + 4 + len);
  return buf;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

const rawRgba = createMedWatchPng();
const pngBuffer = rgbaToPng(rawRgba, 512, 512);

// Save icon.png to assets and replace Android launcher icons
fs.writeFileSync('public/icon.png', pngBuffer);
console.log('MedWatch PNG icon generated successfully!');

const mipmaps = [
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
];

mipmaps.forEach((dir) => {
  if (fs.existsSync(dir)) {
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), pngBuffer);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), pngBuffer);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), pngBuffer);
  }
});
console.log('Android launcher icons updated successfully!');
