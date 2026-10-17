// Erzeugt assets/icon.png (256x256) aus dem Mini-Claude-Sprite. Aufruf: node scripts/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { character } = require('../src/sprites');

const { palette: PALETTE, frames: FRAMES, width: WIDTH, height: HEIGHT } = character(process.argv[2] || 'claude');

const SIZE = 256;
const scale = Math.floor(SIZE / Math.max(WIDTH, HEIGHT));
const offX = Math.floor((SIZE - WIDTH * scale) / 2);
const offY = Math.floor((SIZE - HEIGHT * scale) / 2);
const px = Buffer.alloc(SIZE * SIZE * 4);

FRAMES.idle.forEach((row, r) => [...row].forEach((ch, c) => {
  const hex = PALETTE[ch];
  if (!hex) return;
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
    const i = ((offY + r * scale + y) * SIZE + offX + c * scale + x) * 4;
    px.set([...rgb, 255], i);
  }
}));

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8 bit RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, '..', 'assets', 'icon.png');
fs.writeFileSync(out, png);
console.log('geschrieben:', out);
