/**
 * Stocks atelier : global, indépendant des projets.
 * Persisté en localStorage / fichier Electron, rapproché du calepinage.
 */

import type { HardwareItem } from "./types.ts";
import type { Catalog, PanelRef, PanelSpec } from "./catalog.ts";
import { familyById } from "./catalog.ts";
import { hardwareLines, parseAmount } from "./pricing.ts";
import { panelAreaM2 } from "./supplier.ts";
import { newId } from "./utils.ts";
import type { OffcutBin, StrategyResult } from "./packing.ts";

export const PANEL_A_ID = "stock-panel-A";
export const PANEL_B_ID = "stock-panel-B";
export const PLACEHOLDER_STOCK_DATE = "2024-01-01T00:00:00.000Z";

export type StockKind = "panel-A" | "panel-B" | "hardware" | "other" | "offcut";

export type StockItem = {
  id: string;
  kind: StockKind;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitCost: number;
  minQty: number;
  refId?: string;
  familyId?: string;
  length?: number;
  width?: number;
  notes?: string;
  updatedAt?: string;
  /** Chute vivante (utilisable par le solveur). Défaut true. */
  usable?: boolean;
  sourceProjectId?: string;
  sourceProjectName?: string;
  sourcePanelIndex?: number;
};

export type StockMoveType = "in" | "out" | "adjust";

export type StockMove = {
  id: string;
  itemId: string;
  date: string;
  type: StockMoveType;
  qty: number;
  note: string;
  quoteNumber: string;
  projectId?: string;
  projectName?: string;
};

export type JobNeed = {
  panelsA: number;
  panelsB: number;
  panels?: { specId: string; name: string; qty: number }[];
  hardware: { name: string; qty: number }[];
  offcuts?: {
    stockItemId: string;
    name: string;
    qty: number;
    length: number;
    width: number;
  }[];
};

export type NeedLine = {
  key: string;
  itemId: string | null;
  name: string;
  needed: number;
  onHand: number;
  gap: number;
  specId?: string;
  familyName?: string;
  areaM2?: number;
  kind?: "panel" | "offcut" | "hardware";
};

export type StockStatus = "ok" | "low" | "empty";

export type DeductionPlanLine = {
  itemId: string | null;
  specId?: string;
  familyName: string;
  name: string;
  needed: number;
  onHand: number;
  afterFull: number;
  afterPartial: number;
  gap: number;
  areaM2: number;
  kind: "panel" | "offcut" | "hardware";
};

export type StockDeductionLine = {
  itemId: string;
  specId?: string;
  familyName?: string;
  name: string;
  qty: number;
  areaM2: number;
  before: number;
  after: number;
};

export type StockDeduction = {
  id: string;
  date: string;
  quoteNumber: string;
  projectId: string;
  projectName: string;
  partial: boolean;
  lines: StockDeductionLine[];
};

export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function stockStatus(item: StockItem): StockStatus {
  if (item.qty <= 0) return "empty";
  if (item.qty < item.minQty) return "low";
  return "ok";
}

export function stockValue(items: StockItem[]): number {
  return items.reduce((s, it) => s + Math.max(0, it.qty) * Math.max(0, it.unitCost), 0);
}

/** Articles sans coût unitaire : exclus de la valeur, à marquer à l’écran. */
export function unpricedStockCount(items: StockItem[]): number {
  return items.filter((it) => !(it.unitCost > 0)).length;
}

export function stockValuePriced(items: StockItem[]): number {
  return items
    .filter((it) => it.unitCost > 0)
    .reduce((s, it) => s + Math.max(0, it.qty) * it.unitCost, 0);
}

export function isPlaceholderDate(iso?: string): boolean {
  if (!iso || !iso.trim()) return true;
  if (iso === PLACEHOLDER_STOCK_DATE) return true;
  if (iso.startsWith("1970-01-01")) return true;
  const t = Date.parse(iso);
  return !Number.isFinite(t) || t <= 0;
}

export function stockSurfaceM2(item: StockItem): number {
  if (item.length && item.width) {
    return panelAreaM2(item.length, item.width, item.qty);
  }
  return 0;
}

export function findPanel(items: StockItem[], format: "A" | "B"): StockItem | undefined {
  const id = format === "A" ? PANEL_A_ID : PANEL_B_ID;
  return items.find((it) => it.id === id || it.kind === (format === "A" ? "panel-A" : "panel-B"));
}

export function findByName(items: StockItem[], name: string): StockItem | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  return items.find((it) => normalizeName(it.name) === n);
}

export function findStockForSpec(items: StockItem[], specId: string): StockItem | undefined {
  if (specId === "A") return findPanel(items, "A");
  if (specId === "B") return findPanel(items, "B");
  return (
    items.find((it) => it.id === specId || it.refId === specId) ??
    items.find((it) => it.id === stockIdForSpecId(specId))
  );
}

export function jobNeedFromQuote(
  counts: { A?: number; B?: number } & Record<string, number>,
  hardware: HardwareItem[],
  specLabels?: Record<string, string>,
): JobNeed {
  const panelsA = Math.max(0, counts.A ?? 0);
  const panelsB = Math.max(0, counts.B ?? 0);
  const panels: JobNeed["panels"] = [];
  for (const [specId, qty] of Object.entries(counts)) {
    if (qty <= 0) continue;
    const fallback =
      specId === "A"
        ? "Panneau 2500 × 400 mm"
        : specId === "B"
          ? "Panneau 2500 × 600 mm"
          : `Panneau ${specId}`;
    panels.push({
      specId,
      name: specLabels?.[specId] ?? fallback,
      qty,
    });
  }
  if (panels.length === 0) {
    if (panelsA > 0) {
      panels.push({ specId: "A", name: "Panneau 2500 × 400 mm", qty: panelsA });
    }
    if (panelsB > 0) {
      panels.push({ specId: "B", name: "Panneau 2500 × 600 mm", qty: panelsB });
    }
  }
  return {
    panelsA,
    panelsB,
    panels,
    hardware: hardwareLines(hardware)
      .filter((l) => l.qty > 0 && l.name)
      .map((l) => ({ name: l.name, qty: l.qty })),
  };
}

export function jobNeedFromStrategy(
  strategy: StrategyResult,
  hardware: HardwareItem[],
  specLabels?: Record<string, string>,
): JobNeed {
  const base = jobNeedFromQuote(strategy.counts, hardware, specLabels);
  return {
    ...base,
    offcuts: (strategy.offcutsUsed ?? []).map((o) => ({
      stockItemId: o.stockItemId,
      name: o.name,
      qty: o.qty,
      length: o.length,
      width: o.width,
    })),
  };
}

export function emptyOffcutItem(input?: Partial<StockItem>): StockItem {
  return {
    id: input?.id ?? newId(),
    kind: "offcut",
    name: input?.name ?? "Chute",
    sku: input?.sku ?? "",
    qty: input?.qty ?? 1,
    unit: "pièce",
    unitCost: input?.unitCost ?? 0,
    minQty: 0,
    familyId: input?.familyId,
    length: input?.length ?? 0,
    width: input?.width ?? 0,
    notes: input?.notes ?? "",
    updatedAt: new Date().toISOString(),
    usable: input?.usable !== false,
    sourceProjectId: input?.sourceProjectId,
    sourceProjectName: input?.sourceProjectName,
    sourcePanelIndex: input?.sourcePanelIndex,
    refId: input?.refId,
  };
}

export function offcutBinsFromStock(
  items: StockItem[],
  exceptProjectId?: string | null,
): OffcutBin[] {
  const bins: OffcutBin[] = [];
  for (const it of items) {
    if (it.kind !== "offcut") continue;
    if (it.usable === false) continue;
    if (!(it.qty > 0)) continue;
    if (!(it.length && it.length > 0 && it.width && it.width > 0)) continue;
    if (exceptProjectId && it.sourceProjectId === exceptProjectId) continue;
    bins.push({
      id: it.id,
      length: it.length,
      width: it.width,
      familyId: it.familyId ?? null,
      familyName: null,
      name: it.name,
      qty: it.qty,
    });
  }
  return bins;
}

export function nameOffcut(
  projectName: string,
  panelIndex: number,
  length: number,
  width: number,
): string {
  const proj = projectName.trim() || "Sans titre";
  return `Chute ${proj} · P${panelIndex} · ${Math.round(length)}×${Math.round(width)}`;
}

export function coverage(
  items: StockItem[],
  need: JobNeed,
  specs: PanelSpec[] = [],
  catalog?: Catalog,
): NeedLine[] {
  const lines: NeedLine[] = [];
  const a = findPanel(items, "A");
  const b = findPanel(items, "B");
  if (need.panelsA > 0 || a) {
    const spec = specs.find((s) => s.id === "A");
    lines.push({
      key: "panel-A",
      itemId: a?.id ?? null,
      name: a?.name ?? "Panneau 2500 × 400 mm",
      needed: need.panelsA,
      onHand: a?.qty ?? 0,
      gap: Math.max(0, need.panelsA - (a?.qty ?? 0)),
      specId: "A",
      familyName: spec?.familyName ?? familyLabel(catalog, a?.familyId),
      areaM2: panelAreaM2(spec?.length ?? a?.length ?? 2500, spec?.width ?? a?.width ?? 400, need.panelsA),
      kind: "panel",
    });
  }
  if (need.panelsB > 0 || b) {
    const spec = specs.find((s) => s.id === "B");
    lines.push({
      key: "panel-B",
      itemId: b?.id ?? null,
      name: b?.name ?? "Panneau 2500 × 600 mm",
      needed: need.panelsB,
      onHand: b?.qty ?? 0,
      gap: Math.max(0, need.panelsB - (b?.qty ?? 0)),
      specId: "B",
      familyName: spec?.familyName ?? familyLabel(catalog, b?.familyId),
      areaM2: panelAreaM2(spec?.length ?? b?.length ?? 2500, spec?.width ?? b?.width ?? 600, need.panelsB),
      kind: "panel",
    });
  }
  for (const p of need.panels ?? []) {
    if (p.specId === "A" || p.specId === "B") continue;
    const found = findStockForSpec(items, p.specId) ?? findByName(items, p.name);
    const spec = specs.find((s) => s.id === p.specId);
    lines.push({
      key: `panel-${p.specId}`,
      itemId: found?.id ?? null,
      name: p.name,
      needed: p.qty,
      onHand: found?.qty ?? 0,
      gap: Math.max(0, p.qty - (found?.qty ?? 0)),
      specId: p.specId,
      familyName: spec?.familyName ?? familyLabel(catalog, found?.familyId),
      areaM2: panelAreaM2(spec?.length ?? found?.length ?? 0, spec?.width ?? found?.width ?? 0, p.qty),
      kind: "panel",
    });
  }
  for (const o of need.offcuts ?? []) {
    const found = items.find((it) => it.id === o.stockItemId);
    lines.push({
      key: `offcut-${o.stockItemId}`,
      itemId: found?.id ?? o.stockItemId,
      name: o.name,
      needed: o.qty,
      onHand: found?.qty ?? 0,
      gap: Math.max(0, o.qty - (found?.qty ?? 0)),
      specId: `offcut:${o.stockItemId}`,
      familyName: familyLabel(catalog, found?.familyId),
      areaM2: panelAreaM2(o.length, o.width, o.qty),
      kind: "offcut",
    });
  }
  for (const h of need.hardware) {
    const found = findByName(items, h.name);
    lines.push({
      key: `hw-${normalizeName(h.name)}`,
      itemId: found?.id ?? null,
      name: h.name,
      needed: h.qty,
      onHand: found?.qty ?? 0,
      gap: Math.max(0, h.qty - (found?.qty ?? 0)),
      familyName: "",
      areaM2: 0,
      kind: "hardware",
    });
  }
  return lines;
}

function familyLabel(catalog: Catalog | undefined, familyId?: string): string {
  if (!catalog || !familyId) return "";
  return familyById(catalog, familyId)?.name ?? "";
}

export function hasShortage(lines: NeedLine[]): boolean {
  return lines.some((l) => l.needed > 0 && l.gap > 0);
}

/** Articles à commander = écart besoin − stock (gap > 0). */
export function toOrder(lines: NeedLine[]): { name: string; qty: number }[] {
  return lines
    .filter((l) => l.gap > 0 && l.needed > 0)
    .map((l) => ({ name: l.name, qty: l.gap }));
}

export function planDeduction(
  items: StockItem[],
  need: JobNeed,
  specs: PanelSpec[] = [],
  catalog?: Catalog,
): DeductionPlanLine[] {
  return coverage(items, need, specs, catalog)
    .filter((l) => l.needed > 0)
    .map((l) => ({
      itemId: l.itemId,
      specId: l.specId,
      familyName: l.familyName ?? "",
      name: l.name,
      needed: l.needed,
      onHand: l.onHand,
      afterFull: Math.max(0, l.onHand - l.needed),
      afterPartial: Math.max(0, l.onHand - Math.min(l.needed, l.onHand)),
      gap: l.gap,
      areaM2: l.areaM2 ?? 0,
      kind: l.kind ?? (l.specId ? "panel" : "hardware"),
    }));
}

export function emptyStockItem(): StockItem {
  return {
    id: newId(),
    kind: "hardware",
    name: "",
    sku: "",
    qty: 0,
    unit: "pièce",
    unitCost: 0,
    minQty: 0,
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

export function applyDelta(
  items: StockItem[],
  itemId: string,
  delta: number,
): StockItem[] {
  const t = new Date().toISOString();
  return items.map((it) =>
    it.id === itemId
      ? { ...it, qty: Math.max(0, roundQty(it.qty + delta)), updatedAt: t }
      : it,
  );
}

export function recordMove(
  moves: StockMove[],
  itemId: string,
  type: StockMoveType,
  qty: number,
  note: string,
  quoteNumber = "",
  meta?: { projectId?: string; projectName?: string },
): StockMove[] {
  const move: StockMove = {
    id: newId(),
    itemId,
    date: new Date().toISOString(),
    type,
    qty: roundQty(qty),
    note,
    quoteNumber,
    projectId: meta?.projectId,
    projectName: meta?.projectName,
  };
  return [move, ...moves].slice(0, 120);
}

export function consumeForJob(
  items: StockItem[],
  moves: StockMove[],
  need: JobNeed,
  quoteNumber: string,
  partial: boolean,
  ctx?: {
    projectId?: string;
    projectName?: string;
    specs?: PanelSpec[];
    catalog?: Catalog;
  },
): {
  items: StockItem[];
  moves: StockMove[];
  ok: boolean;
  lines: NeedLine[];
  deduction?: StockDeduction;
} {
  const lines = coverage(items, need, ctx?.specs, ctx?.catalog).filter((l) => l.needed > 0);
  if (!partial && hasShortage(lines)) {
    return { items, moves, ok: false, lines };
  }
  let nextItems = items;
  let nextMoves = moves;
  const taken: StockDeductionLine[] = [];
  const meta = {
    projectId: ctx?.projectId,
    projectName: ctx?.projectName,
  };
  for (const line of lines) {
    if (!line.itemId) continue;
    const current = nextItems.find((it) => it.id === line.itemId);
    const before = current?.qty ?? 0;
    const take = partial ? Math.min(line.needed, before) : line.needed;
    if (take <= 0) continue;
    nextItems = applyDelta(nextItems, line.itemId, -take);
    const after = nextItems.find((it) => it.id === line.itemId)?.qty ?? 0;
    nextMoves = recordMove(
      nextMoves,
      line.itemId,
      "out",
      take,
      `Chantier ${quoteNumber || ctx?.projectName || "sans n°"}`.trim(),
      quoteNumber,
      meta,
    );
    taken.push({
      itemId: line.itemId,
      specId: line.specId,
      familyName: line.familyName,
      name: line.name,
      qty: take,
      areaM2: line.areaM2 ? (line.areaM2 * take) / line.needed : 0,
      before,
      after,
    });
  }
  const deduction: StockDeduction | undefined =
    taken.length > 0
      ? {
          id: newId(),
          date: new Date().toISOString(),
          quoteNumber,
          projectId: ctx?.projectId ?? "",
          projectName: ctx?.projectName ?? "",
          partial,
          lines: taken,
        }
      : undefined;
  return {
    items: nextItems,
    moves: nextMoves,
    ok: true,
    lines: coverage(nextItems, need, ctx?.specs, ctx?.catalog),
    deduction,
  };
}

export function restoreDeduction(
  items: StockItem[],
  moves: StockMove[],
  deduction: StockDeduction,
): { items: StockItem[]; moves: StockMove[]; ok: boolean; error?: string } {
  if (!deduction?.lines?.length) {
    return { items, moves, ok: false, error: "Aucune déduction à annuler." };
  }
  let nextItems = items;
  let nextMoves = moves;
  for (const line of deduction.lines) {
    if (!line.itemId || line.qty <= 0) continue;
    if (!nextItems.some((it) => it.id === line.itemId)) {
      nextItems = [
        ...nextItems,
        {
          ...emptyStockItem(),
          id: line.itemId,
          name: line.name,
          qty: 0,
          kind:
            line.specId === "A"
              ? "panel-A"
              : line.specId === "B"
                ? "panel-B"
                : line.specId?.startsWith("offcut:")
                  ? "offcut"
                  : "other",
          refId: line.specId,
        },
      ];
    }
    nextItems = applyDelta(nextItems, line.itemId, line.qty);
    nextMoves = recordMove(
      nextMoves,
      line.itemId,
      "in",
      line.qty,
      `Annulation déduction ${deduction.quoteNumber || deduction.projectName || ""}`.trim(),
      deduction.quoteNumber,
      { projectId: deduction.projectId, projectName: deduction.projectName },
    );
  }
  return { items: nextItems, moves: nextMoves, ok: true };
}

export function ensureStockArticle(
  items: StockItem[],
  name: string,
  unitCost = 0,
): StockItem[] {
  const trimmed = name.trim();
  if (!trimmed) return items;
  if (findByName(items, trimmed)) return items;
  return [
    ...items,
    {
      ...emptyStockItem(),
      name: trimmed,
      unitCost: Math.max(0, unitCost),
      qty: 0,
      minQty: 0,
      kind: "hardware",
    },
  ];
}

export function exampleStock(): StockItem[] {
  const t = PLACEHOLDER_STOCK_DATE;
  return [
    {
      id: PANEL_A_ID,
      kind: "panel-A",
      name: "Panneau 2500 × 400 mm",
      sku: "P-400",
      qty: 10,
      unit: "pièce",
      unitCost: 40,
      minQty: 4,
      refId: "A",
      familyId: "fam-standard",
      length: 2500,
      width: 400,
      notes: "",
      updatedAt: t,
    },
    {
      id: PANEL_B_ID,
      kind: "panel-B",
      name: "Panneau 2500 × 600 mm",
      sku: "P-600",
      qty: 6,
      unit: "pièce",
      unitCost: 60,
      minQty: 2,
      refId: "B",
      familyId: "fam-standard",
      length: 2500,
      width: 600,
      notes: "",
      updatedAt: t,
    },
    {
      id: "stock-hw-1",
      kind: "hardware",
      name: "Charnières invisibles",
      sku: "CH-INV",
      qty: 16,
      unit: "pièce",
      unitCost: 4.5,
      minQty: 8,
      notes: "",
      updatedAt: t,
    },
    {
      id: "stock-hw-2",
      kind: "hardware",
      name: "Poignées inox",
      sku: "PO-INOX",
      qty: 8,
      unit: "pièce",
      unitCost: 6,
      minQty: 4,
      notes: "",
      updatedAt: t,
    },
    {
      id: "stock-hw-3",
      kind: "hardware",
      name: "Vis à bois 4×40",
      sku: "VIS-440",
      qty: 250,
      unit: "pièce",
      unitCost: 0.04,
      minQty: 100,
      notes: "",
      updatedAt: t,
    },
  ];
}

export function ensurePanelRows(items: StockItem[]): StockItem[] {
  const seed = exampleStock().filter(
    (it) => it.kind === "panel-A" || it.kind === "panel-B",
  );
  let next = items;
  for (const row of seed) {
    if (!findPanel(next, row.kind === "panel-A" ? "A" : "B")) {
      next = [row, ...next];
    }
  }
  return next;
}

export function stockIdForRef(ref: PanelRef): string {
  return stockIdForSpecId(ref.id);
}

export function stockIdForSpecId(specId: string): string {
  if (specId === "A") return PANEL_A_ID;
  if (specId === "B") return PANEL_B_ID;
  return specId;
}

export function syncStockWithCatalog(
  items: StockItem[],
  catalog: Catalog,
): StockItem[] {
  let next = ensurePanelRows(items);
  for (const ref of catalog.refs) {
    const id = stockIdForRef(ref);
    const existing = next.find((it) => it.id === id || it.refId === ref.id);
    if (existing) {
      next = next.map((it) =>
        it.id === existing.id
          ? {
              ...it,
              refId: ref.id,
              familyId: ref.familyId,
              length: ref.length,
              width: ref.width,
              sku: it.sku || ref.name,
            }
          : it,
      );
      continue;
    }
    next = [
      ...next,
      {
        id,
        kind: ref.id === "A" ? "panel-A" : ref.id === "B" ? "panel-B" : "other",
        name: `Panneau ${ref.length} × ${ref.width} mm`,
        sku: ref.name,
        qty: 0,
        unit: "pièce",
        unitCost: 0,
        minQty: 0,
        refId: ref.id,
        familyId: ref.familyId,
        length: ref.length,
        width: ref.width,
        notes: "",
        updatedAt: new Date().toISOString(),
      },
    ];
  }
  return next;
}

export function migrateStockItems(raw: unknown): StockItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return exampleStock();
  return (raw as StockItem[]).map((it) => ({
    ...it,
    notes: it.notes ?? "",
    updatedAt: it.updatedAt ?? "",
    usable: it.kind === "offcut" ? it.usable !== false : it.usable,
  }));
}

function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}

export { parseAmount };
