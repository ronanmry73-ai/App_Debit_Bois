/**
 * Optimiseur de débit 2D.
 *
 * Les formats de panneaux ne sont plus figés : on reçoit la liste des
 * références actives (par défaut 2500×400 et 2500×600, ids A et B).
 *
 * Deux algorithmes sont essayés, puis le meilleur rendement est retenu :
 *
 * 1. Rectangles maximaux (MaxRects, BSSF / BAF / Bottom-Left)
 * 2. Guillotine (First Fit, split sur le plus petit reliquat)
 *
 * Trait de scie (kerf) : pièce+kerf dans panneau+kerf.
 *
 * Stratégies comparées :
 *  - tout dans une référence donnée
 *  - mixte (plusieurs heuristiques, on garde la plus économe en surface)
 */

import type { PanelSpec } from "./catalog.ts";

export type { PanelSpec };

export type PanelFormat = string;

export const DEFAULT_SPECS: PanelSpec[] = [
  {
    id: "A",
    length: 2500,
    width: 400,
    label: "2500 × 400 mm",
    familyId: "fam-standard",
    familyName: "Standard",
  },
  {
    id: "B",
    length: 2500,
    width: 600,
    label: "2500 × 600 mm",
    familyId: "fam-standard",
    familyName: "Standard",
  },
];

/** @deprecated Utiliser DEFAULT_SPECS — conservé pour les appels internes A/B. */
export const PANEL_SPECS: Record<
  "A" | "B",
  { length: number; width: number; label: string }
> = {
  A: { length: 2500, width: 400, label: "2500 × 400 mm" },
  B: { length: 2500, width: 600, label: "2500 × 600 mm" },
};

export type PackMethod = "auto" | "guillotine" | "maxrects";
export type StrategyId = string;

export type PieceDef = {
  id: string;
  name: string;
  length: number;
  width: number;
  qty: number;
  familyId?: string | null;
  familyName?: string | null;
  allowedSpecIds?: string[] | null;
};

export type Item = {
  instanceId: string;
  defId: string;
  name: string;
  w: number;
  h: number;
  allowedSpecIds?: string[] | null;
};

export type Placement = {
  instanceId: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
};

export type PackedPanel = {
  id: string;
  index: number;
  format: PanelFormat;
  length: number;
  width: number;
  label: string;
  placements: Placement[];
  usedArea: number;
  wasteArea: number;
  wastePercent: number;
  method: "maxrects" | "guillotine";
};

export type StrategyResult = {
  id: StrategyId;
  label: string;
  panels: PackedPanel[];
  counts: Record<string, number>;
  purchasedArea: number;
  usedArea: number;
  wastePercent: number;
  unplaced: Item[];
  method: "maxrects" | "guillotine" | "mixte";
};

export type PackWarning = {
  pieceId: string;
  pieceName: string;
  familyName: string;
  message: string;
};

export type OptimizeOptions = {
  kerf: number;
  allowRotation: boolean;
  method: PackMethod;
  specs?: PanelSpec[];
};

export type OptimizeOutput = {
  strategies: StrategyResult[];
  bestId: StrategyId;
  warnings: PackWarning[];
};

type Rect = { x: number; y: number; w: number; h: number };
type Heuristic = "bssf" | "baf" | "bl";
type SortKey = "area" | "maxside";
type Algo = "maxrects" | "guillotine";

const EPS = 1e-6;

function resolveSpecs(options: OptimizeOptions): PanelSpec[] {
  const specs = options.specs?.filter((s) => s.length > 0 && s.width > 0);
  return specs && specs.length > 0 ? specs : DEFAULT_SPECS;
}

function specOf(specs: PanelSpec[], id: string): PanelSpec {
  return specs.find((s) => s.id === id) ?? specs[0]!;
}

function panelArea(spec: PanelSpec): number {
  return spec.length * spec.width;
}

export function explodePieces(defs: PieceDef[]): Item[] {
  const items: Item[] = [];
  for (const def of defs) {
    const qty = Math.max(0, Math.floor(def.qty));
    for (let i = 0; i < qty; i++) {
      items.push({
        instanceId: `${def.id}#${i + 1}`,
        defId: def.id,
        name: def.name.trim() || "Pièce",
        w: def.length,
        h: def.width,
        allowedSpecIds: def.allowedSpecIds,
      });
    }
  }
  return items;
}

export function pieceFitsSpec(
  w: number,
  h: number,
  spec: { length: number; width: number },
  allowRotation: boolean,
  kerf: number,
): boolean {
  const binW = spec.length + kerf;
  const binH = spec.width + kerf;
  const iw = w + kerf;
  const ih = h + kerf;
  if (iw <= binW + EPS && ih <= binH + EPS) return true;
  if (allowRotation && ih <= binW + EPS && iw <= binH + EPS) return true;
  return false;
}

export function pieceFitsFormat(
  w: number,
  h: number,
  format: PanelFormat,
  allowRotation: boolean,
  kerf: number,
  specs: PanelSpec[] = DEFAULT_SPECS,
): boolean {
  const spec = specOf(specs, format);
  return pieceFitsSpec(w, h, spec, allowRotation, kerf);
}

export function pieceFitsAnyPanel(
  w: number,
  h: number,
  allowRotation: boolean,
  kerf: number,
  specs: PanelSpec[] = DEFAULT_SPECS,
): boolean {
  return specs.some((s) => pieceFitsSpec(w, h, s, allowRotation, kerf));
}

/** `null` / `undefined` = toutes les refs ; `[]` = aucune (pas de repli silencieux). */
function itemAllowedOn(item: Item, specId: string): boolean {
  if (item.allowedSpecIds == null) return true;
  return item.allowedSpecIds.includes(specId);
}

function sortItems(items: Item[], key: SortKey): Item[] {
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

function containsRect(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + EPS &&
    a.y <= b.y + EPS &&
    a.x + a.w >= b.x + b.w - EPS &&
    a.y + a.h >= b.y + b.h - EPS
  );
}

function pruneContained(rects: Rect[]): Rect[] {
  const out: Rect[] = [];
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

function splitMaxRects(freeRects: Rect[], used: Rect): Rect[] {
  const result: Rect[] = [];
  for (const fr of freeRects) {
    const overlapX = used.x < fr.x + fr.w - EPS && used.x + used.w > fr.x + EPS;
    const overlapY = used.y < fr.y + fr.h - EPS && used.y + used.h > fr.y + EPS;
    if (!overlapX || !overlapY) {
      result.push(fr);
      continue;
    }
    if (used.y > fr.y + EPS && used.y < fr.y + fr.h - EPS) {
      result.push({ x: fr.x, y: fr.y, w: fr.w, h: used.y - fr.y });
    }
    if (used.y + used.h < fr.y + fr.h - EPS) {
      result.push({
        x: fr.x,
        y: used.y + used.h,
        w: fr.w,
        h: fr.y + fr.h - (used.y + used.h),
      });
    }
    if (used.x > fr.x + EPS && used.x < fr.x + fr.w - EPS) {
      result.push({ x: fr.x, y: fr.y, w: used.x - fr.x, h: fr.h });
    }
    if (used.x + used.w < fr.x + fr.w - EPS) {
      result.push({
        x: used.x + used.w,
        y: fr.y,
        w: fr.x + fr.w - (used.x + used.w),
        h: fr.h,
      });
    }
  }
  return pruneContained(result);
}

type Candidate = {
  x: number;
  y: number;
  w: number;
  h: number;
  iw: number;
  ih: number;
  rotated: boolean;
  item: Item;
  scoreA: number;
  scoreB: number;
};

function scorePlacement(
  fr: Rect,
  iw: number,
  ih: number,
  heuristic: Heuristic,
): { a: number; b: number } | null {
  if (iw > fr.w + EPS || ih > fr.h + EPS) return null;
  const leftW = fr.w - iw;
  const leftH = fr.h - ih;
  if (heuristic === "bssf") {
    return { a: Math.min(leftW, leftH), b: Math.max(leftW, leftH) };
  }
  if (heuristic === "baf") {
    return { a: fr.w * fr.h - iw * ih, b: Math.min(leftW, leftH) };
  }
  return { a: fr.y, b: fr.x };
}

function betterScore(a: Candidate, b: Candidate): boolean {
  if (a.scoreA !== b.scoreA) return a.scoreA < b.scoreA;
  return a.scoreB < b.scoreB;
}

function collectCandidates(
  freeRects: Rect[],
  item: Item,
  allowRotation: boolean,
  kerf: number,
  heuristic: Heuristic,
): Candidate[] {
  const out: Candidate[] = [];
  const orientations: { w: number; h: number; rotated: boolean }[] = [
    { w: item.w, h: item.h, rotated: false },
  ];
  if (allowRotation && item.w !== item.h) {
    orientations.push({ w: item.h, h: item.w, rotated: true });
  }
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
        scoreB: sc.b,
      });
    }
  }
  return out;
}

function pickBestCandidate(cands: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const c of cands) {
    if (!best || betterScore(c, best)) best = c;
  }
  return best;
}

type BinAttempt = {
  placements: Placement[];
  remaining: Item[];
  method: Algo;
  usedArea: number;
};

function packOneBin(
  spec: PanelSpec,
  items: Item[],
  kerf: number,
  allowRotation: boolean,
  algo: Algo,
  heuristic: Heuristic,
  sortKey: SortKey,
): BinAttempt {
  const binW = spec.length + kerf;
  const binH = spec.width + kerf;
  let free: Rect[] = [{ x: 0, y: 0, w: binW, h: binH }];
  const ordered = sortItems(items, sortKey);
  const placements: Placement[] = [];
  const leftover: Item[] = [];

  for (const item of ordered) {
    if (!itemAllowedOn(item, spec.id)) {
      leftover.push(item);
      continue;
    }
    const cands = collectCandidates(free, item, allowRotation, kerf, heuristic);
    const best = pickBestCandidate(cands);
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
      rotated: best.rotated,
    });
    const used: Rect = { x: best.x, y: best.y, w: best.iw, h: best.ih };
    if (algo === "maxrects") {
      free = splitMaxRects(free, used);
    } else {
      free = splitGuillotine(free, used);
    }
  }

  const usedArea = placements.reduce((s, p) => s + p.w * p.h, 0);
  return { placements, remaining: leftover, method: algo, usedArea };
}

function splitGuillotine(freeRects: Rect[], used: Rect): Rect[] {
  const idx = freeRects.findIndex(
    (fr) =>
      Math.abs(fr.x - used.x) < EPS &&
      Math.abs(fr.y - used.y) < EPS &&
      fr.w + EPS >= used.w &&
      fr.h + EPS >= used.h,
  );
  if (idx < 0) {
    return splitMaxRects(freeRects, used);
  }
  const fr = freeRects[idx];
  const leftoverW = fr.w - used.w;
  const leftoverH = fr.h - used.h;
  const next = freeRects.filter((_, i) => i !== idx);
  if (leftoverW <= leftoverH) {
    if (leftoverW > EPS) {
      next.push({ x: fr.x + used.w, y: fr.y, w: leftoverW, h: used.h });
    }
    if (leftoverH > EPS) {
      next.push({ x: fr.x, y: fr.y + used.h, w: fr.w, h: leftoverH });
    }
  } else {
    if (leftoverH > EPS) {
      next.push({ x: fr.x, y: fr.y + used.h, w: used.w, h: leftoverH });
    }
    if (leftoverW > EPS) {
      next.push({ x: fr.x + used.w, y: fr.y, w: leftoverW, h: fr.h });
    }
  }
  return next.filter((r) => r.w > EPS && r.h > EPS);
}

function betterBin(a: BinAttempt, b: BinAttempt | null): boolean {
  if (!b) return true;
  if (a.usedArea !== b.usedArea) return a.usedArea > b.usedArea;
  if (a.placements.length !== b.placements.length) {
    return a.placements.length > b.placements.length;
  }
  return false;
}

function algosFor(method: PackMethod): Algo[] {
  if (method === "guillotine") return ["guillotine"];
  if (method === "maxrects") return ["maxrects"];
  return ["maxrects", "guillotine"];
}

function packOneBinBest(
  spec: PanelSpec,
  items: Item[],
  options: OptimizeOptions,
): BinAttempt {
  const algos = algosFor(options.method);
  const heuristics: Heuristic[] =
    options.method === "guillotine" ? ["bssf"] : ["bssf", "baf", "bl"];
  const sorts: SortKey[] = ["area", "maxside"];
  let best: BinAttempt | null = null;
  for (const algo of algos) {
    const hs = algo === "guillotine" ? (["bssf"] as Heuristic[]) : heuristics;
    for (const heuristic of hs) {
      for (const sortKey of sorts) {
        const attempt = packOneBin(
          spec,
          items,
          options.kerf,
          options.allowRotation,
          algo,
          heuristic,
          sortKey,
        );
        if (betterBin(attempt, best)) best = attempt;
      }
    }
  }
  return best ?? {
    placements: [],
    remaining: items.slice(),
    method: "maxrects",
    usedArea: 0,
  };
}

function toPackedPanel(
  spec: PanelSpec,
  index: number,
  attempt: BinAttempt,
): PackedPanel {
  const usedArea = attempt.usedArea;
  const total = spec.length * spec.width;
  const wasteArea = Math.max(0, total - usedArea);
  return {
    id: `${spec.id}-${index}`,
    index,
    format: spec.id,
    length: spec.length,
    width: spec.width,
    label: spec.label,
    placements: attempt.placements,
    usedArea,
    wasteArea,
    wastePercent: total > 0 ? (wasteArea / total) * 100 : 0,
    method: attempt.method,
  };
}

function reindexPanels(panels: PackedPanel[]): PackedPanel[] {
  return panels.map((p, i) => ({
    ...p,
    index: i + 1,
    id: `${p.format}-${i + 1}`,
  }));
}

function packAllBins(
  spec: PanelSpec,
  items: Item[],
  options: OptimizeOptions,
): { panels: PackedPanel[]; unplaced: Item[] } {
  const panels: PackedPanel[] = [];
  let remaining = items.slice();
  let guard = 0;
  while (remaining.length > 0 && guard < 500) {
    guard += 1;
    const attempt = packOneBinBest(spec, remaining, options);
    if (attempt.placements.length === 0) break;
    panels.push(toPackedPanel(spec, panels.length + 1, attempt));
    remaining = attempt.remaining;
  }
  return { panels, unplaced: remaining };
}

function emptyCounts(specs: PanelSpec[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of specs) counts[s.id] = 0;
  return counts;
}

function finishStrategy(
  id: StrategyId,
  label: string,
  panels: PackedPanel[],
  unplaced: Item[],
  specs: PanelSpec[],
): StrategyResult {
  const counts = emptyCounts(specs);
  for (const p of panels) {
    counts[p.format] = (counts[p.format] ?? 0) + 1;
  }
  const purchasedArea = panels.reduce(
    (s, p) => s + p.length * p.width,
    0,
  );
  const usedArea = panels.reduce((s, p) => s + p.usedArea, 0);
  const wastePercent =
    purchasedArea > 0 ? ((purchasedArea - usedArea) / purchasedArea) * 100 : 0;
  const methods = new Set(panels.map((p) => p.method));
  const method: StrategyResult["method"] =
    methods.size === 1 ? [...methods][0]! : "mixte";
  return {
    id,
    label,
    panels,
    counts,
    purchasedArea,
    usedArea,
    wastePercent,
    unplaced,
    method,
  };
}

function cheaper(a: StrategyResult, b: StrategyResult): boolean {
  if (a.unplaced.length !== b.unplaced.length) {
    return a.unplaced.length < b.unplaced.length;
  }
  if (a.purchasedArea !== b.purchasedArea) {
    return a.purchasedArea < b.purchasedArea;
  }
  if (a.wastePercent !== b.wastePercent) return a.wastePercent < b.wastePercent;
  return a.panels.length < b.panels.length;
}

function pickCheapest(results: StrategyResult[]): StrategyResult {
  let best = results[0]!;
  for (const r of results.slice(1)) {
    if (cheaper(r, best)) best = r;
  }
  return best;
}

function onlyFitsSpec(
  item: Item,
  spec: PanelSpec,
  specs: PanelSpec[],
  options: OptimizeOptions,
): boolean {
  if (!itemAllowedOn(item, spec.id)) return false;
  if (!pieceFitsSpec(item.w, item.h, spec, options.allowRotation, options.kerf)) {
    return false;
  }
  return specs.every((other) => {
    if (other.id === spec.id) return true;
    if (!itemAllowedOn(item, other.id)) return true;
    return !pieceFitsSpec(
      item.w,
      item.h,
      other,
      options.allowRotation,
      options.kerf,
    );
  });
}

function chooseNextPanel(
  attempts: { spec: PanelSpec; attempt: BinAttempt }[],
  remaining: Item[],
  options: OptimizeOptions,
  specs: PanelSpec[],
  preferId?: string,
): { spec: PanelSpec; attempt: BinAttempt } | null {
  const ok = attempts.filter((a) => a.attempt.placements.length > 0);
  if (ok.length === 0) return null;

  for (const cand of ok) {
    const must = remaining.filter((it) =>
      onlyFitsSpec(it, cand.spec, specs, options),
    );
    if (must.length === 0) continue;
    const mustIds = new Set(must.map((it) => it.instanceId));
    if (cand.attempt.placements.some((p) => mustIds.has(p.instanceId))) {
      return cand;
    }
  }

  if (preferId) {
    const pref = ok.find((a) => a.spec.id === preferId);
    if (pref) return pref;
  }

  let best = ok[0]!;
  let bestUtil = best.attempt.usedArea / panelArea(best.spec);
  for (const cand of ok.slice(1)) {
    const util = cand.attempt.usedArea / panelArea(cand.spec);
    if (util > bestUtil + 0.02) {
      best = cand;
      bestUtil = util;
    } else if (Math.abs(util - bestUtil) <= 0.02) {
      if (cand.attempt.usedArea > best.attempt.usedArea) {
        best = cand;
        bestUtil = util;
      } else if (
        cand.attempt.usedArea === best.attempt.usedArea &&
        panelArea(cand.spec) < panelArea(best.spec)
      ) {
        best = cand;
        bestUtil = util;
      }
    }
  }
  return best;
}

function packMixedGreedy(
  items: Item[],
  options: OptimizeOptions,
  specs: PanelSpec[],
  preferId?: string,
): { panels: PackedPanel[]; unplaced: Item[] } {
  const panels: PackedPanel[] = [];
  let remaining = items.slice();
  let guard = 0;
  while (remaining.length > 0 && guard < 500) {
    guard += 1;
    const attempts = specs.map((spec) => ({
      spec,
      attempt: packOneBinBest(spec, remaining, options),
    }));
    const pick = chooseNextPanel(attempts, remaining, options, specs, preferId);
    if (!pick) break;
    const placedIds = new Set(pick.attempt.placements.map((p) => p.instanceId));
    panels.push(toPackedPanel(pick.spec, panels.length + 1, pick.attempt));
    remaining = remaining.filter((it) => !placedIds.has(it.instanceId));
  }
  return { panels, unplaced: remaining };
}

function packMustThen(
  items: Item[],
  options: OptimizeOptions,
  specs: PanelSpec[],
  exclusiveSpec: PanelSpec,
  rest: "greedy" | string,
): { panels: PackedPanel[]; unplaced: Item[] } {
  const panels: PackedPanel[] = [];
  let remaining = items.slice();
  while (remaining.some((it) => onlyFitsSpec(it, exclusiveSpec, specs, options))) {
    const attempt = packOneBinBest(exclusiveSpec, remaining, options);
    if (attempt.placements.length === 0) break;
    const placedIds = new Set(attempt.placements.map((p) => p.instanceId));
    panels.push(toPackedPanel(exclusiveSpec, panels.length + 1, attempt));
    remaining = remaining.filter((it) => !placedIds.has(it.instanceId));
  }
  if (remaining.length === 0) return { panels, unplaced: [] };
  const restPack =
    rest === "greedy"
      ? packMixedGreedy(remaining, options, specs)
      : packAllBins(specOf(specs, rest), remaining, options);
  return {
    panels: reindexPanels(panels.concat(restPack.panels)),
    unplaced: restPack.unplaced,
  };
}

function packMixedBest(
  items: Item[],
  options: OptimizeOptions,
  specs: PanelSpec[],
): { panels: PackedPanel[]; unplaced: Item[] } {
  const variants: { panels: PackedPanel[]; unplaced: Item[] }[] = [
    packMixedGreedy(items, options, specs),
    ...specs.map((s) => packMixedGreedy(items, options, specs, s.id)),
  ];
  const pairRest = specs.length <= 3;
  for (const spec of specs) {
    variants.push(packMustThen(items, options, specs, spec, "greedy"));
    if (!pairRest) continue;
    for (const other of specs) {
      if (other.id === spec.id) continue;
      variants.push(packMustThen(items, options, specs, spec, other.id));
    }
  }
  const scored = variants.map((v, i) =>
    finishStrategy("mixed", `mixte-${i}`, v.panels, v.unplaced, specs),
  );
  const best = pickCheapest(scored);
  const idx = scored.indexOf(best);
  return variants[idx]!;
}

function scoreStrategy(result: StrategyResult): number {
  return result.purchasedArea + result.unplaced.length * 1e12 + result.wastePercent;
}

function familyWarning(
  def: PieceDef,
  familyName: string,
): PackWarning {
  const name = def.name.trim() || "Pièce";
  return {
    pieceId: def.id,
    pieceName: name,
    familyName,
    message: `Aucun panneau actif compatible n’a été trouvé dans la famille ${familyName} pour la pièce ${name}. Veuillez ajouter une référence compatible ou choisir une autre famille.`,
  };
}

export function optimizeCutting(
  defs: PieceDef[],
  options: OptimizeOptions,
): OptimizeOutput {
  const kerf = Math.max(0, options.kerf);
  const specs = resolveSpecs(options);
  const opts: OptimizeOptions = { ...options, kerf, specs };
  const warnings: PackWarning[] = [];

  const prepared: PieceDef[] = defs
    .filter((d) => d.length > 0 && d.width > 0 && d.qty > 0)
    .map((d) => {
      if (d.allowedSpecIds && d.allowedSpecIds.length > 0) {
        const ok = d.allowedSpecIds.filter((id) => specs.some((s) => s.id === id));
        if (ok.length === 0) {
          const fam =
            d.familyName ||
            specs.find((s) => s.familyId === d.familyId)?.familyName ||
            "sélectionnée";
          warnings.push(familyWarning(d, fam));
        }
        return { ...d, allowedSpecIds: ok.length > 0 ? ok : [] };
      }
      if (d.familyId) {
        const famSpecs = specs.filter((s) => s.familyId === d.familyId);
        const compatible = famSpecs.filter((s) =>
          pieceFitsSpec(d.length, d.width, s, opts.allowRotation, kerf),
        );
        if (compatible.length === 0) {
          const fam = d.familyName || famSpecs[0]?.familyName || "sélectionnée";
          warnings.push(familyWarning(d, fam));
          return { ...d, allowedSpecIds: [] };
        }
        return { ...d, allowedSpecIds: compatible.map((s) => s.id) };
      }
      return { ...d, allowedSpecIds: null };
    });

  const items = explodePieces(prepared);

  const allStrategies: StrategyResult[] = specs.map((spec) => {
    const packed = packAllBins(spec, items, opts);
    return finishStrategy(
      `all-${spec.id}`,
      `Tout en ${spec.label}`,
      packed.panels,
      packed.unplaced,
      specs,
    );
  });

  const mixed = packMixedBest(items, opts, specs);
  allStrategies.push(
    finishStrategy("mixed", "Mixte", mixed.panels, mixed.unplaced, specs),
  );

  let best = allStrategies[0]!;
  for (const s of allStrategies.slice(1)) {
    if (scoreStrategy(s) < scoreStrategy(best)) best = s;
  }

  return { strategies: allStrategies, bestId: best.id, warnings };
}

export function assertValidLayout(panel: PackedPanel, kerf: number): string[] {
  const errors: string[] = [];
  const inflated = panel.placements.map((p) => ({
    ...p,
    w: p.w + kerf,
    h: p.h + kerf,
  }));
  const binW = panel.length + kerf;
  const binH = panel.width + kerf;
  for (const p of inflated) {
    if (p.x < -EPS || p.y < -EPS || p.x + p.w > binW + EPS || p.y + p.h > binH + EPS) {
      errors.push(`${p.name} déborde (${p.x},${p.y} ${p.w}×${p.h})`);
    }
  }
  for (let i = 0; i < inflated.length; i++) {
    for (let j = i + 1; j < inflated.length; j++) {
      const a = inflated[i]!;
      const b = inflated[j]!;
      const overlap =
        a.x < b.x + b.w - EPS &&
        a.x + a.w > b.x + EPS &&
        a.y < b.y + b.h - EPS &&
        a.y + a.h > b.y + EPS;
      if (overlap) errors.push(`${a.name} chevauche ${b.name}`);
    }
  }
  return errors;
}
