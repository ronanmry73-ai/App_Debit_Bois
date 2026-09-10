import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as Plus, c as ChevronDown, d as ArrowUpFromLine, f as ArrowDownToLine, i as Printer, l as Check, n as Trash2, o as Package, r as RotateCcw, s as FileText, t as TriangleAlert, u as Calculator } from "../_libs/lucide-react.mjs";
import { i as Slot, t as Root } from "../_libs/@radix-ui/react-label+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/@radix-ui/react-switch+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DHjmzm_x.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatArea(mm2) {
	return `${(mm2 / 1e6).toLocaleString("fr-FR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})} m²`;
}
function formatPct(n) {
	return `${n.toLocaleString("fr-FR", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	})} %`;
}
function formatEuro(n) {
	return n.toLocaleString("fr-FR", {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}
function newId() {
	return crypto.randomUUID();
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary/90",
			secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			outline: "border border-border bg-card text-foreground hover:bg-muted",
			ghost: "text-foreground hover:bg-muted",
			destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 px-3 text-sm",
			lg: "h-12 px-5",
			icon: "size-11",
			"icon-sm": "size-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-xl bg-card text-card-foreground shadow-[var(--shadow-border)]", className),
		...props
	});
}
function CardHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-1 p-5 pb-3", className),
		...props
	});
}
function CardTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: cn("font-display text-lg font-medium tracking-tight text-foreground", className),
		...props
	});
}
function CardContent({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("p-5 pt-0", className),
		...props
	});
}
function Input({ className, type, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground shadow-none transition-colors duration-150", "placeholder:text-muted-foreground", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "disabled:cursor-not-allowed disabled:opacity-50", "md:text-sm", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
		className: cn("text-sm font-medium text-ink-soft leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className),
		...props
	});
}
var STORAGE_KEY = "debit-bois-v4";
function exampleRows() {
	return [
		{
			id: "ex-1",
			name: "Montant",
			length: "1800",
			width: "380",
			qty: "2"
		},
		{
			id: "ex-2",
			name: "Montant large",
			length: "1800",
			width: "560",
			qty: "2"
		},
		{
			id: "ex-3",
			name: "Traverse",
			length: "800",
			width: "90",
			qty: "6"
		},
		{
			id: "ex-4",
			name: "Tablette",
			length: "800",
			width: "380",
			qty: "3"
		},
		{
			id: "ex-5",
			name: "Tablette large",
			length: "800",
			width: "560",
			qty: "2"
		},
		{
			id: "ex-6",
			name: "Côté",
			length: "400",
			width: "350",
			qty: "4"
		}
	];
}
/** Débit de 2 m² (2 × 2500 × 400) pour l’exemple devis 40 €/m². */
function exampleQuoteRows() {
	return [{
		id: "q-1",
		name: "Tablette",
		length: "2500",
		width: "400",
		qty: "2"
	}];
}
function emptyRow() {
	return {
		id: newId(),
		name: "",
		length: "",
		width: "",
		qty: "1"
	};
}
function emptyHardwareItem() {
	return {
		id: newId(),
		name: "",
		qty: "1",
		unitPrice: ""
	};
}
function exampleHardwareItems() {
	return [{
		id: "hw-1",
		name: "Charnières invisibles",
		qty: "4",
		unitPrice: "4.5"
	}, {
		id: "hw-2",
		name: "Poignées inox",
		qty: "2",
		unitPrice: "6"
	}];
}
function defaultQuoteIdentity() {
	const year = (/* @__PURE__ */ new Date()).getFullYear();
	return {
		companyName: "Atelier Bois Clair",
		companyAddress: "12 rue des Ateliers\n69003 Lyon",
		companyPhone: "04 78 12 34 56",
		companyEmail: "contact@atelier-bois-clair.fr",
		companySiret: "123 456 789 00012",
		clientName: "M. et Mme Martin",
		quoteDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
		quoteNumber: `DEVIS-${year}-001`,
		furnitureDescription: "Meuble sur mesure — bibliothèque salon",
		validity: "Devis valable 30 jours.",
		payment: "Acompte 30 % à la commande, solde à la livraison.",
		legal: "Réserve de propriété jusqu’au paiement intégral. TVA applicable selon le taux indiqué.",
		vatPct: 20,
		logoDataUrl: ""
	};
}
var METHOD_OPTIONS = [
	{
		value: "auto",
		label: "Automatique (meilleur rendement)"
	},
	{
		value: "guillotine",
		label: "Guillotine (coupes droites)"
	},
	{
		value: "maxrects",
		label: "Rectangles maximaux (densité)"
	}
];
function exampleQuotePatch() {
	return {
		...defaultQuoteIdentity(),
		pricePerM2: 40,
		wastePct: 15,
		laborHours: 2.5,
		hourlyRate: 40,
		hardwareItems: exampleHardwareItems(),
		marginPct: 30,
		surfaceOverrideM2: 2
	};
}
var PANEL_SPECS = {
	A: {
		length: 2500,
		width: 400,
		label: "2500 × 400 mm"
	},
	B: {
		length: 2500,
		width: 600,
		label: "2500 × 600 mm"
	}
};
var EPS = 1e-6;
function panelArea(format) {
	const s = PANEL_SPECS[format];
	return s.length * s.width;
}
function explodePieces(defs) {
	const items = [];
	for (const def of defs) {
		const qty = Math.max(0, Math.floor(def.qty));
		for (let i = 0; i < qty; i++) items.push({
			instanceId: `${def.id}#${i + 1}`,
			defId: def.id,
			name: def.name.trim() || "Pièce",
			w: def.length,
			h: def.width
		});
	}
	return items;
}
function pieceFitsFormat(w, h, format, allowRotation, kerf) {
	const spec = PANEL_SPECS[format];
	const binW = spec.length + kerf;
	const binH = spec.width + kerf;
	const iw = w + kerf;
	const ih = h + kerf;
	if (iw <= binW + EPS && ih <= binH + EPS) return true;
	if (allowRotation && ih <= binW + EPS && iw <= binH + EPS) return true;
	return false;
}
function pieceFitsAnyPanel(w, h, allowRotation, kerf) {
	return pieceFitsFormat(w, h, "A", allowRotation, kerf) || pieceFitsFormat(w, h, "B", allowRotation, kerf);
}
function sortItems(items, key) {
	const copy = items.slice();
	copy.sort((a, b) => {
		if (key === "area") {
			const d = b.w * b.h - a.w * a.h;
			if (d !== 0) return d;
			return Math.max(b.w, b.h) - Math.max(a.w, a.h);
		}
		const d = Math.max(b.w, b.h) - Math.max(a.w, a.h);
		if (d !== 0) return d;
		return b.w * b.h - a.w * a.h;
	});
	return copy;
}
function containsRect(a, b) {
	return a.x <= b.x + EPS && a.y <= b.y + EPS && a.x + a.w >= b.x + b.w - EPS && a.y + a.h >= b.y + b.h - EPS;
}
function pruneContained(rects) {
	const out = [];
	for (let i = 0; i < rects.length; i++) {
		const r = rects[i];
		if (r.w <= EPS || r.h <= EPS) continue;
		let contained = false;
		for (let j = 0; j < rects.length; j++) {
			if (i === j) continue;
			if (containsRect(rects[j], r)) {
				contained = true;
				break;
			}
		}
		if (!contained) out.push(r);
	}
	return out;
}
/** Découpe MaxRects : jusqu’à 4 reliquats par rectangle libre chevauché. */
function splitMaxRects(freeRects, used) {
	const result = [];
	for (const fr of freeRects) {
		const overlapX = used.x < fr.x + fr.w - EPS && used.x + used.w > fr.x + EPS;
		const overlapY = used.y < fr.y + fr.h - EPS && used.y + used.h > fr.y + EPS;
		if (!overlapX || !overlapY) {
			result.push(fr);
			continue;
		}
		if (used.y > fr.y + EPS && used.y < fr.y + fr.h - EPS) result.push({
			x: fr.x,
			y: fr.y,
			w: fr.w,
			h: used.y - fr.y
		});
		if (used.y + used.h < fr.y + fr.h - EPS) result.push({
			x: fr.x,
			y: used.y + used.h,
			w: fr.w,
			h: fr.y + fr.h - (used.y + used.h)
		});
		if (used.x > fr.x + EPS && used.x < fr.x + fr.w - EPS) result.push({
			x: fr.x,
			y: fr.y,
			w: used.x - fr.x,
			h: fr.h
		});
		if (used.x + used.w < fr.x + fr.w - EPS) result.push({
			x: used.x + used.w,
			y: fr.y,
			w: fr.x + fr.w - (used.x + used.w),
			h: fr.h
		});
	}
	return pruneContained(result);
}
function scorePlacement(fr, iw, ih, heuristic) {
	if (iw > fr.w + EPS || ih > fr.h + EPS) return null;
	const leftW = fr.w - iw;
	const leftH = fr.h - ih;
	if (heuristic === "bssf") return {
		a: Math.min(leftW, leftH),
		b: Math.max(leftW, leftH)
	};
	if (heuristic === "baf") return {
		a: fr.w * fr.h - iw * ih,
		b: Math.min(leftW, leftH)
	};
	return {
		a: fr.y,
		b: fr.x
	};
}
function betterScore(a, b) {
	if (a.scoreA !== b.scoreA) return a.scoreA < b.scoreA;
	return a.scoreB < b.scoreB;
}
function collectCandidates(freeRects, item, allowRotation, kerf, heuristic) {
	const out = [];
	const orientations = [{
		w: item.w,
		h: item.h,
		rotated: false
	}];
	if (allowRotation && item.w !== item.h) orientations.push({
		w: item.h,
		h: item.w,
		rotated: true
	});
	for (const ori of orientations) {
		const iw = ori.w + kerf;
		const ih = ori.h + kerf;
		for (const fr of freeRects) {
			const sc = scorePlacement(fr, iw, ih, heuristic);
			if (!sc) continue;
			out.push({
				x: fr.x,
				y: fr.y,
				w: ori.w,
				h: ori.h,
				iw,
				ih,
				rotated: ori.rotated,
				item,
				scoreA: sc.a,
				scoreB: sc.b
			});
		}
	}
	return out;
}
function pickBestCandidate(cands) {
	let best = null;
	for (const c of cands) if (!best || betterScore(c, best)) best = c;
	return best;
}
function packOneBin(format, items, kerf, allowRotation, algo, heuristic, sortKey) {
	const spec = PANEL_SPECS[format];
	let free = [{
		x: 0,
		y: 0,
		w: spec.length + kerf,
		h: spec.width + kerf
	}];
	const ordered = sortItems(items, sortKey);
	const placements = [];
	const leftover = [];
	for (const item of ordered) {
		const best = pickBestCandidate(collectCandidates(free, item, allowRotation, kerf, heuristic));
		if (!best) {
			leftover.push(item);
			continue;
		}
		placements.push({
			instanceId: item.instanceId,
			defId: item.defId,
			name: item.name,
			x: best.x,
			y: best.y,
			w: best.w,
			h: best.h,
			rotated: best.rotated
		});
		const used = {
			x: best.x,
			y: best.y,
			w: best.iw,
			h: best.ih
		};
		if (algo === "maxrects") free = splitMaxRects(free, used);
		else free = splitGuillotine(free, used);
	}
	return {
		placements,
		remaining: leftover,
		method: algo,
		usedArea: placements.reduce((s, p) => s + p.w * p.h, 0)
	};
}
/**
* Guillotine : le rectangle libre choisi est fendu en deux zones
* non chevauchantes (le L est coupé selon le plus petit reliquat).
*/
function splitGuillotine(freeRects, used) {
	const idx = freeRects.findIndex((fr) => Math.abs(fr.x - used.x) < EPS && Math.abs(fr.y - used.y) < EPS && fr.w + EPS >= used.w && fr.h + EPS >= used.h);
	if (idx < 0) return splitMaxRects(freeRects, used);
	const fr = freeRects[idx];
	const leftoverW = fr.w - used.w;
	const leftoverH = fr.h - used.h;
	const next = freeRects.filter((_, i) => i !== idx);
	if (leftoverW <= leftoverH) {
		if (leftoverW > EPS) next.push({
			x: fr.x + used.w,
			y: fr.y,
			w: leftoverW,
			h: used.h
		});
		if (leftoverH > EPS) next.push({
			x: fr.x,
			y: fr.y + used.h,
			w: fr.w,
			h: leftoverH
		});
	} else {
		if (leftoverH > EPS) next.push({
			x: fr.x,
			y: fr.y + used.h,
			w: used.w,
			h: leftoverH
		});
		if (leftoverW > EPS) next.push({
			x: fr.x + used.w,
			y: fr.y,
			w: leftoverW,
			h: fr.h
		});
	}
	return next.filter((r) => r.w > EPS && r.h > EPS);
}
function betterBin(a, b) {
	if (!b) return true;
	if (a.usedArea !== b.usedArea) return a.usedArea > b.usedArea;
	if (a.placements.length !== b.placements.length) return a.placements.length > b.placements.length;
	return false;
}
function algosFor(method) {
	if (method === "guillotine") return ["guillotine"];
	if (method === "maxrects") return ["maxrects"];
	return ["maxrects", "guillotine"];
}
function packOneBinBest(format, items, options) {
	const algos = algosFor(options.method);
	const heuristics = options.method === "guillotine" ? ["bssf"] : [
		"bssf",
		"baf",
		"bl"
	];
	const sorts = ["area", "maxside"];
	let best = null;
	for (const algo of algos) {
		const hs = algo === "guillotine" ? ["bssf"] : heuristics;
		for (const heuristic of hs) for (const sortKey of sorts) {
			const attempt = packOneBin(format, items, options.kerf, options.allowRotation, algo, heuristic, sortKey);
			if (betterBin(attempt, best)) best = attempt;
		}
	}
	return best ?? {
		placements: [],
		remaining: items.slice(),
		method: "maxrects",
		usedArea: 0
	};
}
function toPackedPanel(format, index, attempt) {
	const spec = PANEL_SPECS[format];
	const usedArea = attempt.usedArea;
	const total = spec.length * spec.width;
	const wasteArea = Math.max(0, total - usedArea);
	return {
		id: `${format}-${index}`,
		index,
		format,
		length: spec.length,
		width: spec.width,
		placements: attempt.placements,
		usedArea,
		wasteArea,
		wastePercent: total > 0 ? wasteArea / total * 100 : 0,
		method: attempt.method
	};
}
function reindexPanels(panels) {
	return panels.map((p, i) => ({
		...p,
		index: i + 1,
		id: `${p.format}-${i + 1}`
	}));
}
function packAllBins(format, items, options) {
	const panels = [];
	let remaining = items.slice();
	let guard = 0;
	while (remaining.length > 0 && guard < 500) {
		guard += 1;
		const attempt = packOneBinBest(format, remaining, options);
		if (attempt.placements.length === 0) break;
		panels.push(toPackedPanel(format, panels.length + 1, attempt));
		remaining = attempt.remaining;
	}
	return {
		panels,
		unplaced: remaining
	};
}
function finishStrategy(id, label, panels, unplaced) {
	const counts = {
		A: panels.filter((p) => p.format === "A").length,
		B: panels.filter((p) => p.format === "B").length
	};
	const purchasedArea = counts.A * panelArea("A") + counts.B * panelArea("B");
	const usedArea = panels.reduce((s, p) => s + p.usedArea, 0);
	const wastePercent = purchasedArea > 0 ? (purchasedArea - usedArea) / purchasedArea * 100 : 0;
	const methods = new Set(panels.map((p) => p.method));
	return {
		id,
		label,
		panels,
		counts,
		purchasedArea,
		usedArea,
		wastePercent,
		unplaced,
		method: methods.size === 1 ? [...methods][0] : "mixte"
	};
}
function cheaper(a, b) {
	if (a.unplaced.length !== b.unplaced.length) return a.unplaced.length < b.unplaced.length;
	if (a.purchasedArea !== b.purchasedArea) return a.purchasedArea < b.purchasedArea;
	if (a.wastePercent !== b.wastePercent) return a.wastePercent < b.wastePercent;
	return a.panels.length < b.panels.length;
}
function pickCheapest(results) {
	let best = results[0];
	for (const r of results.slice(1)) if (cheaper(r, best)) best = r;
	return best;
}
function onlyFitsB(item, options) {
	return !pieceFitsFormat(item.w, item.h, "A", options.allowRotation, options.kerf) && pieceFitsFormat(item.w, item.h, "B", options.allowRotation, options.kerf);
}
function chooseNextPanel(a, b, remaining, options, prefer) {
	const aOk = a.placements.length > 0;
	const bOk = b.placements.length > 0;
	if (!aOk && !bOk) return null;
	if (!aOk) return {
		format: "B",
		attempt: b
	};
	if (!bOk) return {
		format: "A",
		attempt: a
	};
	const mustB = remaining.filter((it) => onlyFitsB(it, options));
	if (mustB.length > 0) {
		const mustIds = new Set(mustB.map((it) => it.instanceId));
		if (b.placements.some((p) => mustIds.has(p.instanceId))) return {
			format: "B",
			attempt: b
		};
	}
	if (prefer === "A") return {
		format: "A",
		attempt: a
	};
	if (prefer === "B") return {
		format: "B",
		attempt: b
	};
	const utilA = a.usedArea / panelArea("A");
	const utilB = b.usedArea / panelArea("B");
	if (Math.abs(utilA - utilB) > .02) return utilA > utilB ? {
		format: "A",
		attempt: a
	} : {
		format: "B",
		attempt: b
	};
	if (a.usedArea !== b.usedArea) return a.usedArea > b.usedArea ? {
		format: "A",
		attempt: a
	} : {
		format: "B",
		attempt: b
	};
	return {
		format: "A",
		attempt: a
	};
}
function packMixedGreedy(items, options, prefer) {
	const panels = [];
	let remaining = items.slice();
	let guard = 0;
	while (remaining.length > 0 && guard < 500) {
		guard += 1;
		const pick = chooseNextPanel(packOneBinBest("A", remaining, options), packOneBinBest("B", remaining, options), remaining, options, prefer);
		if (!pick) break;
		const placedIds = new Set(pick.attempt.placements.map((p) => p.instanceId));
		panels.push(toPackedPanel(pick.format, panels.length + 1, pick.attempt));
		remaining = remaining.filter((it) => !placedIds.has(it.instanceId));
	}
	return {
		panels,
		unplaced: remaining
	};
}
function packMustBThen(items, options, rest) {
	const must = items.filter((it) => onlyFitsB(it, options));
	const others = items.filter((it) => !onlyFitsB(it, options));
	const seed = must.concat(others);
	const panels = [];
	let remaining = seed;
	while (remaining.some((it) => onlyFitsB(it, options))) {
		const attempt = packOneBinBest("B", remaining, options);
		if (attempt.placements.length === 0) break;
		const placedIds = new Set(attempt.placements.map((p) => p.instanceId));
		panels.push(toPackedPanel("B", panels.length + 1, attempt));
		remaining = remaining.filter((it) => !placedIds.has(it.instanceId));
	}
	if (remaining.length === 0) return {
		panels,
		unplaced: []
	};
	const restPack = rest === "A" || rest === "B" ? packAllBins(rest, remaining, options) : packMixedGreedy(remaining, options, "util");
	return {
		panels: reindexPanels(panels.concat(restPack.panels)),
		unplaced: restPack.unplaced
	};
}
function packMixedBest(items, options) {
	const variants = [
		packMixedGreedy(items, options, "util"),
		packMixedGreedy(items, options, "A"),
		packMixedGreedy(items, options, "B"),
		packMustBThen(items, options, "greedy"),
		packMustBThen(items, options, "A"),
		packMustBThen(items, options, "B")
	];
	const scored = variants.map((v, i) => finishStrategy("mixed", `mixte-${i}`, v.panels, v.unplaced));
	const best = pickCheapest(scored);
	return variants[scored.indexOf(best)];
}
function scoreStrategy(result) {
	return result.purchasedArea + result.unplaced.length * 0xe8d4a51000 + result.wastePercent;
}
function optimizeCutting(defs, options) {
	const kerf = Math.max(0, options.kerf);
	const opts = {
		...options,
		kerf
	};
	const items = explodePieces(defs.filter((d) => d.length > 0 && d.width > 0 && d.qty > 0));
	const allA = packAllBins("A", items, opts);
	const allB = packAllBins("B", items, opts);
	const mixed = packMixedBest(items, opts);
	const strategies = [
		finishStrategy("all-A", "Tout en 2500 × 400", allA.panels, allA.unplaced),
		finishStrategy("all-B", "Tout en 2500 × 600", allB.panels, allB.unplaced),
		finishStrategy("mixed", "Mixte 400 + 600", mixed.panels, mixed.unplaced)
	];
	let best = strategies[0];
	for (const s of strategies.slice(1)) if (scoreStrategy(s) < scoreStrategy(best)) best = s;
	return {
		strategies,
		bestId: best.id
	};
}
function parseNum$1(s) {
	const n = Number(String(s).replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}
function PieceList({ rows, onChange, kerf, allowRotation }) {
	function update(id, patch) {
		onChange(rows.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
	}
	function remove(id) {
		if (rows.length <= 1) {
			onChange([emptyRow()]);
			return;
		}
		onChange(rows.filter((r) => r.id !== id));
	}
	const totalQty = rows.reduce((s, r) => s + Math.max(0, Math.floor(parseNum$1(r.qty))), 0);
	const totalArea = rows.reduce((s, r) => {
		const l = parseNum$1(r.length);
		const w = parseNum$1(r.width);
		const q = Math.max(0, Math.floor(parseNum$1(r.qty)));
		return s + l * w * q;
	}, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "debit-title",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "debit-title",
					className: "font-display text-xl font-medium tracking-tight",
					children: "Débit des pièces"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: [
						"Dimensions en millimètres. ",
						totalQty,
						" pièce",
						totalQty > 1 ? "s" : "",
						" ·",
						" ",
						(totalArea / 1e6).toLocaleString("fr-FR", {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						}),
						" ",
						"m² à débiter"
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					variant: "outline",
					onClick: () => onChange([...rows, emptyRow()]),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}), "Ajouter une pièce"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hidden overflow-hidden rounded-lg border border-border bg-card md:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border bg-muted/60 text-left text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-2.5 font-medium",
								children: "Nom"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "w-32 px-3 py-2.5 font-medium",
								children: "Longueur"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "w-32 px-3 py-2.5 font-medium",
								children: "Largeur"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "w-24 px-3 py-2.5 font-medium",
								children: "Qté"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "w-12 px-3 py-2.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "sr-only",
									children: "Supprimer"
								})
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PieceTableRow, {
						row,
						kerf,
						allowRotation,
						onChange: (patch) => update(row.id, patch),
						onRemove: () => remove(row.id)
					}, row.id)) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-3 md:hidden",
				children: rows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-2 flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs font-medium text-muted-foreground",
								children: ["Pièce ", i + 1]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "ghost",
								size: "icon-sm",
								"aria-label": "Supprimer la pièce",
								onClick: () => remove(row.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "col-span-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: `name-${row.id}`,
										children: "Nom"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: `name-${row.id}`,
										className: "mt-1",
										placeholder: "montant, traverse…",
										value: row.name,
										onChange: (e) => update(row.id, { name: e.target.value })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									id: `l-${row.id}`,
									label: "Longueur (mm)",
									value: row.length,
									onChange: (v) => update(row.id, { length: v })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									id: `w-${row.id}`,
									label: "Largeur (mm)",
									value: row.width,
									onChange: (v) => update(row.id, { width: v })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumField, {
									id: `q-${row.id}`,
									label: "Quantité",
									value: row.qty,
									onChange: (v) => update(row.id, { qty: v }),
									integer: true
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FitHint, {
							row,
							kerf,
							allowRotation
						})
					]
				}, row.id))
			})
		]
	});
}
function NumField({ id, label, value, onChange, integer }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		htmlFor: id,
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		id,
		className: "mt-1 tabular-nums",
		inputMode: "numeric",
		value,
		onChange: (e) => onChange(e.target.value.replace(integer ? /[^\d]/g : /[^\d.,]/g, ""))
	})] });
}
function PieceTableRow({ row, kerf, allowRotation, onChange, onRemove }) {
	const l = parseNum$1(row.length);
	const w = parseNum$1(row.width);
	const invalid = l > 0 && w > 0 && !pieceFitsAnyPanel(l, w, allowRotation, kerf);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
		className: "border-b border-border last:border-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					"aria-label": "Nom de la pièce",
					placeholder: "montant, traverse…",
					value: row.name,
					onChange: (e) => onChange({ name: e.target.value }),
					className: "h-10"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					"aria-label": "Longueur en mm",
					inputMode: "numeric",
					value: row.length,
					onChange: (e) => onChange({ length: e.target.value.replace(/[^\d.,]/g, "") }),
					className: cn("h-10 tabular-nums", invalid && "border-destructive")
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					"aria-label": "Largeur en mm",
					inputMode: "numeric",
					value: row.width,
					onChange: (e) => onChange({ width: e.target.value.replace(/[^\d.,]/g, "") }),
					className: cn("h-10 tabular-nums", invalid && "border-destructive")
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					"aria-label": "Quantité",
					inputMode: "numeric",
					value: row.qty,
					onChange: (e) => onChange({ qty: e.target.value.replace(/[^\d]/g, "") }),
					className: "h-10 tabular-nums"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-1 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					size: "icon-sm",
					"aria-label": "Supprimer la pièce",
					onClick: onRemove,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
				})
			})
		]
	});
}
function FitHint({ row, kerf, allowRotation }) {
	const l = parseNum$1(row.length);
	const w = parseNum$1(row.width);
	if (l <= 0 || w <= 0) return null;
	if (pieceFitsAnyPanel(l, w, allowRotation, kerf)) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-2 text-xs text-destructive",
		children: "Cette pièce ne rentre dans aucun panneau (max 2500 × 600 mm)."
	});
}
function Switch({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
		className: cn("peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", "data-[state=checked]:bg-primary data-[state=unchecked]:bg-border", "disabled:cursor-not-allowed disabled:opacity-50", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: cn("pointer-events-none block size-5 rounded-full bg-card shadow-sm transition-transform duration-150", "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5") })
	});
}
function parsePositive(raw) {
	const n = Number(raw.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}
function SettingsBar({ settings, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 sm:grid-cols-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "kerf",
					children: "Trait de scie (kerf)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative mt-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "kerf",
						inputMode: "decimal",
						value: String(settings.kerf),
						onChange: (e) => {
							onChange({ kerf: parsePositive(e.target.value.replace(/[^\d.,]/g, "")) });
						},
						className: "pr-10 tabular-nums"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground",
						children: "mm"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Défaut 3 mm"
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: "method",
				children: "Méthode de calepinage"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				id: "method",
				value: settings.method,
				onChange: (e) => onChange({ method: e.target.value }),
				className: cn("mt-1.5 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"),
				children: METHOD_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: o.value,
					children: o.label
				}, o.value))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3 rounded-lg bg-muted/70 px-4 py-3 sm:mt-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "rotation",
					children: "Autoriser la rotation 90°"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Utile si le fil du bois n’est pas imposé"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					id: "rotation",
					checked: settings.allowRotation,
					onCheckedChange: (v) => onChange({ allowRotation: v })
				})]
			})
		]
	});
}
var badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
	variants: { variant: {
		default: "bg-primary text-primary-foreground",
		muted: "bg-muted text-muted-foreground",
		outline: "border border-border text-foreground",
		good: "bg-accent text-accent-foreground",
		warn: "bg-secondary text-warn"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
/**
* Prix de vente du meuble (matière valorisée + MO + quincaillerie + marge).
*
* Formule :
*   1. Prix_m²_réel   = Prix_achat_m² / (1 − Taux_perte / 100)
*   2. Coût_matière   = Surface_m²_nécessaire × Prix_m²_réel
*   3. Coût_MO        = Temps_h × Taux_horaire
*   4. Coût_quincaillerie = Σ (qté × prix unitaire)
*   5. Coût_revient   = Coût_matière + Coût_MO + Coût_quincaillerie
*   6. Prix_vente_HT  = Coût_revient / (1 − Marge% / 100)
*   7. TVA            = Prix_vente_HT × Taux_TVA / 100
*   8. Prix_vente_TTC = Prix_vente_HT + TVA
*
* ------------------------------------------------------------------
* Exemple chiffré (bouton « Exemple devis ») :
*
*   Prix d'achat fournisseur : 40 €/m²
*   Surface nécessaire       : 2 m²
*   Taux de perte            : 15 %
*   Main d'œuvre             : 2,5 h × 40 €/h = 100 €
*   Quincaillerie            : 4 × 4,50 € + 2 × 6,00 € = 30 €
*   Marge souhaitée          : 30 %
*
*   Prix réel/m²   = 40 / 0,85 = 47,06 €
*   Coût matière   = 2 × 47,06 = 94,12 €
*   Coût de revient = 94,12 + 100 + 30 = 224,12 €
*   Prix de vente HT = 224,12 / 0,70 = 320,17 €
*   Marge          = 320,17 − 224,12 = 96,05 €
*   TVA 20 %       = 64,03 €
*   Prix TTC       = 384,20 €
* ------------------------------------------------------------------
*/
function parseAmount(s) {
	const n = typeof s === "number" ? s : Number(String(s).replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}
function laborCost(hours, hourlyRate) {
	return roundCents(Math.max(0, hours) * Math.max(0, hourlyRate));
}
function hardwareLines(items) {
	return items.map((item) => {
		const qty = Math.max(0, parseAmount(item.qty));
		const unitPrice = Math.max(0, parseAmount(item.unitPrice));
		return {
			id: item.id,
			name: item.name.trim(),
			qty,
			unitPrice,
			subtotal: roundCents(qty * unitPrice)
		};
	});
}
function sumHardware(items) {
	return roundCents(hardwareLines(items).reduce((s, line) => s + line.subtotal, 0));
}
function panelBuyLines(counts, pricePerM2) {
	const price = Math.max(0, pricePerM2);
	const out = [];
	["A", "B"].forEach((format) => {
		const qty = counts[format];
		if (qty <= 0) return;
		const spec = PANEL_SPECS[format];
		const areaM2 = spec.length * spec.width / 1e6;
		const unitPrice = roundCents(areaM2 * price);
		out.push({
			format,
			label: `Panneau ${spec.label}`,
			dims: spec.label,
			qty,
			areaM2,
			unitPrice,
			subtotal: roundCents(qty * unitPrice)
		});
	});
	return out;
}
function applyVat(ht, vatPct) {
	const tva = roundCents(ht * Math.max(0, vatPct) / 100);
	return {
		tva,
		ttc: roundCents(ht + tva)
	};
}
function computeSellingPrice(input) {
	const pricePerM2 = finiteOrZero(input.pricePerM2);
	const surfaceM2 = finiteOrZero(input.surfaceM2);
	const wastePct = finiteOrZero(input.wastePct);
	const labor = finiteOrZero(input.labor);
	const hardware = finiteOrZero(input.hardware);
	const marginPct = finiteOrZero(input.marginPct);
	if (wastePct >= 100) return {
		ok: false,
		error: "Le taux de perte doit être inférieur à 100 % (sinon le bois utile est nul)."
	};
	if (wastePct < 0) return {
		ok: false,
		error: "Le taux de perte ne peut pas être négatif."
	};
	if (marginPct >= 100) return {
		ok: false,
		error: "La marge doit être inférieure à 100 % du prix de vente (division impossible)."
	};
	if (marginPct < 0) return {
		ok: false,
		error: "La marge ne peut pas être négative."
	};
	const prixM2Reel = roundCents(pricePerM2 / (1 - wastePct / 100));
	const coutMatiere = roundCents(surfaceM2 * prixM2Reel);
	const coutRevient = roundCents(coutMatiere + labor + hardware);
	const prixVente = roundCents(coutRevient / (1 - marginPct / 100));
	const margeEuros = roundCents(prixVente - coutRevient);
	return {
		ok: true,
		pricePerM2: roundCents(pricePerM2),
		surfaceM2,
		wastePct,
		prixM2Reel,
		coutMatiere,
		labor: roundCents(labor),
		hardware: roundCents(hardware),
		coutRevient,
		marginPct,
		margeEuros,
		prixVente
	};
}
function sellingFromInputs(surfaceM2, pricePerM2, wastePct, laborHours, hourlyRate, items, marginPct) {
	return computeSellingPrice({
		pricePerM2,
		surfaceM2,
		wastePct,
		labor: laborCost(laborHours, hourlyRate),
		hardware: sumHardware(items),
		marginPct
	});
}
function roundCents(n) {
	return Math.round(n * 100) / 100;
}
function finiteOrZero(n) {
	return Number.isFinite(n) ? n : 0;
}
var PANEL_A_ID = "stock-panel-A";
var PANEL_B_ID = "stock-panel-B";
function normalizeName(s) {
	return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}
function stockStatus(item) {
	if (item.qty <= 0) return "empty";
	if (item.qty < item.minQty) return "low";
	return "ok";
}
function stockValue(items) {
	return items.reduce((s, it) => s + Math.max(0, it.qty) * Math.max(0, it.unitCost), 0);
}
function findPanel(items, format) {
	const id = format === "A" ? PANEL_A_ID : PANEL_B_ID;
	return items.find((it) => it.id === id || it.kind === (format === "A" ? "panel-A" : "panel-B"));
}
function findByName(items, name) {
	const n = normalizeName(name);
	if (!n) return void 0;
	return items.find((it) => normalizeName(it.name) === n);
}
function jobNeedFromQuote(counts, hardware) {
	return {
		panelsA: Math.max(0, counts.A),
		panelsB: Math.max(0, counts.B),
		hardware: hardwareLines(hardware).filter((l) => l.qty > 0 && l.name).map((l) => ({
			name: l.name,
			qty: l.qty
		}))
	};
}
function coverage(items, need) {
	const lines = [];
	const a = findPanel(items, "A");
	const b = findPanel(items, "B");
	if (need.panelsA > 0 || a) lines.push({
		key: "panel-A",
		itemId: a?.id ?? null,
		name: a?.name ?? "Panneau 2500 × 400 mm",
		needed: need.panelsA,
		onHand: a?.qty ?? 0,
		gap: Math.max(0, need.panelsA - (a?.qty ?? 0))
	});
	if (need.panelsB > 0 || b) lines.push({
		key: "panel-B",
		itemId: b?.id ?? null,
		name: b?.name ?? "Panneau 2500 × 600 mm",
		needed: need.panelsB,
		onHand: b?.qty ?? 0,
		gap: Math.max(0, need.panelsB - (b?.qty ?? 0))
	});
	for (const h of need.hardware) {
		const found = findByName(items, h.name);
		lines.push({
			key: `hw-${normalizeName(h.name)}`,
			itemId: found?.id ?? null,
			name: h.name,
			needed: h.qty,
			onHand: found?.qty ?? 0,
			gap: Math.max(0, h.qty - (found?.qty ?? 0))
		});
	}
	return lines;
}
function hasShortage(lines) {
	return lines.some((l) => l.needed > 0 && l.gap > 0);
}
/** Articles à commander = écart besoin − stock (gap > 0). */
function toOrder(lines) {
	return lines.filter((l) => l.gap > 0 && l.needed > 0).map((l) => ({
		name: l.name,
		qty: l.gap
	}));
}
function emptyStockItem() {
	return {
		id: newId(),
		kind: "hardware",
		name: "",
		sku: "",
		qty: 0,
		unit: "pièce",
		unitCost: 0,
		minQty: 0
	};
}
function applyDelta(items, itemId, delta) {
	return items.map((it) => it.id === itemId ? {
		...it,
		qty: Math.max(0, roundQty(it.qty + delta))
	} : it);
}
function recordMove(moves, itemId, type, qty, note, quoteNumber = "") {
	return [{
		id: newId(),
		itemId,
		date: (/* @__PURE__ */ new Date()).toISOString(),
		type,
		qty: roundQty(qty),
		note,
		quoteNumber
	}, ...moves].slice(0, 80);
}
function consumeForJob(items, moves, need, quoteNumber, partial) {
	const lines = coverage(items, need).filter((l) => l.needed > 0);
	if (!partial && hasShortage(lines)) return {
		items,
		moves,
		ok: false,
		lines
	};
	let nextItems = items;
	let nextMoves = moves;
	for (const line of lines) {
		if (!line.itemId) continue;
		const take = partial ? Math.min(line.needed, line.onHand) : line.needed;
		if (take <= 0) continue;
		nextItems = applyDelta(nextItems, line.itemId, -take);
		nextMoves = recordMove(nextMoves, line.itemId, "out", take, `Chantier ${quoteNumber || "sans n°"}`.trim(), quoteNumber);
	}
	return {
		items: nextItems,
		moves: nextMoves,
		ok: true,
		lines: coverage(nextItems, need)
	};
}
function ensureStockArticle(items, name, unitCost = 0) {
	const trimmed = name.trim();
	if (!trimmed) return items;
	if (findByName(items, trimmed)) return items;
	return [...items, {
		...emptyStockItem(),
		name: trimmed,
		unitCost: Math.max(0, unitCost),
		qty: 0,
		minQty: 0,
		kind: "hardware"
	}];
}
function exampleStock() {
	return [
		{
			id: PANEL_A_ID,
			kind: "panel-A",
			name: "Panneau 2500 × 400 mm",
			sku: "P-400",
			qty: 10,
			unit: "pièce",
			unitCost: 40,
			minQty: 4
		},
		{
			id: PANEL_B_ID,
			kind: "panel-B",
			name: "Panneau 2500 × 600 mm",
			sku: "P-600",
			qty: 6,
			unit: "pièce",
			unitCost: 60,
			minQty: 2
		},
		{
			id: "stock-hw-1",
			kind: "hardware",
			name: "Charnières invisibles",
			sku: "CH-INV",
			qty: 16,
			unit: "pièce",
			unitCost: 4.5,
			minQty: 8
		},
		{
			id: "stock-hw-2",
			kind: "hardware",
			name: "Poignées inox",
			sku: "PO-INOX",
			qty: 8,
			unit: "pièce",
			unitCost: 6,
			minQty: 4
		},
		{
			id: "stock-hw-3",
			kind: "hardware",
			name: "Vis à bois 4×40",
			sku: "VIS-440",
			qty: 250,
			unit: "pièce",
			unitCost: .04,
			minQty: 100
		}
	];
}
function ensurePanelRows(items) {
	const seed = exampleStock().filter((it) => it.kind === "panel-A" || it.kind === "panel-B");
	let next = items;
	for (const row of seed) if (!findPanel(next, row.kind === "panel-A" ? "A" : "B")) next = [row, ...next];
	return next;
}
function roundQty(n) {
	return Math.round(n * 100) / 100;
}
function ResultsPanel({ strategies, selected, bestId, onSelect, pricePerM2, stock = [] }) {
	const current = strategies.find((s) => s.id === selected) ?? strategies[0];
	if (!current) return null;
	const onHandA = findPanel(stock, "A")?.qty ?? 0;
	const onHandB = findPanel(stock, "B")?.qty ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "resultats-title",
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				id: "resultats-title",
				className: "font-display text-xl font-medium tracking-tight",
				children: "Comparaison des stratégies"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "Objectif : minimiser la surface de panneaux achetée."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 md:grid-cols-3",
				children: strategies.map((s) => {
					const isBest = s.id === bestId;
					const isSel = s.id === selected;
					const achat = s.purchasedArea / 1e6 * pricePerM2;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onSelect(s.id),
						className: cn("rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-colors duration-150", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isSel && "ring-2 ring-primary"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-base font-medium",
									children: s.label
								}), isBest && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
									variant: "good",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-1 size-3" }), "Recommandé"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 font-display text-3xl font-medium tabular-nums tracking-tight",
								children: [s.counts.A + s.counts.B, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ml-1.5 text-base font-normal text-muted-foreground",
									children: ["panneau", s.counts.A + s.counts.B > 1 ? "x" : ""]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-sm tabular-nums text-muted-foreground",
								children: [
									s.counts.A,
									" × 400 mm · ",
									s.counts.B,
									" × 600 mm"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "mt-3 grid grid-cols-2 gap-2 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Surface achetée"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "tabular-nums font-medium",
										children: formatArea(s.purchasedArea)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Chute plan"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "tabular-nums font-medium",
										children: formatPct(s.wastePercent)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "col-span-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted-foreground",
											children: "Achat panneaux"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "tabular-nums font-medium",
											children: formatEuro(achat)
										})]
									})
								]
							}),
							s.unplaced.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 flex items-start gap-1.5 text-xs text-destructive",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mt-px size-3.5 shrink-0" }),
									s.unplaced.length,
									" pièce",
									s.unplaced.length > 1 ? "s" : "",
									" non placée",
									s.unplaced.length > 1 ? "s" : ""
								]
							})
						]
					}, s.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "font-display text-base font-medium",
						children: ["À acheter — ", current.label]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BuyStat, {
							label: "Panneaux 2500 × 400 mm",
							value: current.counts.A,
							onHand: onHandA
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BuyStat, {
							label: "Panneaux 2500 × 600 mm",
							value: current.counts.B,
							onHand: onHandB
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Total panneaux"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-lg font-medium tabular-nums",
								children: current.counts.A + current.counts.B
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Surface utile"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-lg font-medium tabular-nums",
								children: formatArea(current.usedArea)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Surface achetée"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-lg font-medium tabular-nums",
								children: formatArea(current.purchasedArea)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Chute du plan"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "text-lg font-medium tabular-nums",
								children: formatPct(current.wastePercent)
							})] })
						]
					})
				]
			}) })
		]
	});
}
function BuyStat({ label, value, onHand }) {
	const gap = Math.max(0, value - onHand);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-muted/70 px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-display text-4xl font-medium tabular-nums tracking-tight",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs tabular-nums text-muted-foreground",
				children: [
					"stock ",
					onHand,
					value > 0 && gap === 0 ? " · couvert" : "",
					gap > 0 ? ` · à commander ${gap}` : ""
				]
			})
		]
	});
}
function HardwareList({ items, onChange, stock = [], onEnsureStock }) {
	const lines = hardwareLines(items);
	const total = sumHardware(items);
	const catalog = stock.filter((s) => (s.kind === "hardware" || s.kind === "other") && s.name.trim());
	function update(id, patch) {
		onChange(items.map((it) => it.id === id ? {
			...it,
			...patch
		} : it));
	}
	function remove(id) {
		if (items.length <= 1) {
			onChange([emptyHardwareItem()]);
			return;
		}
		onChange(items.filter((it) => it.id !== id));
	}
	function pickFromStock(stockId) {
		const found = stock.find((s) => s.id === stockId);
		if (!found) return;
		const blank = items.find((it) => !it.name.trim());
		const row = {
			id: blank?.id ?? emptyHardwareItem().id,
			name: found.name,
			qty: blank?.qty || "1",
			unitPrice: blank?.unitPrice || String(found.unitCost)
		};
		if (blank) onChange(items.map((it) => it.id === blank.id ? row : it));
		else onChange([...items, row]);
	}
	function nameChange(item, name) {
		const found = findByName(stock, name);
		const patch = { name };
		if (found && !item.unitPrice.trim()) patch.unitPrice = String(found.unitCost);
		update(item.id, patch);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "quincaillerie-title",
		className: "no-print",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					id: "quincaillerie-title",
					className: "font-display text-base font-medium",
					children: "Quincaillerie et fournitures"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Chaque ligne : nom, quantité, prix unitaire. Le stock atelier s’affiche à droite."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [catalog.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: "flex h-11 rounded-md border border-input bg-card px-3 text-sm",
						defaultValue: "",
						"aria-label": "Ajouter depuis le stock",
						onChange: (e) => {
							if (e.target.value) pickFromStock(e.target.value);
							e.target.value = "";
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "Depuis le stock…"
						}), catalog.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
							value: it.id,
							children: [
								it.name,
								" (",
								it.qty,
								")"
							]
						}, it.id))]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "outline",
						onClick: () => onChange([...items, emptyHardwareItem()]),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}), "Ajouter un article"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hidden overflow-hidden rounded-lg border border-border bg-card md:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border bg-muted/60 text-left text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Article"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-24 px-3 py-2.5 font-medium",
									children: "Qté"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-32 px-3 py-2.5 font-medium",
									children: "Prix unit."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-32 px-3 py-2.5 font-medium",
									children: "Sous-total"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-36 px-3 py-2.5 font-medium",
									children: "Stock"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-12 px-3 py-2.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sr-only",
										children: "Supprimer"
									})
								})
							]
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: items.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border last:border-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										"aria-label": "Nom de l’article",
										placeholder: "Charnières, poignées…",
										value: item.name,
										onChange: (e) => nameChange(item, e.target.value)
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										"aria-label": "Quantité",
										className: "tabular-nums",
										inputMode: "decimal",
										value: item.qty,
										onChange: (e) => update(item.id, { qty: e.target.value.replace(/[^\d.,]/g, "") })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										"aria-label": "Prix unitaire",
										className: "tabular-nums",
										inputMode: "decimal",
										value: item.unitPrice,
										onChange: (e) => update(item.id, { unitPrice: e.target.value.replace(/[^\d.,]/g, "") })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-1.5 tabular-nums font-medium",
									children: formatEuro(lines[i]?.subtotal ?? 0)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-1.5 text-xs tabular-nums text-muted-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockCell, {
										stock,
										name: item.name,
										needed: lines[i]?.qty ?? 0,
										unitPrice: lines[i]?.unitPrice ?? 0,
										onEnsureStock
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-1 py-1.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "button",
										variant: "ghost",
										size: "icon-sm",
										"aria-label": "Supprimer l’article",
										onClick: () => remove(item.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
									})
								})
							]
						}, item.id)) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tfoot", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "bg-muted/60",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: 3,
								className: "px-3 py-2.5 text-sm text-muted-foreground",
								children: "Total quincaillerie"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2.5 font-medium tabular-nums",
								colSpan: 2,
								children: formatEuro(total)
							})]
						}) })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "flex flex-col gap-3 md:hidden",
				children: [items.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg border border-border bg-card p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									className: "sr-only",
									htmlFor: `hn-${item.id}`,
									children: "Article"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: `hn-${item.id}`,
									placeholder: "Nom de l’article",
									value: item.name,
									onChange: (e) => nameChange(item, e.target.value)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "ghost",
									size: "icon-sm",
									"aria-label": "Supprimer l’article",
									onClick: () => remove(item.id),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: `hq-${item.id}`,
								children: "Quantité"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: `hq-${item.id}`,
								className: "mt-1 tabular-nums",
								inputMode: "decimal",
								value: item.qty,
								onChange: (e) => update(item.id, { qty: e.target.value.replace(/[^\d.,]/g, "") })
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: `hp-${item.id}`,
								children: "Prix unit. (€)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: `hp-${item.id}`,
								className: "mt-1 tabular-nums",
								inputMode: "decimal",
								value: item.unitPrice,
								onChange: (e) => update(item.id, { unitPrice: e.target.value.replace(/[^\d.,]/g, "") })
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm tabular-nums",
							children: [
								"Sous-total ",
								formatEuro(lines[i]?.subtotal ?? 0),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockCell, {
									stock,
									name: item.name,
									needed: lines[i]?.qty ?? 0,
									unitPrice: lines[i]?.unitPrice ?? 0,
									onEnsureStock
								})
							]
						})
					]
				}, item.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg bg-muted/70 px-3 py-2 text-sm font-medium tabular-nums",
					children: ["Total quincaillerie ", formatEuro(total)]
				})]
			})
		]
	});
}
function StockCell({ stock, name, needed, unitPrice, onEnsureStock }) {
	const found = findByName(stock, name);
	if (!name.trim()) return null;
	if (!found) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "inline-flex flex-wrap items-center gap-1",
		children: ["hors stock", onEnsureStock && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "text-primary underline-offset-2 hover:underline",
			onClick: () => onEnsureStock(name, unitPrice),
			children: "créer"
		})]
	});
	if (needed > 0 && found.qty < needed) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
		"stock ",
		found.qty,
		" (manque ",
		needed - found.qty,
		")"
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["stock ", found.qty] });
}
function parseNum(raw) {
	const n = Number(raw.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}
function QuotePanel({ settings, onChange, autoSurfaceM2, purchasedAreaMm2, onGenerateQuote, stock = [], onEnsureStock }) {
	const surfaceM2 = settings.surfaceOverrideM2 ?? autoSurfaceM2;
	const mo = laborCost(settings.laborHours, settings.hourlyRate);
	const selling = sellingFromInputs(surfaceM2, settings.pricePerM2, settings.wastePct, settings.laborHours, settings.hourlyRate, settings.hardwareItems, settings.marginPct);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		"aria-labelledby": "devis-title",
		className: "no-print",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "devis-title",
					className: "font-display text-xl font-medium tracking-tight",
					children: "Prix de vente"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Surface du débit, perte, main d’œuvre au temps passé, quincaillerie ligne à ligne, puis marge."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "no-print mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							id: "price-m2",
							label: "Prix d’achat fournisseur",
							suffix: "€/m²",
							value: settings.pricePerM2,
							onChange: (pricePerM2) => onChange({ pricePerM2 })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "surface-m2",
								children: "Surface nécessaire"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative mt-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "surface-m2",
									inputMode: "decimal",
									value: String(surfaceM2),
									onChange: (e) => onChange({ surfaceOverrideM2: parseNum(e.target.value) }),
									className: "pr-12 tabular-nums"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground",
									children: "m²"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"Débit :",
									" ",
									autoSurfaceM2.toLocaleString("fr-FR", {
										maximumFractionDigits: 2,
										minimumFractionDigits: 2
									}),
									" ",
									"m²"
								] }), settings.surfaceOverrideM2 != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "ghost",
									className: "h-auto px-1 py-0 text-xs",
									onClick: () => onChange({ surfaceOverrideM2: null }),
									children: "Reprendre le débit"
								})]
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							id: "waste",
							label: "Taux de perte / chute",
							suffix: "%",
							value: settings.wastePct,
							onChange: (wastePct) => onChange({ wastePct }),
							hint: "Défaut 15 %"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							id: "labor-hours",
							label: "Temps de travail",
							suffix: "h",
							value: settings.laborHours,
							onChange: (laborHours) => onChange({ laborHours })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							id: "hourly-rate",
							label: "Taux horaire",
							suffix: "€/h",
							value: settings.hourlyRate,
							onChange: (hourlyRate) => onChange({ hourlyRate })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-lg bg-muted/70 px-4 py-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted-foreground",
									children: "Coût main d’œuvre"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-lg font-medium tabular-nums",
									children: formatEuro(mo)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-0.5 text-xs text-muted-foreground",
									children: [
										settings.laborHours,
										" h × ",
										formatEuro(settings.hourlyRate),
										"/h"
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							id: "margin",
							label: "Marge commerciale",
							suffix: "%",
							value: settings.marginPct,
							onChange: (marginPct) => onChange({ marginPct }),
							hint: "Défaut 20 % du prix de vente"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardwareList, {
						items: settings.hardwareItems,
						onChange: (hardwareItems) => onChange({ hardwareItems }),
						stock,
						onEnsureStock
					})
				}),
				selling.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SellingRecap, {
					selling,
					purchasedAreaMm2,
					pricePerM2: settings.pricePerM2,
					onGenerateQuote
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-5 rounded-lg border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive",
					children: selling.error
				})
			]
		}) })
	});
}
function SellingRecap({ selling, purchasedAreaMm2, pricePerM2, onGenerateQuote }) {
	const achatPanneaux = purchasedAreaMm2 / 1e6 * pricePerM2;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
		className: "mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Prix réel compensé",
				value: `${formatEuro(selling.prixM2Reel)} / m²`,
				hint: "achat ÷ (1 − taux de perte)"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Coût matière",
				value: formatEuro(selling.coutMatiere),
				hint: "surface × prix réel"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Main d’œuvre",
				value: formatEuro(selling.labor),
				hint: "temps × taux horaire"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Quincaillerie",
				value: formatEuro(selling.hardware),
				hint: "somme des articles"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Coût de revient",
				value: formatEuro(selling.coutRevient),
				hint: "matière + MO + quincaillerie"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Prix de vente HT",
				value: formatEuro(selling.prixVente),
				hint: `${formatEuro(selling.margeEuros)} de marge · ${formatPct(selling.marginPct)}`,
				emphasize: true
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4 flex flex-wrap items-center justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-muted-foreground",
			children: [
				"Achat panneaux du calepinage (",
				formatArea(purchasedAreaMm2),
				" ×",
				" ",
				formatEuro(pricePerM2),
				"/m²) : ",
				formatEuro(achatPanneaux)
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			type: "button",
			onClick: onGenerateQuote,
			className: "no-print",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {}), "Générer le devis"]
		})]
	})] });
}
function Field({ id, label, suffix, value, onChange, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			htmlFor: id,
			children: label
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mt-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				id,
				inputMode: "decimal",
				value: String(value),
				onChange: (e) => {
					onChange(parseNum(e.target.value.replace(/[^\d.,-]/g, "")));
				},
				className: "pr-14 tabular-nums"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground",
				children: suffix
			})]
		}),
		hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs text-muted-foreground",
			children: hint
		})
	] });
}
function Stat({ label, value, hint, emphasize }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-muted/70 px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
				className: "text-sm text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
				className: emphasize ? "mt-1 font-display text-2xl font-medium tabular-nums tracking-tight text-primary" : "mt-1 text-lg font-medium tabular-nums",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
function QuoteDocument({ settings, onChange, selling, strategy, stock = [] }) {
	const panels = panelBuyLines(strategy.counts, settings.pricePerM2);
	const hw = hardwareLines(settings.hardwareItems).filter((l) => l.name || l.qty > 0 || l.unitPrice > 0);
	const mo = laborCost(settings.laborHours, settings.hourlyRate);
	const vat = applyVat(selling.prixVente, settings.vatPct);
	const dateLabel = formatQuoteDate(settings.quoteDate);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "quote-sheet-title",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IdentityForm, {
				settings,
				onChange
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				id: "quote-sheet",
				className: "quote-sheet mt-4 rounded-xl bg-card px-5 py-6 shadow-[var(--shadow-border)] sm:px-8 sm:py-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex flex-wrap items-start justify-between gap-6 border-b border-border pb-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [settings.logoDataUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: settings.logoDataUrl,
								alt: "",
								className: "h-14 w-14 rounded-md object-contain"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DefaultMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-xl font-medium tracking-tight",
									children: settings.companyName || "Votre atelier"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 whitespace-pre-line text-sm text-muted-foreground",
									children: settings.companyAddress
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted-foreground",
									children: [settings.companyPhone, settings.companyEmail].filter(Boolean).join(" · ")
								}),
								settings.companySiret && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted-foreground",
									children: ["SIRET ", settings.companySiret]
								})
							] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									id: "quote-sheet-title",
									className: "font-display text-2xl font-medium tracking-tight",
									children: "Devis"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm tabular-nums",
									children: settings.quoteNumber
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted-foreground",
									children: dateLabel
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 grid gap-4 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs uppercase tracking-wide text-muted-foreground",
							children: "Client"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-medium",
							children: settings.clientName || "—"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs uppercase tracking-wide text-muted-foreground",
							children: "Objet"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-medium",
							children: settings.furnitureDescription || "Meuble sur mesure"
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QuoteTable, {
						title: "1. Matière première — panneaux à acheter",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Référence" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Dimensions" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "num",
								children: "Qté"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "num",
								children: "Prix unit."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "num",
								children: "Sous-total"
							})
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: panels.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 5,
							children: "Aucun panneau"
						}) }) : panels.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: p.label }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: p.dims }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num",
								children: p.qty
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num",
								children: formatEuro(p.unitPrice)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num",
								children: formatEuro(p.subtotal)
							})
						] }, p.format)) })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-muted-foreground",
						children: [
							"Surface utile ",
							formatArea(strategy.usedArea),
							" · Surface achetée",
							" ",
							formatArea(strategy.purchasedArea),
							" · Chute du plan",
							" ",
							formatPct(strategy.wastePercent),
							" · Taux de perte devis",
							" ",
							formatPct(selling.wastePct),
							stockNote(stock, strategy.counts, settings.hardwareItems)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QuoteTable, {
						title: "2. Quincaillerie et fournitures",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Article" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "num",
									children: "Qté"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "num",
									children: "Prix unit."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "num",
									children: "Sous-total"
								})
							] }) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: hw.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: 4,
								children: "Aucun article"
							}) }) : hw.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: l.name || "Article" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num",
									children: l.qty
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num",
									children: formatEuro(l.unitPrice)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num",
									children: formatEuro(l.subtotal)
								})
							] }, l.id)) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tfoot", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: 3,
								children: "Total quincaillerie"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num",
								children: formatEuro(selling.hardware)
							})] }) })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QuoteTable, {
						title: "3. Main d’œuvre",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Désignation" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "num",
								children: "Temps"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "num",
								children: "Taux"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "num",
								children: "Montant"
							})
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "Fabrication et pose" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "num",
								children: [settings.laborHours, " h"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "num",
								children: [formatEuro(settings.hourlyRate), " / h"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num",
								children: formatEuro(mo)
							})
						] }) })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 ml-auto w-full max-w-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-display text-base font-medium",
							children: "4. Récapitulatif"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-3 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: "Coût matière (perte compensée)",
									value: formatEuro(selling.coutMatiere)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: "Quincaillerie",
									value: formatEuro(selling.hardware)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: "Main d’œuvre",
									value: formatEuro(selling.labor)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: "Coût de revient",
									value: formatEuro(selling.coutRevient)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: `Marge (${formatPct(selling.marginPct)})`,
									value: formatEuro(selling.margeEuros)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: "Prix de vente HT",
									value: formatEuro(selling.prixVente),
									strong: true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: `TVA (${formatPct(settings.vatPct)})`,
									value: formatEuro(vat.tva)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
									label: "Prix de vente TTC",
									value: formatEuro(vat.ttc),
									total: true
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
						className: "mt-8 space-y-2 border-t border-border pt-4 text-sm text-ink-soft",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: settings.validity }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: settings.payment }),
							settings.legal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: settings.legal
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "no-print mt-3 flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					onClick: () => window.print(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, {}), "Imprimer / Exporter en PDF"]
				})
			})
		]
	});
}
function IdentityForm({ settings, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "no-print rounded-xl bg-card px-5 py-5 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl font-medium tracking-tight",
				children: "En-tête du devis"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "Ces informations apparaissent sur le document. Elles ne sont pas réimprimées ici, seulement dans le devis ci-dessous."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
						id: "co-name",
						label: "Nom de l’entreprise",
						value: settings.companyName,
						onChange: (companyName) => onChange({ companyName })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "co-logo",
							children: "Logo (optionnel)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "co-logo",
							type: "file",
							accept: "image/*",
							className: "mt-1.5",
							onChange: (e) => {
								const file = e.target.files?.[0];
								if (!file) return;
								if (file.size > 4e5) return;
								const reader = new FileReader();
								reader.onload = () => onChange({ logoDataUrl: String(reader.result ?? "") });
								reader.readAsDataURL(file);
							}
						}),
						settings.logoDataUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							className: "mt-1 h-auto px-0 py-0 text-xs",
							onClick: () => onChange({ logoDataUrl: "" }),
							children: "Retirer le logo"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "co-addr",
							children: "Coordonnées"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							id: "co-addr",
							rows: 3,
							value: settings.companyAddress,
							onChange: (e) => onChange({ companyAddress: e.target.value }),
							className: "mt-1.5 flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
						id: "co-phone",
						label: "Téléphone",
						value: settings.companyPhone,
						onChange: (companyPhone) => onChange({ companyPhone })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
						id: "co-email",
						label: "E-mail",
						value: settings.companyEmail,
						onChange: (companyEmail) => onChange({ companyEmail })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
						id: "co-siret",
						label: "SIRET",
						value: settings.companySiret,
						onChange: (companySiret) => onChange({ companySiret })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
						id: "client",
						label: "Nom du client",
						value: settings.clientName,
						onChange: (clientName) => onChange({ clientName })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "q-date",
						children: "Date du devis"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "q-date",
						type: "date",
						className: "mt-1.5",
						value: settings.quoteDate,
						onChange: (e) => onChange({ quoteDate: e.target.value })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
						id: "q-num",
						label: "N° de devis",
						value: settings.quoteNumber,
						onChange: (quoteNumber) => onChange({ quoteNumber })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "q-desc",
							children: "Description du meuble"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "q-desc",
							className: "mt-1.5",
							value: settings.furnitureDescription,
							onChange: (e) => onChange({ furnitureDescription: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "vat",
						children: "TVA"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative mt-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "vat",
							inputMode: "decimal",
							className: "pr-10 tabular-nums",
							value: String(settings.vatPct),
							onChange: (e) => {
								const n = Number(e.target.value.replace(",", "."));
								onChange({ vatPct: Number.isFinite(n) ? n : 0 });
							}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground",
							children: "%"
						})]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
						id: "validity",
						label: "Validité",
						value: settings.validity,
						onChange: (validity) => onChange({ validity })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "payment",
							children: "Modalités de paiement"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "payment",
							className: "mt-1.5",
							value: settings.payment,
							onChange: (e) => onChange({ payment: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "legal",
							children: "Mention légale"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "legal",
							className: "mt-1.5",
							value: settings.legal,
							onChange: (e) => onChange({ legal: e.target.value })
						})]
					})
				]
			})
		]
	});
}
function TextField({ id, label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		htmlFor: id,
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		id,
		className: "mt-1.5",
		value,
		onChange: (e) => onChange(e.target.value)
	})] });
}
function QuoteTable({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-display text-base font-medium",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-2 overflow-x-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
				className: "quote-table w-full text-sm",
				children
			})
		})]
	});
}
function Row({ label, value, strong, total }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: total ? "mt-2 flex items-baseline justify-between border-t border-border pt-2 font-display text-lg font-medium" : "flex items-baseline justify-between gap-4 py-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: strong || total ? void 0 : "text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "tabular-nums",
			children: value
		})]
	});
}
function DefaultMark() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "48",
		height: "48",
		viewBox: "0 0 40 40",
		"aria-hidden": true,
		className: "shrink-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				width: "40",
				height: "40",
				rx: "10",
				fill: "#2c4a3e"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "7",
				y: "10",
				width: "26",
				height: "6",
				rx: "1.5",
				fill: "#f4f1ea"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "7",
				y: "18",
				width: "26",
				height: "8",
				rx: "1.5",
				fill: "#d4c4a8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "7",
				y: "28",
				width: "16",
				height: "5",
				rx: "1.5",
				fill: "#e7dfd2"
			})
		]
	});
}
function stockNote(stock, counts, hardware) {
	if (stock.length === 0) return "";
	const lines = coverage(stock, jobNeedFromQuote(counts, hardware)).filter((l) => l.needed > 0);
	if (lines.length === 0) return "";
	const miss = toOrder(lines);
	if (miss.length > 0) return ` · Stock : à commander ${miss.map((m) => `${m.name} ×${m.qty}`).join(", ")}`;
	return " · Stock atelier : besoin couvert";
}
function formatQuoteDate(iso) {
	const d = iso ? /* @__PURE__ */ new Date(`${iso}T12:00:00`) : /* @__PURE__ */ new Date();
	if (Number.isNaN(d.getTime())) return (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "long",
		year: "numeric"
	});
	return d.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "long",
		year: "numeric"
	});
}
var FILLS = [
	"#c4b49a",
	"#9aa392",
	"#8a9aa8",
	"#b79a8c",
	"#7e8f86",
	"#a89880",
	"#8d8074",
	"#6f7f8c"
];
function colorFor(defId) {
	let h = 0;
	for (let i = 0; i < defId.length; i++) h = h * 31 + defId.charCodeAt(i) | 0;
	return FILLS[Math.abs(h) % FILLS.length];
}
function labelFor(p) {
	const dims = `${Math.round(p.rotated ? p.h : p.w)}×${Math.round(p.rotated ? p.w : p.h)}`;
	const rot = p.rotated ? " ↻" : "";
	return `${p.name} ${dims}${rot}`;
}
function CuttingPlan({ panel, kerf }) {
	const pad = 56;
	const viewW = panel.length + 112;
	const viewH = panel.width + 112;
	const spec = PANEL_SPECS[panel.format];
	const hatchId = `hatch-${panel.id}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "print-break rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "mb-3 flex flex-wrap items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "font-display text-base font-medium",
					children: [
						"Panneau ",
						panel.index,
						" · ",
						spec.label
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm tabular-nums text-muted-foreground",
					children: [
						panel.placements.length,
						" pièce",
						panel.placements.length > 1 ? "s" : "",
						" · chute",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-foreground",
							children: formatPct(panel.wastePercent)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mx-1.5 text-border",
							children: "·"
						}),
						panel.method === "guillotine" ? "guillotine" : "rect. max."
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto rounded-md bg-muted/50",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-full min-w-2xl",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
						viewBox: `0 0 ${viewW} ${viewH}`,
						role: "img",
						"aria-label": `Plan de découpe du panneau ${panel.index} ${spec.label}`,
						className: "block h-auto w-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pattern", {
								id: hatchId,
								width: "28",
								height: "28",
								patternUnits: "userSpaceOnUse",
								patternTransform: "rotate(45)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
									x1: "0",
									y1: "0",
									x2: "0",
									y2: "28",
									stroke: "#cfc6b8",
									strokeWidth: "8"
								})
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
								x: pad + panel.length / 2,
								y: 20,
								textAnchor: "middle",
								fill: "#6b6560",
								fontSize: "22",
								fontFamily: "Source Sans 3, sans-serif",
								children: [panel.length, " mm"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
								x: 18,
								y: pad + panel.width / 2,
								textAnchor: "middle",
								fill: "#6b6560",
								fontSize: "22",
								fontFamily: "Source Sans 3, sans-serif",
								transform: `rotate(-90 18 ${pad + panel.width / 2})`,
								children: [panel.width, " mm"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
								transform: `translate(${pad} ${pad})`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
									x: 0,
									y: 0,
									width: panel.length,
									height: panel.width,
									fill: `url(#${hatchId})`,
									stroke: "#1a1814",
									strokeWidth: 2
								}), panel.placements.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PieceRect, {
									placement: p,
									fill: colorFor(p.defId),
									kerf
								}, p.instanceId))]
							})
						]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [uniqueDefs(panel.placements).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-2.5 rounded-sm",
						style: { backgroundColor: colorFor(p.defId) },
						"aria-hidden": true
					}), p.name]
				}, p.defId)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-2.5 rounded-sm bg-waste ring-1 ring-border",
						"aria-hidden": true
					}), "Chute"]
				})]
			})
		]
	});
}
function uniqueDefs(placements) {
	const map = /* @__PURE__ */ new Map();
	for (const p of placements) if (!map.has(p.defId)) map.set(p.defId, p.name);
	return [...map.entries()].map(([defId, name]) => ({
		defId,
		name
	}));
}
function PieceRect({ placement: p, fill, kerf }) {
	const tooSmall = p.w < 180 || p.h < 70;
	const fontSize = Math.max(14, Math.min(28, Math.min(p.w, p.h) * .18));
	const gap = kerf > 0 ? Math.min(kerf, 2) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: labelFor(p) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: p.x + gap / 2,
			y: p.y + gap / 2,
			width: Math.max(0, p.w - gap),
			height: Math.max(0, p.h - gap),
			fill,
			stroke: "#1a1814",
			strokeWidth: 1.5,
			rx: 3
		}),
		!tooSmall && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
			x: p.x + p.w / 2,
			y: p.y + p.h / 2 - fontSize * .15,
			textAnchor: "middle",
			fill: "#1a1814",
			fontSize,
			fontFamily: "Source Sans 3, sans-serif",
			fontWeight: 600,
			children: p.name
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
			x: p.x + p.w / 2,
			y: p.y + p.h / 2 + fontSize * .95,
			textAnchor: "middle",
			fill: "#3f3a35",
			fontSize: fontSize * .78,
			fontFamily: "Source Sans 3, sans-serif",
			children: [
				Math.round(p.w),
				" × ",
				Math.round(p.h),
				p.rotated ? " ↻" : ""
			]
		})] }),
		tooSmall && p.w >= 80 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
			x: p.x + p.w / 2,
			y: p.y + p.h / 2 + 5,
			textAnchor: "middle",
			fill: "#1a1814",
			fontSize: Math.min(18, p.h * .4),
			fontFamily: "Source Sans 3, sans-serif",
			children: [
				Math.round(p.w),
				"×",
				Math.round(p.h)
			]
		})
	] });
}
function CuttingPlanList({ panels, kerf }) {
	if (panels.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]",
		children: "Aucun panneau à afficher pour cette stratégie."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-4"),
		children: panels.map((panel) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CuttingPlan, {
			panel,
			kerf
		}, panel.id))
	});
}
var KIND_LABEL = {
	"panel-A": "Panneau 400",
	"panel-B": "Panneau 600",
	hardware: "Quincaillerie",
	other: "Autre"
};
function StockPanel({ items, moves, onItems, onMoves, need, quoteNumber }) {
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [draftQty, setDraftQty] = (0, import_react.useState)({});
	const [message, setMessage] = (0, import_react.useState)(null);
	const value = stockValue(items);
	const alerts = items.filter((it) => stockStatus(it) !== "ok");
	const visible = filter === "all" ? items : items.filter((it) => it.kind === filter);
	const lines = need ? coverage(items, need).filter((l) => l.needed > 0) : [];
	const shortage = lines.length > 0 && hasShortage(lines);
	const order = toOrder(lines);
	function qtyInput(id, fallback) {
		return draftQty[id] ?? String(fallback === 0 ? 1 : 1);
	}
	function receive(item, type) {
		const n = Number(String(qtyInput(item.id, 1)).replace(",", "."));
		const qty = Number.isFinite(n) && n > 0 ? n : 0;
		if (qty <= 0) return;
		const delta = type === "in" ? qty : -qty;
		onItems(applyDelta(items, item.id, delta));
		onMoves(recordMove(moves, item.id, type, qty, type === "in" ? "Entrée stock" : "Sortie manuelle"));
		setMessage(type === "in" ? `+${qty} ${item.name}` : `−${qty} ${item.name}`);
	}
	function consume(partial) {
		if (!need) return;
		const out = consumeForJob(items, moves, need, quoteNumber, partial);
		if (!out.ok) {
			setMessage("Stock insuffisant. Sortez le disponible, ou commandez le manque.");
			return;
		}
		onItems(out.items);
		onMoves(out.moves);
		setMessage(partial ? "Sortie partielle enregistrée." : `Sortie chantier ${quoteNumber || ""} enregistrée.`);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		id: "stocks",
		"aria-labelledby": "stocks-title",
		className: "no-print",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "stocks-title",
						className: "font-display text-xl font-medium tracking-tight",
						children: "Stocks atelier"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: [
							"Panneaux et quincaillerie. Valeur ",
							formatEuro(value),
							alerts.length > 0 ? ` · ${alerts.length} alerte${alerts.length > 1 ? "s" : ""}` : ""
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => onItems([...items, emptyStockItem()]),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}), "Article"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							onClick: () => {
								onItems(exampleStock());
								setMessage("Exemple de stock rechargé.");
							},
							children: "Exemple stock"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [
						["all", "Tout"],
						["panel-A", "400 mm"],
						["panel-B", "600 mm"],
						["hardware", "Quincaillerie"],
						["other", "Autre"]
					].map(([k, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setFilter(k),
						className: cn("rounded-full px-3 py-1 text-sm", filter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"),
						children: label
					}, k))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 hidden overflow-x-auto rounded-lg border border-border md:block",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border bg-muted/60 text-left text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Article"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Type"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-24 px-3 py-2.5 font-medium",
									children: "Qté"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-20 px-3 py-2.5 font-medium",
									children: "Mini"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "w-28 px-3 py-2.5 font-medium",
									children: "Coût"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "État"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 font-medium",
									children: "Mouvement"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: visible.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockRow, {
							item,
							draft: qtyInput(item.id, 1),
							onDraft: (v) => setDraftQty((d) => ({
								...d,
								[item.id]: v
							})),
							onPatch: (patch) => onItems(items.map((it) => it.id === item.id ? {
								...it,
								...patch
							} : it)),
							onIn: () => receive(item, "in"),
							onOut: () => receive(item, "out"),
							onRemove: () => {
								if (item.kind === "panel-A" || item.kind === "panel-B") return;
								onItems(items.filter((it) => it.id !== item.id));
							}
						}, item.id)) })]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 flex flex-col gap-3 md:hidden",
					children: visible.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-card p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: item.name,
									"aria-label": "Nom",
									onChange: (e) => onItems(items.map((it) => it.id === item.id ? {
										...it,
										name: e.target.value
									} : it))
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { item })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 grid grid-cols-3 gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
										label: "Qté",
										value: item.qty,
										onChange: (qty) => onItems(items.map((it) => it.id === item.id ? {
											...it,
											qty
										} : it))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
										label: "Mini",
										value: item.minQty,
										onChange: (minQty) => onItems(items.map((it) => it.id === item.id ? {
											...it,
											minQty
										} : it))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Num, {
										label: "Coût €",
										value: item.unitCost,
										onChange: (unitCost) => onItems(items.map((it) => it.id === item.id ? {
											...it,
											unitCost
										} : it))
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										className: "w-20 tabular-nums",
										inputMode: "decimal",
										value: qtyInput(item.id, 1),
										onChange: (e) => setDraftQty((d) => ({
											...d,
											[item.id]: e.target.value.replace(/[^\d.,]/g, "")
										})),
										"aria-label": "Quantité mouvement"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										type: "button",
										variant: "outline",
										size: "sm",
										onClick: () => receive(item, "in"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownToLine, {}), "Entrée"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										type: "button",
										variant: "outline",
										size: "sm",
										onClick: () => receive(item, "out"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpFromLine, {}), "Sortie"]
									})
								]
							})
						]
					}, item.id))
				}),
				lines.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 rounded-lg bg-muted/70 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-base font-medium",
								children: "Besoin du chantier"
							}), shortage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "warn",
								children: "Manque"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "good",
								children: "Couvert par le stock"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-1.5 text-sm",
							children: lines.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex flex-wrap items-baseline justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: l.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "tabular-nums text-muted-foreground",
									children: [
										"besoin ",
										l.needed,
										" · stock ",
										l.onHand,
										l.gap > 0 ? ` · à commander ${l.gap}` : ""
									]
								})]
							}, l.key))
						}),
						order.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-warn",
							children: ["À commander : ", order.map((o) => `${o.name} ×${o.qty}`).join(", ")]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								onClick: () => consume(false),
								disabled: shortage,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Package, {}), "Déduire du stock"]
							}), shortage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => consume(true),
								children: "Sortir le disponible"
							})]
						})
					]
				}),
				message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-ink-soft",
					children: message
				}),
				moves.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-display text-base font-medium",
						children: "Derniers mouvements"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-1 text-sm text-muted-foreground",
						children: moves.slice(0, 8).map((m) => {
							const it = items.find((i) => i.id === m.itemId);
							const sign = m.type === "in" ? "+" : m.type === "out" ? "−" : "±";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "tabular-nums",
								children: [
									sign,
									m.qty,
									" ",
									it?.name ?? "article",
									m.quoteNumber ? ` · ${m.quoteNumber}` : "",
									m.note ? ` · ${m.note}` : ""
								]
							}, m.id);
						})
					})]
				})
			]
		}) })
	});
}
function StockRow({ item, draft, onDraft, onPatch, onIn, onOut, onRemove }) {
	const locked = item.kind === "panel-A" || item.kind === "panel-B";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
		className: "border-b border-border last:border-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
				className: "px-2 py-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: item.name,
					onChange: (e) => onPatch({ name: e.target.value }),
					"aria-label": "Nom"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "mt-1",
					value: item.sku,
					placeholder: "Réf.",
					onChange: (e) => onPatch({ sku: e.target.value }),
					"aria-label": "Référence"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: KIND_LABEL[item.kind]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: item.kind,
					onChange: (e) => onPatch({ kind: e.target.value }),
					className: "flex h-11 w-full rounded-md border border-input bg-card px-2 text-sm",
					"aria-label": "Type",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "hardware",
						children: "Quincaillerie"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "other",
						children: "Autre"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "tabular-nums",
					inputMode: "decimal",
					value: String(item.qty),
					onChange: (e) => {
						const n = Number(e.target.value.replace(",", "."));
						onPatch({ qty: Number.isFinite(n) ? n : 0 });
					},
					"aria-label": "Quantité en stock"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "tabular-nums",
					inputMode: "decimal",
					value: String(item.minQty),
					onChange: (e) => {
						const n = Number(e.target.value.replace(",", "."));
						onPatch({ minQty: Number.isFinite(n) ? n : 0 });
					},
					"aria-label": "Seuil mini"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "tabular-nums",
					inputMode: "decimal",
					value: String(item.unitCost),
					onChange: (e) => {
						const n = Number(e.target.value.replace(",", "."));
						onPatch({ unitCost: Number.isFinite(n) ? n : 0 });
					},
					"aria-label": "Coût unitaire"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-3 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { item })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-2 py-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "w-16 tabular-nums",
							inputMode: "decimal",
							value: draft,
							onChange: (e) => onDraft(e.target.value.replace(/[^\d.,]/g, "")),
							"aria-label": "Quantité mouvement"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-sm",
							onClick: onIn,
							"aria-label": "Entrée",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownToLine, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-sm",
							onClick: onOut,
							"aria-label": "Sortie",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpFromLine, {})
						}),
						!locked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon-sm",
							onClick: onRemove,
							"aria-label": "Supprimer",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
						})
					]
				})
			})
		]
	});
}
function StatusBadge({ item }) {
	const s = stockStatus(item);
	if (s === "empty") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: "Rupture"
	});
	if (s === "low") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "warn",
		children: "Sous seuil"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: "good",
		children: "OK"
	});
}
function Num({ label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		className: "mt-1 tabular-nums",
		inputMode: "decimal",
		value: String(value),
		onChange: (e) => {
			const n = Number(e.target.value.replace(",", "."));
			onChange(Number.isFinite(n) ? n : 0);
		}
	})] });
}
var DEFAULT_SETTINGS = {
	...defaultQuoteIdentity(),
	kerf: 3,
	allowRotation: true,
	method: "auto",
	pricePerM2: 40,
	wastePct: 15,
	marginPct: 20,
	surfaceOverrideM2: null,
	laborHours: 0,
	hourlyRate: 45,
	hardwareItems: [{
		id: "hw-empty-1",
		name: "",
		qty: "1",
		unitPrice: ""
	}]
};
function parseRows(rows) {
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		length: Number(String(r.length).replace(",", ".")),
		width: Number(String(r.width).replace(",", ".")),
		qty: Math.floor(Number(String(r.qty).replace(",", ".")))
	})).filter((p) => Number.isFinite(p.length) && Number.isFinite(p.width) && Number.isFinite(p.qty) && p.length > 0 && p.width > 0 && p.qty > 0);
}
function Home() {
	const [rows, setRows] = (0, import_react.useState)(exampleRows);
	const [settings, setSettings] = (0, import_react.useState)(DEFAULT_SETTINGS);
	const [result, setResult] = (0, import_react.useState)(null);
	const [selected, setSelected] = (0, import_react.useState)("mixed");
	const [error, setError] = (0, import_react.useState)(null);
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	const [algoOpen, setAlgoOpen] = (0, import_react.useState)(false);
	const [stock, setStock] = (0, import_react.useState)(exampleStock);
	const [moves, setMoves] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const saved = JSON.parse(raw);
				if (Array.isArray(saved.rows) && saved.rows.length > 0) setRows(saved.rows);
				if (saved.settings) setSettings({
					...DEFAULT_SETTINGS,
					...saved.settings
				});
				if (Array.isArray(saved.stock) && saved.stock.length > 0) setStock(ensurePanelRows(saved.stock));
				if (Array.isArray(saved.moves)) setMoves(saved.moves);
			}
		} catch {}
		setHydrated(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		const defs = parseRows(rows);
		if (defs.length === 0) {
			setResult(null);
			return;
		}
		if (defs.reduce((s, d) => s + d.qty, 0) > 400) {
			setError("Limitez le débit à 400 pièces pour garder le calcul instantané.");
			return;
		}
		setError(null);
		const out = optimizeCutting(defs, {
			kerf: settings.kerf,
			allowRotation: settings.allowRotation,
			method: settings.method
		});
		setResult(out);
		setSelected((prev) => out.strategies.some((s) => s.id === prev) ? prev : out.bestId);
	}, [
		hydrated,
		rows,
		settings.kerf,
		settings.allowRotation,
		settings.method
	]);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			rows,
			settings,
			stock,
			moves
		}));
	}, [
		rows,
		settings,
		stock,
		moves,
		hydrated
	]);
	function calculate() {
		const defs = parseRows(rows);
		if (defs.length === 0) {
			setResult(null);
			setError("Ajoutez au moins une pièce avec longueur, largeur et quantité.");
			return;
		}
		if (defs.reduce((s, d) => s + d.qty, 0) > 400) {
			setError("Limitez le débit à 400 pièces pour garder le calcul instantané.");
			return;
		}
		setError(null);
		const out = optimizeCutting(defs, settings);
		setResult(out);
		setSelected(out.bestId);
	}
	const current = (0, import_react.useMemo)(() => result?.strategies.find((s) => s.id === selected) ?? null, [result, selected]);
	const autoSurfaceM2 = current ? current.usedArea / 1e6 : 0;
	const surfaceM2 = settings.surfaceOverrideM2 ?? autoSurfaceM2;
	const selling = (0, import_react.useMemo)(() => sellingFromInputs(surfaceM2, settings.pricePerM2, settings.wastePct, settings.laborHours, settings.hourlyRate, settings.hardwareItems, settings.marginPct), [
		surfaceM2,
		settings.pricePerM2,
		settings.wastePct,
		settings.laborHours,
		settings.hourlyRate,
		settings.hardwareItems,
		settings.marginPct
	]);
	function generateQuote() {
		document.getElementById("quote-sheet")?.scrollIntoView({
			behavior: "smooth",
			block: "start"
		});
	}
	const jobNeed = current ? jobNeedFromQuote(current.counts, settings.hardwareItems) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "no-print border-b border-border bg-card/80",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Logo, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-xl font-medium tracking-tight",
							children: "Débit Bois"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Panneaux 2500 × 400 mm et 2500 × 600 mm"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									const next = exampleRows();
									setSettings((s) => ({
										...s,
										surfaceOverrideM2: null
									}));
									setRows(next);
									setError(null);
									const out = optimizeCutting(parseRows(next), settings);
									setResult(out);
									setSelected(out.bestId);
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {}), "Exemple"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									const next = exampleQuoteRows();
									const nextSettings = {
										...settings,
										...exampleQuotePatch()
									};
									setSettings(nextSettings);
									setRows(next);
									setError(null);
									const out = optimizeCutting(parseRows(next), nextSettings);
									setResult(out);
									setSelected(out.bestId);
									requestAnimationFrame(() => document.getElementById("quote-sheet")?.scrollIntoView({
										behavior: "smooth",
										block: "start"
									}));
								},
								children: "Exemple devis"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => document.getElementById("stocks")?.scrollIntoView({
									behavior: "smooth",
									block: "start"
								}),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Package, {}), "Stocks"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "outline",
								onClick: () => {
									generateQuote();
									window.print();
								},
								disabled: !result || !selling.ok,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, {}), "Imprimer / PDF"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								onClick: generateQuote,
								disabled: !result || !selling.ok,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {}), "Générer le devis"]
							})
						]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "no-print",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Options de découpe" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
							className: "flex flex-col gap-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsBar, {
								settings,
								onChange: (patch) => setSettings((s) => ({
									...s,
									...patch
								}))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										type: "button",
										size: "lg",
										onClick: calculate,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calculator, {}), "Calculer le débit"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "button",
										variant: "ghost",
										onClick: () => {
											setRows([emptyRow()]);
											setResult(null);
											setError(null);
										},
										children: "Vider la liste"
									}),
									error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-destructive",
										children: error
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "no-print",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PieceList, {
							rows,
							onChange: setRows,
							kerf: settings.kerf,
							allowRotation: settings.allowRotation
						})
					}),
					result && current && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "no-print",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultsPanel, {
							strategies: result.strategies,
							selected,
							bestId: result.bestId,
							onSelect: setSelected,
							pricePerM2: settings.pricePerM2,
							stock
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StockPanel, {
						items: stock,
						moves,
						onItems: setStock,
						onMoves: setMoves,
						need: jobNeed,
						quoteNumber: settings.quoteNumber
					}),
					result && current && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "no-print",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuotePanel, {
								settings,
								onChange: (patch) => setSettings((s) => ({
									...s,
									...patch
								})),
								autoSurfaceM2,
								purchasedAreaMm2: current.purchasedArea,
								onGenerateQuote: generateQuote,
								stock,
								onEnsureStock: (name, unitCost) => setStock((prev) => ensureStockArticle(prev, name, unitCost))
							})
						}),
						selling.ok && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuoteDocument, {
							settings,
							onChange: (patch) => setSettings((s) => ({
								...s,
								...patch
							})),
							selling,
							strategy: current,
							stock
						}),
						current.unplaced.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "no-print rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive",
							children: [
								"Pièces non placées :",
								" ",
								current.unplaced.map((p) => `${p.name} ${p.w}×${p.h}`).join(", "),
								". Vérifiez qu’elles tiennent dans 2500 × 600 mm (trait de scie compris)."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							"aria-labelledby": "plans-title",
							className: "no-print flex flex-col gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap items-end justify-between gap-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									id: "plans-title",
									className: "font-display text-xl font-medium tracking-tight",
									children: "Plans de découpe"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted-foreground",
									children: "La hachure représente la chute. Un ↻ indique une pièce tournée de 90°."
								})] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CuttingPlanList, {
								panels: current.panels,
								kerf: settings.kerf
							})]
						})
					] }),
					!result && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "no-print rounded-xl bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]",
						children: "Saisissez votre débit puis lancez le calcul pour obtenir le nombre de panneaux et les plans de découpe."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "no-print",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex w-full items-center justify-between rounded-xl bg-card px-5 py-4 text-left shadow-[var(--shadow-border)]",
							onClick: () => setAlgoOpen((v) => !v),
							"aria-expanded": algoOpen,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-base font-medium",
								children: "Comment le calepinage est calculé"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: algoOpen ? "size-4 rotate-180 transition-transform duration-150" : "size-4 transition-transform duration-150" })]
						}), algoOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 rounded-xl bg-card px-5 py-4 text-sm leading-relaxed text-ink-soft shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "L’outil compare trois stratégies d’achat : uniquement des panneaux 2500 × 400, uniquement des 2500 × 600, et un mix des deux. Pour chaque stratégie, deux algorithmes de bin packing 2D sont évalués :" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "mt-3 list-disc space-y-2 pl-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Rectangles maximaux (MaxRects)" }), " — on place chaque pièce dans le rectangle libre qui laisse le plus petit reliquat (BSSF, Best Short Side Fit). Bon rendement, plans parfois plus denses."] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Guillotine" }), " — chaque placement fend le panneau par des coupes droites successives. Plus proche d’une découpe à la scie sur table."] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3",
									children: "Le trait de scie gonfle chaque pièce et le panneau de la même valeur : les pièces sont séparées du kerf, sans « faux trait » sur le bord du panneau. La rotation 90° est testée si elle est activée. La stratégie retenue est celle qui minimise la surface achetée, à pièces toutes placées."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3",
									children: "Le prix de vente valorise la surface utile du débit : prix réel au m² = prix fournisseur / (1 − taux de perte), puis on ajoute main d’œuvre (temps × taux) et quincaillerie (somme des articles), et on divise par (1 − marge). Exemple devis : 40 €/m², 2 m², 15 % de perte, 2,5 h à 40 €/h, 30 € de quincaillerie, 30 % de marge → 320,17 € HT. Les stocks atelier rapprochent panneaux et quincaillerie du besoin du chantier, et permettent de déduire les sorties."
								})
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "app-footer no-print mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6",
				children: "Unités en millimètres. Les panneaux d’achat sont fixes : 2500 × 400 mm et 2500 × 600 mm."
			})
		]
	});
}
function Logo() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "40",
		height: "40",
		viewBox: "0 0 40 40",
		"aria-hidden": true,
		className: "shrink-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				width: "40",
				height: "40",
				rx: "10",
				fill: "#2c4a3e"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "7",
				y: "10",
				width: "26",
				height: "6",
				rx: "1.5",
				fill: "#f4f1ea"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "7",
				y: "18",
				width: "26",
				height: "8",
				rx: "1.5",
				fill: "#d4c4a8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "7",
				y: "28",
				width: "16",
				height: "5",
				rx: "1.5",
				fill: "#e7dfd2"
			})
		]
	});
}
//#endregion
export { Home as component };
