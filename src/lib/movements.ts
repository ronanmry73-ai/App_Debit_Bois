/**
 * Journal de mouvements Terrain → PC.
 * Le téléphone n’applique pas le stock atelier : il accumule des deltas.
 * Le PC rejoue le carnet sur stock[] ; les projets restent intacts.
 */

import { applyDelta, findStockForSpec, type StockItem, type StockMove } from "./stock.ts";
import { newId } from "./utils.ts";

export type PendingMove = {
  id: string;
  at: string;
  refId: string;
  delta: number;
  reason: string;
};

export type MovementJournal = {
  version: 1;
  createdAt: string;
  items: PendingMove[];
};

export function stockRefKey(item: Pick<StockItem, "id" | "refId">): string {
  const ref = typeof item.refId === "string" ? item.refId.trim() : "";
  return ref || item.id;
}

export function parsePendingMoves(raw: unknown): PendingMove[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingMove[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const delta = Number(o.delta);
    const refId = typeof o.refId === "string" ? o.refId.trim() : "";
    if (!refId || !Number.isFinite(delta) || delta === 0) continue;
    out.push({
      id: typeof o.id === "string" && o.id.trim() ? o.id : newId(),
      at: typeof o.at === "string" && o.at.trim() ? o.at : new Date().toISOString(),
      refId,
      delta,
      reason: typeof o.reason === "string" ? o.reason.trim() : "",
    });
  }
  return out;
}

export function isMovementJournal(raw: unknown): raw is MovementJournal {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || !Array.isArray(o.items)) return false;
  if (o.kind === "debit-bois-project") return false;
  return o.items.every((row) => {
    if (!row || typeof row !== "object") return false;
    const it = row as Record<string, unknown>;
    return typeof it.refId === "string" && Number.isFinite(Number(it.delta));
  });
}

export function parseMovementJournal(
  raw: string | unknown,
): { ok: true; journal: MovementJournal } | { ok: false; error: string } {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Le fichier n’est pas un JSON valide." };
    }
  }
  if (!isMovementJournal(data)) {
    return { ok: false, error: "Ce fichier n’est pas un carnet de mouvements." };
  }
  const items = parsePendingMoves(data.items);
  return {
    ok: true,
    journal: {
      version: 1,
      createdAt:
        typeof data.createdAt === "string" && data.createdAt
          ? data.createdAt
          : new Date().toISOString(),
      items,
    },
  };
}

export function serializeMovementJournal(
  items: PendingMove[],
  createdAt = new Date().toISOString(),
): string {
  const journal: MovementJournal = {
    version: 1,
    createdAt,
    items: parsePendingMoves(items),
  };
  return JSON.stringify(journal, null, 2);
}

export function isPersistSnapshot(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (o.kind === "debit-bois-project") return false;
  if (isMovementJournal(o)) return false;
  return (
    o.version === 5 &&
    Array.isArray(o.stock) &&
    !!o.catalog &&
    typeof o.catalog === "object"
  );
}

export function pendingDeltaFor(
  items: PendingMove[],
  refId: string,
): number {
  return items.reduce((s, m) => (m.refId === refId ? s + m.delta : s), 0);
}

export function findStockForRef(
  stock: StockItem[],
  refId: string,
): StockItem | undefined {
  const exactRef = stock.find((it) => it.refId === refId && it.kind !== "offcut");
  if (exactRef) return exactRef;
  const byId = stock.find((it) => it.id === refId);
  if (byId) return byId;
  return findStockForSpec(stock, refId);
}

export function applyJournal(
  stock: StockItem[],
  items: PendingMove[],
): {
  stock: StockItem[];
  applied: PendingMove[];
  skipped: PendingMove[];
} {
  let next = stock;
  const applied: PendingMove[] = [];
  const skipped: PendingMove[] = [];
  for (const move of items) {
    const target = findStockForRef(next, move.refId);
    if (!target || !Number.isFinite(move.delta) || move.delta === 0) {
      skipped.push(move);
      continue;
    }
    next = applyDelta(next, target.id, move.delta);
    applied.push(move);
  }
  return { stock: next, applied, skipped };
}

export function movesFromJournal(
  existing: StockMove[],
  stock: StockItem[],
  items: PendingMove[],
): StockMove[] {
  const extra: StockMove[] = [];
  for (const move of items) {
    const target = findStockForRef(stock, move.refId);
    extra.push({
      id: move.id,
      itemId: target?.id ?? move.refId,
      date: move.at,
      type: move.delta >= 0 ? "in" : "out",
      qty: Math.abs(move.delta),
      note: move.reason || "Terrain",
      quoteNumber: "",
    });
  }
  return [...extra, ...existing].slice(0, 120);
}

export function makePendingMove(
  item: Pick<StockItem, "id" | "refId">,
  delta: number,
  reason: string,
): PendingMove {
  return {
    id: newId(),
    at: new Date().toISOString(),
    refId: stockRefKey(item),
    delta,
    reason: reason.trim() || (delta >= 0 ? "Réception chantier" : "Sortie chantier"),
  };
}
