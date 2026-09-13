/**
 * Copie la sortie Vite/Nitro vers dist/ pour Cloudflare Pages.
 * Commande : npm run build  →  dossier dist
 */
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const candidates = [
  path.join(root, ".vercel", "output", "static"),
  path.join(root, ".output", "public"),
];

function pickSource() {
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

async function ensureIndexHtml(dir) {
  const index = path.join(dir, "index.html");
  const shell = path.join(dir, "_shell.html");
  if (existsSync(index) && (await readFile(index, "utf8")).includes("$_TSR")) return;
  if (existsSync(shell)) {
    await cp(shell, index);
    return;
  }
  if (existsSync(index)) return;
  const assets = path.join(dir, "assets");
  let js = [];
  let css = [];
  if (existsSync(assets)) {
    const names = await readdir(assets);
    js = names.filter((n) => n.endsWith(".js"));
    css = names.filter((n) => n.endsWith(".css"));
  }
  const cssTags = css
    .map((n) => `<link rel="stylesheet" href="/assets/${n}">`)
    .join("\n");
  const jsTags = js
    .map((n) => `<script type="module" src="/assets/${n}"></script>`)
    .join("\n");
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Débit Bois</title>
<meta name="theme-color" content="#2c4a3e">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
${cssTags}
</head>
<body>
<div id="root"></div>
${jsTags}
</body>
</html>
`;
  await writeFile(index, html, "utf8");
}

async function copyPublicExtras(dir) {
  const extras = [
    "manifest.webmanifest",
    "sw.js",
    "favicon.svg",
    "_redirects",
    "_headers",
  ];
  for (const name of extras) {
    const src = path.join(root, "public", name);
    if (existsSync(src) && !existsSync(path.join(dir, name))) {
      await cp(src, path.join(dir, name));
    }
  }
  const iconsSrc = path.join(root, "public", "icons");
  const iconsDest = path.join(dir, "icons");
  if (existsSync(iconsSrc) && !existsSync(iconsDest)) {
    await cp(iconsSrc, iconsDest, { recursive: true });
  }
}

const src = pickSource();
if (!src) {
  console.error("[pages] Aucun dossier statique (.vercel/output/static ou .output/public).");
  process.exit(1);
}

await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });
await copyPublicExtras(dist);
await ensureIndexHtml(dist);

const listing = await readdir(dist);
const hasIndex = listing.includes("index.html");
console.log(`[pages] dist/ prêt depuis ${path.relative(root, src)} (index.html: ${hasIndex ? "oui" : "non"}).`);
