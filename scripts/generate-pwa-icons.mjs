import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(w, h, paint) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y, w, h);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function paintIcon(x, y, w) {
  const bg = [44, 74, 62, 255];
  const cream = [244, 241, 234, 255];
  const wood = [212, 196, 168, 255];
  const pad = w * 0.175;
  const barH = w * 0.12;
  const gap = w * 0.06;
  const y0 = pad;
  const y1 = y0 + barH + gap;
  const y2 = y1 + barH * 1.15 + gap;
  const inBar = (yy, hh, right) =>
    x >= pad && x <= w - pad * right && y >= yy && y <= yy + hh;
  if (inBar(y0, barH, 1)) return cream;
  if (inBar(y1, barH * 1.15, 1)) return wood;
  if (inBar(y2, barH * 0.9, 1.8)) return [231, 223, 210, 255];
  return bg;
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(path.join(dir, `icon-${size}.png`), png(size, size, paintIcon));
}
console.log("icons 192 et 512 écrits");
