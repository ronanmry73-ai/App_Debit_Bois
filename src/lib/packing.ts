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

export type OccupiedRect = { x: number; y: number; w: number; h: number };

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
  /** Rotation déjà résolue pour cette pièce. Absent = options.allowRotation. */
  canRotate?: boolean;
};

export type Item = {
  instanceId: string;
  defId: string;
  name: string;
  w: number;
  h: number;
  allowedSpecIds?: string[] | null;
  canRotate?: boolean;
  familyId?: string | null;
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
  /** Ordre de pose (guillotine = ordre de coupe). */
  cutIndex?: number;
  /** n° affiché, ex. 1.3 */
  code?: string;
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
  source?: "sheet" | "offcut";
  stockItemId?: string;
  familyId?: string;
  familyName?: string;
  /** Chutes verrouillées (ne plus y placer de pièce). */
  lockedRects?: OccupiedRect[];
};

export type OffcutUsage = {
  stockItemId: string;
  name: string;
  length: number;
  width: number;
  qty: number;
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
  offcutsUsed?: OffcutUsage[];
};

export type PackWarning = {
  pieceId: string;
  pieceName: string;
  familyName: string;
  message: string;
};

export type OffcutBin = {
  id: string;
  length: number;
  width: number;
  familyId?: string | null;
  familyName?: string | null;
  name: string;
  qty?: number;
};

export type OptimizeOptions = {
  kerf: number;
  allowRotation: boolean;
  method: PackMethod;
  specs?: PanelSpec[];
  /** Chutes stock à essayer AVANT les feuilles neuves. */
  offcuts?: OffcutBin[];
  /** Zones déjà occupées (verrouillage de chute), mm. */
  occupied?: OccupiedRect[];
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

export const OFFCUT_MIN_SIDE_MM = 300;
export const OFFCUT_MIN_AREA_MM2 = 50_000;

export function isStockableOffcut(w: number, h: number): boolean {
  if (!(w > 0 && h > 0)) return false;
  return Math.min(w, h) >= OFFCUT_MIN_SIDE_MM || w * h >= OFFCUT_MIN_AREA_MM2;
}

export type FreeRect = { x: number; y: number; w: number; h: number };

/** Rectangles restants après pose, en mm sur le bac. */
export function leftoverRects(panel: PackedPanel, kerf: number): FreeRect[] {
  const k = Math.max(0, kerf);
  let free: Rect[] = [
    { x: 0, y: 0, w: panel.length + k, h: panel.width + k },
  ];
  for (const p of panel.placements) {
    free = splitMaxRects(free, {
      x: p.x,
      y: p.y,
      w: p.w + k,
      h: p.h + k,
    });
  }
  const out: FreeRect[] = [];
  for (const r of free) {
    const x = Math.max(0, r.x);
    const y = Math.max(0, r.y);
    const w = Math.min(r.x + r.w, panel.length) - x;
    const h = Math.min(r.y + r.h, panel.width) - y;
    if (w >= 1 && h >= 1) {
      out.push({ x, y, w: Math.round(w), h: Math.round(h) });
    }
  }
  return out;
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w - EPS &&
    a.x + a.w > b.x + EPS &&
    a.y < b.y + b.h - EPS &&
    a.y + a.h > b.y + EPS
  );
}

/** Chutes disjointes assez grandes pour le stock (plus grand d’abord). */
export function stockableLeftovers(panel: PackedPanel, kerf: number): FreeRect[] {
  const locked = panel.lockedRects ?? [];
  const free = leftoverRects(panel, kerf)
    .filter((r) => isStockableOffcut(r.w, r.h))
    .filter((r) => !locked.some((o) => rectsOverlap(r, o)))
    .sort((a, b) => b.w * b.h - a.w * a.h);
  const picked: FreeRect[] = [];
  for (const r of free) {
    if (!picked.some((p) => rectsOverlap(r, p))) picked.push(r);
  }
  return picked;
}

function offcutToSpec(oc: OffcutBin): PanelSpec {
  return {
    id: `offcut:${oc.id}`,
    length: oc.length,
    width: oc.width,
    label: oc.name || `Chute ${oc.length} × ${oc.width} mm`,
    familyId: oc.familyId || "",
    familyName: oc.familyName || "",
    kind: "offcut",
    stockItemId: oc.id,
  };
}

function packOffcutsFirst(
  items: Item[],
  offcuts: OffcutBin[],
  options: OptimizeOptions,
): { panels: PackedPanel[]; remaining: Item[] } {
  const panels: PackedPanel[] = [];
  let remaining = items.slice();
  const bins = offcuts
    .filter((o) => o.length > 0 && o.width > 0 && (o.qty ?? 1) > 0)
    .slice()
    .sort((a, b) => b.length * b.width - a.length * a.width);
  for (const oc of bins) {
    const copies = Math.max(1, Math.floor(oc.qty ?? 1));
    const spec = offcutToSpec(oc);
    for (let n = 0; n < copies; n++) {
      if (remaining.length === 0) break;
      const attempt = packOneBinBest(spec, remaining, options);
      if (attempt.placements.length === 0) break;
      panels.push(toPackedPanel(spec, panels.length + 1, attempt));
      remaining = attempt.remaining;
    }
  }
  return { panels, remaining };
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
        canRotate: def.canRotate,
        familyId: def.familyId,
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

function itemRotates(item: Item, allowRotation: boolean): boolean {
  return item.canRotate ?? allowRotation;
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
  if (itemRotates(item, allowRotation) && item.w !== item.h) {
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
  occupied: OccupiedRect[] = [],
): BinAttempt {
  const binW = spec.length + kerf;
  const binH = spec.width + kerf;
  let free: Rect[] = [{ x: 0, y: 0, w: binW, h: binH }];
  for (const occ of occupied) {
    free = splitMaxRects(free, {
      x: occ.x,
      y: occ.y,
      w: occ.w + kerf,
      h: occ.h + kerf,
    });
  }
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
      cutIndex: placements.length + 1,
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
  const occupied = options.occupied ?? [];
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
          occupied,
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
    source: spec.kind === "offcut" ? "offcut" : "sheet",
    stockItemId: spec.stockItemId,
    familyId: spec.familyId,
    familyName: spec.familyName,
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

function isOffcutPanel(p: PackedPanel): boolean {
  return p.source === "offcut" || p.format.startsWith("offcut:");
}

function offcutUsageOf(panels: PackedPanel[]): OffcutUsage[] {
  const map = new Map<string, OffcutUsage>();
  for (const p of panels) {
    if (!isOffcutPanel(p) || !p.stockItemId) continue;
    const cur = map.get(p.stockItemId);
    if (cur) {
      cur.qty += 1;
    } else {
      map.set(p.stockItemId, {
        stockItemId: p.stockItemId,
        name: p.label,
        length: p.length,
        width: p.width,
        qty: 1,
      });
    }
  }
  return [...map.values()];
}

function tagPanelPlacements(panels: PackedPanel[]): PackedPanel[] {
  return panels.map((p, i) => ({
    ...p,
    index: i + 1,
    id: isOffcutPanel(p)
      ? `offcut-${p.stockItemId ?? p.format}-${i + 1}`
      : `${p.format}-${i + 1}`,
    placements: p.placements.map((pl, j) => ({
      ...pl,
      code: `${i + 1}.${j + 1}`,
    })),
  }));
}

function finishStrategy(
  id: StrategyId,
  label: string,
  panels: PackedPanel[],
  unplaced: Item[],
  specs: PanelSpec[],
): StrategyResult {
  const tagged = tagPanelPlacements(panels);
  const sheets = tagged.filter((p) => !isOffcutPanel(p));
  const counts = emptyCounts(specs);
  for (const p of sheets) {
    counts[p.format] = (counts[p.format] ?? 0) + 1;
  }
  const purchasedArea = sheets.reduce((s, p) => s + p.length * p.width, 0);
  const usedArea = tagged.reduce((s, p) => s + p.usedArea, 0);
  const usedOnSheets = sheets.reduce((s, p) => s + p.usedArea, 0);
  const wastePercent =
    purchasedArea > 0
      ? ((purchasedArea - usedOnSheets) / purchasedArea) * 100
      : 0;
  const methods = new Set(tagged.map((p) => p.method));
  const method: StrategyResult["method"] =
    methods.size === 1 ? [...methods][0]! : "mixte";
  return {
    id,
    label,
    panels: tagged,
    counts,
    purchasedArea,
    usedArea,
    wastePercent,
    unplaced,
    method,
    offcutsUsed: offcutUsageOf(tagged),
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
  const rot = itemRotates(item, options.allowRotation);
  if (!pieceFitsSpec(item.w, item.h, spec, rot, options.kerf)) {
    return false;
  }
  return specs.every((other) => {
    if (other.id === spec.id) return true;
    if (!itemAllowedOn(item, other.id)) return true;
    return !pieceFitsSpec(item.w, item.h, other, rot, options.kerf);
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
  const offcutSpecs = (options.offcuts ?? [])
    .filter((o) => o.length > 0 && o.width > 0 && (o.qty ?? 1) > 0)
    .map(offcutToSpec);

  const prepared: PieceDef[] = defs
    .filter((d) => d.length > 0 && d.width > 0 && d.qty > 0)
    .map((d) => {
      const rot = d.canRotate ?? opts.allowRotation;
      const matchingOffcuts = offcutSpecs.filter((s) => {
        if (d.familyId && s.familyId && d.familyId !== s.familyId) return false;
        return pieceFitsSpec(d.length, d.width, s, rot, kerf);
      });
      if (d.allowedSpecIds && d.allowedSpecIds.length > 0) {
        const ok = d.allowedSpecIds.filter((id) => specs.some((s) => s.id === id));
        if (ok.length === 0 && matchingOffcuts.length === 0) {
          const fam =
            d.familyName ||
            specs.find((s) => s.familyId === d.familyId)?.familyName ||
            "sélectionnée";
          warnings.push(familyWarning(d, fam));
        }
        return {
          ...d,
          allowedSpecIds: [...ok, ...matchingOffcuts.map((s) => s.id)],
        };
      }
      if (d.familyId) {
        const famSpecs = specs.filter((s) => s.familyId === d.familyId);
        const compatible = famSpecs.filter((s) =>
          pieceFitsSpec(d.length, d.width, s, rot, kerf),
        );
        if (compatible.length === 0 && matchingOffcuts.length === 0) {
          const fam = d.familyName || famSpecs[0]?.familyName || "sélectionnée";
          warnings.push(familyWarning(d, fam));
          return { ...d, allowedSpecIds: [] };
        }
        return {
          ...d,
          allowedSpecIds: [
            ...compatible.map((s) => s.id),
            ...matchingOffcuts.map((s) => s.id),
          ],
        };
      }
      if (matchingOffcuts.length > 0) {
        return {
          ...d,
          allowedSpecIds: [
            ...specs.map((s) => s.id),
            ...matchingOffcuts.map((s) => s.id),
          ],
        };
      }
      return { ...d, allowedSpecIds: null };
    });

  const items = explodePieces(prepared);

  const offcutBins = (options.offcuts ?? []).filter(
    (o) => o.length > 0 && o.width > 0 && (o.qty ?? 1) > 0,
  );
  const { panels: offcutPanels, remaining } = packOffcutsFirst(
    items,
    offcutBins,
    opts,
  );

  const allStrategies: StrategyResult[] = specs.map((spec) => {
    const packed = packAllBins(spec, remaining, opts);
    return finishStrategy(
      `all-${spec.id}`,
      `Tout en ${spec.label}`,
      offcutPanels.concat(packed.panels),
      packed.unplaced,
      specs,
    );
  });

  const mixed = packMixedBest(remaining, opts, specs);
  allStrategies.push(
    finishStrategy(
      "mixed",
      "Mixte",
      offcutPanels.concat(mixed.panels),
      mixed.unplaced,
      specs,
    ),
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

export function canSwapOnPanel(
  a: Placement,
  b: Placement,
): { ok: true } | { ok: false; reason: string } {
  const aFitsB = a.w <= b.w + EPS && a.h <= b.h + EPS;
  const bFitsA = b.w <= a.w + EPS && b.h <= a.h + EPS;
  if (aFitsB && bFitsA) return { ok: true };
  return {
    ok: false,
    reason: `${a.name} (${Math.round(a.w)}×${Math.round(a.h)}) et ${b.name} (${Math.round(b.w)}×${Math.round(b.h)}) : les rectangles ne se contiennent pas.`,
  };
}

export function swapOnPanel(
  panel: PackedPanel,
  instanceA: string,
  instanceB: string,
): { ok: true; panel: PackedPanel } | { ok: false; reason: string } {
  const a = panel.placements.find((p) => p.instanceId === instanceA);
  const b = panel.placements.find((p) => p.instanceId === instanceB);
  if (!a || !b) {
    return { ok: false, reason: "Pièces introuvables sur ce panneau." };
  }
  if (a.instanceId === b.instanceId) {
    return { ok: false, reason: "Choisissez deux pièces distinctes." };
  }
  const gate = canSwapOnPanel(a, b);
  if (!gate.ok) return gate;
  const next: PackedPanel = {
    ...panel,
    placements: panel.placements.map((p) => {
      if (p.instanceId === a.instanceId) {
        return { ...p, x: b.x, y: b.y };
      }
      if (p.instanceId === b.instanceId) {
        return { ...p, x: a.x, y: a.y };
      }
      return p;
    }),
  };
  return { ok: true, panel: next };
}

export function placementsToItems(panel: PackedPanel): Item[] {
  return panel.placements.map((p) => ({
    instanceId: p.instanceId,
    defId: p.defId,
    name: p.name,
    w: p.w,
    h: p.h,
    canRotate: false,
    familyId: panel.familyId,
  }));
}

export function panelToSpec(panel: PackedPanel): PanelSpec {
  return {
    id: panel.format,
    length: panel.length,
    width: panel.width,
    label: panel.label,
    familyId: panel.familyId ?? "",
    familyName: panel.familyName ?? "",
    kind: panel.source === "offcut" ? "offcut" : "sheet",
    stockItemId: panel.stockItemId,
  };
}

export function packItemsOnSpec(
  spec: PanelSpec,
  items: Item[],
  options: OptimizeOptions,
): { panel: PackedPanel | null; unplaced: Item[] } {
  const attempt = packOneBinBest(spec, items, options);
  if (attempt.placements.length === 0) {
    return { panel: null, unplaced: items.slice() };
  }
  return {
    panel: toPackedPanel(spec, 1, attempt),
    unplaced: attempt.remaining,
  };
}

export function refreshStrategyMetrics(
  strategy: StrategyResult,
  specs: PanelSpec[],
): StrategyResult {
  return finishStrategy(
    strategy.id,
    strategy.label,
    strategy.panels,
    strategy.unplaced,
    specs,
  );
}

/** Recalcule un panneau en honorant les chutes verrouillées. Surplus → feuilles neuves. */
export function repackLockedPanel(
  panel: PackedPanel,
  options: OptimizeOptions,
): { panel: PackedPanel; extra: PackedPanel[]; unplaced: Item[] } {
  const spec = panelToSpec(panel);
  const items = placementsToItems(panel);
  const occupied = panel.lockedRects ?? options.occupied ?? [];
  const first = packOneBinBest(spec, items, { ...options, occupied });
  const usedArea = first.usedArea;
  const total = spec.length * spec.width;
  const placed: PackedPanel = {
    ...toPackedPanel(spec, panel.index, first),
    id: panel.id,
    index: panel.index,
    source: panel.source,
    stockItemId: panel.stockItemId,
    familyId: panel.familyId,
    familyName: panel.familyName,
    lockedRects: occupied,
    usedArea,
    wasteArea: Math.max(0, total - usedArea),
    wastePercent: total > 0 ? ((total - usedArea) / total) * 100 : 0,
  };
  let remaining = first.remaining;
  const extra: PackedPanel[] = [];
  while (remaining.length > 0) {
    const attempt = packOneBinBest(spec, remaining, {
      ...options,
      occupied: [],
    });
    if (attempt.placements.length === 0) break;
    extra.push(toPackedPanel(spec, extra.length + 1, attempt));
    remaining = attempt.remaining;
  }
  return { panel: placed, extra, unplaced: remaining };
}

