/**
 * Carte de partage 1200×630 → public/og.jpg
 *
 * Rendue par le Chrome déjà installé (playwright-core, sans rien télécharger) :
 * une carte typographique aux couleurs de la marque, avec l'astre repris du
 * favicon — source unique pour le repère. Aucune ressource distante : la police
 * est une serif système, donc le rendu ne dépend pas du réseau.
 *
 *   node scripts/generate-og-card.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const star = readFileSync(path.join(root, "public", "favicon.svg"), "utf8");

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#f3efe6;font-family:"Segoe UI",system-ui,sans-serif;
       display:flex;flex-direction:column;justify-content:center;padding:0 96px;
       border-bottom:28px solid #e7e1d6}
  .mark{width:132px;height:132px;margin-bottom:44px}
  h1{font-family:Georgia,"Times New Roman",serif;font-size:104px;letter-spacing:-0.02em;
     color:#190032;line-height:0.95}
  p{margin-top:26px;font-size:33px;color:#6b6560}
  .bar{width:104px;height:9px;background:#e4002b;border-radius:5px;margin-bottom:28px}
</style></head><body>
  <div class="mark">${star}</div>
  <div class="bar"></div>
  <h1>Débit Bois</h1>
  <p>Plans de découpe, devis client et stock atelier</p>
</body></html>`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
	const page = await browser.newPage({
		viewport: { width: 1200, height: 630 },
		deviceScaleFactor: 1,
	});
	await page.setContent(html, { waitUntil: "load" });
	const jpeg = await page.screenshot({ type: "jpeg", quality: 84 });
	const out = path.join(root, "public", "og.jpg");
	writeFileSync(out, jpeg);
	console.log(`public/og.jpg écrit — ${Math.round(jpeg.length / 1024)} Ko (max conseillé : 600 Ko)`);
} finally {
	await browser.close();
}
