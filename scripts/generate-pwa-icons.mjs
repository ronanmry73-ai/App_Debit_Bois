/**
 * Icônes PWA de la marque — peint au pixel, sans dépendance ni navigateur.
 *
 * Le repère est celui du favicon 64×64 : deux barres arrondies en croix, quatre
 * cercles extérieurs, un cercle central, et un masque en étoile à quatre
 * branches qui évide le centre. Rendu avec un suréchantillonnage 3×3 pour des
 * bords nets.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Fond de tuile : le crème de l'application (--color-background). */
const TILE = [243, 239, 230, 255];
/** Astre de la marque (le rouge du logo). */
const MARK = [228, 0, 43, 255];
/**
 * Part de la tuile occupée par l'astre. Le manifest déclare l'icône 512 en
 * `purpose: "maskable"` : Android la rogne en cercle ou en squircle, donc le
 * repère doit rester dans la zone sûre centrale.
 */
const SPAN = 0.78;

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

/** Barre à bouts arrondis : capsule quand le rayon vaut la demi-épaisseur. */
function inRoundedRect(px, py, x, y, w, h, r) {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function inCircle(px, py, cx, cy, r) {
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** L'astre, évidé au centre par le masque en étoile. Coordonnées 64×64. */
function isMark(x, y) {
  const inCross =
    inRoundedRect(x, y, 26.5, 0, 11, 64, 5.5) ||
    inRoundedRect(x, y, 0, 26.5, 64, 11, 5.5) ||
    inCircle(x, y, 15, 32, 10) ||
    inCircle(x, y, 49, 32, 10) ||
    inCircle(x, y, 32, 15, 10) ||
    inCircle(x, y, 32, 49, 10) ||
    inCircle(x, y, 32, 32, 14);
  if (!inCross) return false;
  const cut =
    inTriangle(x, y, 32, 32, 26.5, 20, 37.5, 20) ||
    inTriangle(x, y, 32, 32, 44, 26.5, 44, 37.5) ||
    inTriangle(x, y, 32, 32, 37.5, 44, 26.5, 44) ||
    inTriangle(x, y, 32, 32, 20, 37.5, 20, 26.5);
  return !cut;
}

function paintIcon(x, y, w) {
  const scale = w / 64;
  const SS = 3;
  let hits = 0;
  for (let i = 0; i < SS; i++) {
    for (let j = 0; j < SS; j++) {
      const px = ((x + (i + 0.5) / SS) / scale - 32) / SPAN + 32;
      const py = ((y + (j + 0.5) / SS) / scale - 32) / SPAN + 32;
      if (isMark(px, py)) hits += 1;
    }
  }
  const total = SS * SS;
  if (hits === 0) return TILE;
  if (hits === total) return MARK;
  const a = hits / total;
  return [
    Math.round(TILE[0] + (MARK[0] - TILE[0]) * a),
    Math.round(TILE[1] + (MARK[1] - TILE[1]) * a),
    Math.round(TILE[2] + (MARK[2] - TILE[2]) * a),
    255,
  ];
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(path.join(dir, `icon-${size}.png`), png(size, size, paintIcon));
}
console.log("icons 192 et 512 écrits — astre rouge sur tuile crème");
