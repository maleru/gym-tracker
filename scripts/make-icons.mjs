// Erzeugt PNG-Icons ohne externe Abhängigkeiten.
// Aufruf: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [0x0f, 0x11, 0x15];
const FG = [0x4a, 0xde, 0x80];

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Hantel-Symbol: zwei Scheiben und eine Stange auf dunklem Grund. */
function inRect(x, y, r) {
  return x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
}

function render(size) {
  const s = (f) => Math.round(f * size);
  const shapes = [
    [s(0.2), s(0.44), s(0.8), s(0.56)], // Stange
    [s(0.1), s(0.28), s(0.22), s(0.72)], // linke Scheibe
    [s(0.78), s(0.28), s(0.9), s(0.72)], // rechte Scheibe
  ];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // Filter: none
    for (let x = 0; x < size; x++) {
      const hit = shapes.some((r) => inRect(x, y, r));
      const c = hit ? FG : BG;
      raw[o++] = c[0];
      raw[o++] = c[1];
      raw[o++] = c[2];
      raw[o++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(`public/icons/${name}`, render(size));
  console.log(`geschrieben: public/icons/${name} (${size}x${size})`);
}
