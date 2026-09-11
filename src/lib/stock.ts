/**
 * Stocks atelier : panneaux 400/600 et quincaillerie.
 * Persisté en localStorage, rapproché du calepinage et du devis.
 *
 * Exemple (stock d’exemple + devis 2×A, 4 charnières, 2 poignées) :
 *   besoin 2 / stock 10 → couvert, à commander 0
 *   déduction chantier → A 10→8, charnières 16→12
 *   si besoin B = 99 et stock B = 6 → manque 93, à commander
 */

import type { HardwareItem } from "./types.ts";
import type { Catalog, PanelRef } from "./catalog.ts";
import { hardwareLines, parseAmount } from "./pricing.ts";
import { newId } from "./utils.ts";

export const PANEL_A_ID = "stock-panel-A";
export const PANEL_B_ID = "stock-panel-B";

export type StockKind = "panel-A" | "panel-B" | "hardware" | "other";

export type StockItem = {
  id: string;
  kind: StockKind;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitCost: number;
  minQty: number;
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
};

export type JobNeed = {
  panelsA: number;
  panelsB: number;
  panels?: { specId: string; name: string; qty: number }[];
  hardware: { name: string; qty: number }[];
};

export type NeedLine = {
  key: string;
  itemId: string | null;
  name: string;
  needed: number;
  onHand: number;
  gap: number;
};

export type StockStatus = "ok" | "low" | "empty";

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

export function findPanel(items: StockItem[], format: "A" | "B"): StockItem | undefined {
  const id = format === "A" ? PANEL_A_ID : PANEL_B_ID;
  return items.find((it) => it.id === id || it.kind === (format === "A" ? "panel-A" : "panel-B"));
}

export function findByName(items: StockItem[], name: string): StockItem | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  return items.find((it) => normalizeName(it.name) === n);
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

export function coverage(items: StockItem[], need: JobNeed): NeedLine[] {
  const lines: NeedLine[] = [];
  const a = findPanel(items, "A");
  const b = findPanel(items, "B");
  if (need.panelsA > 0 || a) {
    lines.push({
      key: "panel-A",
      itemId: a?.id ?? null,
      name: a?.name ?? "Panneau 2500 × 400 mm",
      needed: need.panelsA,
      onHand: a?.qty ?? 0,
      gap: Math.max(0, need.panelsA - (a?.qty ?? 0)),
    });
  }
  if (need.panelsB > 0 || b) {
    lines.push({
      key: "panel-B",
      itemId: b?.id ?? null,
      name: b?.name ?? "Panneau 2500 × 600 mm",
      needed: need.panelsB,
      onHand: b?.qty ?? 0,
      gap: Math.max(0, need.panelsB - (b?.qty ?? 0)),
    });
  }
  for (const p of need.panels ?? []) {
    if (p.specId === "A" || p.specId === "B") continue;
    const found =
      items.find((it) => it.id === p.specId) ?? findByName(items, p.name);
    lines.push({
      key: `panel-${p.specId}`,
      itemId: found?.id ?? null,
      name: p.name,
      needed: p.qty,
      onHand: found?.qty ?? 0,
      gap: Math.max(0, p.qty - (found?.qty ?? 0)),
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
    });
  }
  return lines;
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
  };
}

export function applyDelta(
  items: StockItem[],
  itemId: string,
  delta: number,
): StockItem[] {
  return items.map((it) =>
    it.id === itemId ? { ...it, qty: Math.max(0, roundQty(it.qty + delta)) } : it,
  );
}

export function recordMove(
  moves: StockMove[],
  itemId: string,
  type: StockMoveType,
  qty: number,
  note: string,
  quoteNumber = "",
): StockMove[] {
  const move: StockMove = {
    id: newId(),
    itemId,
    date: new Date().toISOString(),
    type,
    qty: roundQty(qty),
    note,
    quoteNumber,
  };
  return [move, ...moves].slice(0, 80);
}

export function consumeForJob(
  items: StockItem[],
  moves: StockMove[],
  need: JobNeed,
  quoteNumber: string,
  partial: boolean,
): { items: StockItem[]; moves: StockMove[]; ok: boolean; lines: NeedLine[] } {
  const lines = coverage(items, need).filter((l) => l.needed > 0);
  if (!partial && hasShortage(lines)) {
    return { items, moves, ok: false, lines };
  }
  let nextItems = items;
  let nextMoves = moves;
  for (const line of lines) {
    if (!line.itemId) continue;
    const take = partial ? Math.min(line.needed, line.onHand) : line.needed;
    if (take <= 0) continue;
    nextItems = applyDelta(nextItems, line.itemId, -take);
    nextMoves = recordMove(
      nextMoves,
      line.itemId,
      "out",
      take,
      `Chantier ${quoteNumber || "sans n°"}`.trim(),
      quoteNumber,
    );
  }
  return { items: nextItems, moves: nextMoves, ok: true, lines: coverage(nextItems, need) };
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
  if (ref.id === "A") return PANEL_A_ID;
  if (ref.id === "B") return PANEL_B_ID;
  return ref.id;
}

export function syncStockWithCatalog(
  items: StockItem[],
  catalog: Catalog,
): StockItem[] {
  let next = ensurePanelRows(items);
  for (const ref of catalog.refs) {
    const id = stockIdForRef(ref);
    if (next.some((it) => it.id === id)) continue;
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
      },
    ];
  }
  return next;
}

function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}

export { parseAmount };
