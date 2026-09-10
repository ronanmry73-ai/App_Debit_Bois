/**
 * Optimiseur de débit 2D pour panneaux 2500 × 400 et 2500 × 600 mm.
 *
 * Deux algorithmes sont essayés, puis le meilleur rendement est retenu :
 *
 * 1. Rectangles maximaux (MaxRects, BSSF / BAF / Bottom-Left)
 *    On maintient la liste des rectangles libres (ils peuvent se chevaucher).
 *    Chaque pièce est placée dans le rectangle libre qui laisse le plus petit
 *    « petit côté » résiduel. Les rectangles libres sont ensuite découpés et
 *    les zones contenues dans d’autres sont éliminées. Très bon rendement,
 *    mais le plan peut exiger des coupes non traversantes.
 *
 * 2. Guillotine (First Fit, split sur le plus petit reliquat)
 *    Les zones libres ne se chevauchent jamais : chaque placement fend le
 *    rectangle en deux (coupe en L). Les plans se scient plus simplement
 *    (coupes droites successives), au prix d’un peu plus de chute parfois.
 *
 * Trait de scie (kerf) : chaque pièce et chaque panneau sont gonflés de
 * `kerf` mm. Les pièces se retrouvent donc séparées du trait de scie, et le
 * dernier bord du panneau n’est pas pénalisé d’un trait fantôme
 * (astuce classique : pièce+kerf dans panneau+kerf).
 *
 * Stratégies comparées :
 *  - tout en 2500×400
 *  - tout en 2500×600
 *  - mixte (plusieurs heuristiques, on garde la plus économe en surface achetée)
 */

export type PanelFormat = "A" | "B";

export const PANEL_SPECS: Record<
  PanelFormat,
  { length: number; width: number; label: string }
> = {
  A: { length: 2500, width: 400, label: "2500 × 400 mm" },
  B: { length: 2500, width: 600, label: "2500 × 600 mm" },
};

export type PackMethod = "auto" | "guillotine" | "maxrects";
export type StrategyId = "all-A" | "all-B" | "mixed";

export type PieceDef = {
  id: string;
  name: string;
  length: number;
  width: number;
  qty: number;
};

export type Item = {
  instanceId: string;
  defId: string;
  name: string;
  w: number;
  h: number;
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
  counts: { A: number; B: number };
  purchasedArea: number;
  usedArea: number;
  wastePercent: number;
  unplaced: Item[];
  method: "maxrects" | "guillotine" | "mixte";
};

export type OptimizeOptions = {
  kerf: number;
  allowRotation: boolean;
  method: PackMethod;
};

export type OptimizeOutput = {
  strategies: StrategyResult[];
  bestId: StrategyId;
};

type Rect = { x: number; y: number; w: number; h: number };
type Heuristic = "bssf" | "baf" | "bl";
type SortKey = "area" | "maxside";
type Algo = "maxrects" | "guillotine";

const EPS = 1e-6;

function panelArea(format: PanelFormat): number {
  const s = PANEL_SPECS[format];
  return s.length * s.width;
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
      });
    }
  }
  return items;
}

export function pieceFitsFormat(
  w: number,
  h: number,
  format: PanelFormat,
  allowRotation: boolean,
  kerf: number,
): boolean {
  const spec = PANEL_SPECS[format];
  const binW = spec.length + kerf;
  const binH = spec.width + kerf;
  const iw = w + kerf;
  const ih = h + kerf;
  if (iw <= binW + EPS && ih <= binH + EPS) return true;
  if (allowRotation && ih <= binW + EPS && iw <= binH + EPS) return true;
  return false;
}

export function pieceFitsAnyPanel(
  w: number,
  h: number,
  allowRotation: boolean,
  kerf: number,
): boolean {
  return (
    pieceFitsFormat(w, h, "A", allowRotation, kerf) ||
    pieceFitsFormat(w, h, "B", allowRotation, kerf)
  );
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

/** Découpe MaxRects : jusqu’à 4 reliquats par rectangle libre chevauché. */
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
  format: PanelFormat,
  items: Item[],
  kerf: number,
  allowRotation: boolean,
  algo: Algo,
  heuristic: Heuristic,
  sortKey: SortKey,
): BinAttempt {
  const spec = PANEL_SPECS[format];
  const binW = spec.length + kerf;
  const binH = spec.width + kerf;
  let free: Rect[] = [{ x: 0, y: 0, w: binW, h: binH }];
  const ordered = sortItems(items, sortKey);
  const placements: Placement[] = [];
  const leftover: Item[] = [];

  for (const item of ordered) {
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

/**
 * Guillotine : le rectangle libre choisi est fendu en deux zones
 * non chevauchantes (le L est coupé selon le plus petit reliquat).
 */
function splitGuillotine(freeRects: Rect[], used: Rect): Rect[] {
  const idx = freeRects.findIndex(
    (fr) =>
      Math.abs(fr.x - used.x) < EPS &&
      Math.abs(fr.y - used.y) < EPS &&
      fr.w + EPS >= used.w &&
      fr.h + EPS >= used.h,
  );
  if (idx < 0) {
    // repli : comportement MaxRects si on ne retrouve pas le rectangle source
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
  format: PanelFormat,
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
          format,
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
  format: PanelFormat,
  index: number,
  attempt: BinAttempt,
): PackedPanel {
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
  format: PanelFormat,
  items: Item[],
  options: OptimizeOptions,
): { panels: PackedPanel[]; unplaced: Item[] } {
  const panels: PackedPanel[] = [];
  let remaining = items.slice();
  let guard = 0;
  while (remaining.length > 0 && guard < 500) {
    guard += 1;
    const attempt = packOneBinBest(format, remaining, options);
    if (attempt.placements.length === 0) break;
    panels.push(toPackedPanel(format, panels.length + 1, attempt));
    remaining = attempt.remaining;
  }
  return { panels, unplaced: remaining };
}

function finishStrategy(
  id: StrategyId,
  label: string,
  panels: PackedPanel[],
  unplaced: Item[],
): StrategyResult {
  const counts = {
    A: panels.filter((p) => p.format === "A").length,
    B: panels.filter((p) => p.format === "B").length,
  };
  const purchasedArea = counts.A * panelArea("A") + counts.B * panelArea("B");
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

function onlyFitsB(item: Item, options: OptimizeOptions): boolean {
  return (
    !pieceFitsFormat(item.w, item.h, "A", options.allowRotation, options.kerf) &&
    pieceFitsFormat(item.w, item.h, "B", options.allowRotation, options.kerf)
  );
}

type Prefer = "util" | "A" | "B";

function chooseNextPanel(
  a: BinAttempt,
  b: BinAttempt,
  remaining: Item[],
  options: OptimizeOptions,
  prefer: Prefer,
): { format: PanelFormat; attempt: BinAttempt } | null {
  const aOk = a.placements.length > 0;
  const bOk = b.placements.length > 0;
  if (!aOk && !bOk) return null;
  if (!aOk) return { format: "B", attempt: b };
  if (!bOk) return { format: "A", attempt: a };

  const mustB = remaining.filter((it) => onlyFitsB(it, options));
  if (mustB.length > 0) {
    const mustIds = new Set(mustB.map((it) => it.instanceId));
    const bGetsMust = b.placements.some((p) => mustIds.has(p.instanceId));
    if (bGetsMust) return { format: "B", attempt: b };
  }

  if (prefer === "A") return { format: "A", attempt: a };
  if (prefer === "B") return { format: "B", attempt: b };

  const utilA = a.usedArea / panelArea("A");
  const utilB = b.usedArea / panelArea("B");
  if (Math.abs(utilA - utilB) > 0.02) {
    return utilA > utilB ? { format: "A", attempt: a } : { format: "B", attempt: b };
  }
  // À utilisation proche, on prend le panneau qui pose le plus de surface,
  // puis le plus étroit (moins de matière achetée pour ce coup).
  if (a.usedArea !== b.usedArea) {
    return a.usedArea > b.usedArea
      ? { format: "A", attempt: a }
      : { format: "B", attempt: b };
  }
  return { format: "A", attempt: a };
}

function packMixedGreedy(
  items: Item[],
  options: OptimizeOptions,
  prefer: Prefer,
): { panels: PackedPanel[]; unplaced: Item[] } {
  const panels: PackedPanel[] = [];
  let remaining = items.slice();
  let guard = 0;
  while (remaining.length > 0 && guard < 500) {
    guard += 1;
    const a = packOneBinBest("A", remaining, options);
    const b = packOneBinBest("B", remaining, options);
    const pick = chooseNextPanel(a, b, remaining, options, prefer);
    if (!pick) break;
    const placedIds = new Set(pick.attempt.placements.map((p) => p.instanceId));
    panels.push(toPackedPanel(pick.format, panels.length + 1, pick.attempt));
    remaining = remaining.filter((it) => !placedIds.has(it.instanceId));
  }
  return { panels, unplaced: remaining };
}

function packMustBThen(
  items: Item[],
  options: OptimizeOptions,
  rest: "A" | "B" | "greedy",
): { panels: PackedPanel[]; unplaced: Item[] } {
  const must = items.filter((it) => onlyFitsB(it, options));
  const others = items.filter((it) => !onlyFitsB(it, options));
  // On nourrit d’abord les panneaux B avec les pièces qui n’entrent qu’en 600,
  // en autorisant le remplissage avec d’autres pièces pour limiter la chute.
  const seed = must.concat(others);
  const panels: PackedPanel[] = [];
  let remaining = seed;
  // Tant qu’il reste des pièces « B only », on ouvre un panneau B.
  while (remaining.some((it) => onlyFitsB(it, options))) {
    const attempt = packOneBinBest("B", remaining, options);
    if (attempt.placements.length === 0) break;
    const placedIds = new Set(attempt.placements.map((p) => p.instanceId));
    panels.push(toPackedPanel("B", panels.length + 1, attempt));
    remaining = remaining.filter((it) => !placedIds.has(it.instanceId));
  }
  if (remaining.length === 0) return { panels, unplaced: [] };
  const restPack =
    rest === "A" || rest === "B"
      ? packAllBins(rest, remaining, options)
      : packMixedGreedy(remaining, options, "util");
  const merged = reindexPanels(panels.concat(restPack.panels));
  return { panels: merged, unplaced: restPack.unplaced };
}

function packMixedBest(
  items: Item[],
  options: OptimizeOptions,
): { panels: PackedPanel[]; unplaced: Item[] } {
  const variants = [
    packMixedGreedy(items, options, "util"),
    packMixedGreedy(items, options, "A"),
    packMixedGreedy(items, options, "B"),
    packMustBThen(items, options, "greedy"),
    packMustBThen(items, options, "A"),
    packMustBThen(items, options, "B"),
  ];
  const scored = variants.map((v, i) =>
    finishStrategy("mixed", `mixte-${i}`, v.panels, v.unplaced),
  );
  const best = pickCheapest(scored);
  const idx = scored.indexOf(best);
  return variants[idx]!;
}

function scoreStrategy(result: StrategyResult): number {
  // Plus petit = meilleur. Pénalité lourde si des pièces restent dehors.
  return result.purchasedArea + result.unplaced.length * 1e12 + result.wastePercent;
}

export function optimizeCutting(
  defs: PieceDef[],
  options: OptimizeOptions,
): OptimizeOutput {
  const kerf = Math.max(0, options.kerf);
  const opts: OptimizeOptions = { ...options, kerf };
  const items = explodePieces(
    defs.filter((d) => d.length > 0 && d.width > 0 && d.qty > 0),
  );

  const allA = packAllBins("A", items, opts);
  const allB = packAllBins("B", items, opts);
  const mixed = packMixedBest(items, opts);

  const strategies: StrategyResult[] = [
    finishStrategy("all-A", "Tout en 2500 × 400", allA.panels, allA.unplaced),
    finishStrategy("all-B", "Tout en 2500 × 600", allB.panels, allB.unplaced),
    finishStrategy("mixed", "Mixte 400 + 600", mixed.panels, mixed.unplaced),
  ];

  let best = strategies[0]!;
  for (const s of strategies.slice(1)) {
    if (scoreStrategy(s) < scoreStrategy(best)) best = s;
  }

  return { strategies, bestId: best.id };
}

/** Vérifie qu’un plan n’a pas de chevauchement ni de débordement. */
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
