/**
 * Journal de mouvements Terrain → PC.
 * Le téléphone n’applique pas le stock atelier : il accumule des deltas.
 * Le PC rejoue le carnet sur stock[] ; les projets restent intacts.
 */

import {
  applyDelta,
  findByName,
  findStockForSpec,
  type StockItem,
  type StockMove,
} from "./stock.ts";
import { newId } from "./utils.ts";

export type PendingMove = {
  id: string;
  at: string;
  refId: string;
  sku?: string;
  delta: number;
  reason: string;
};

export type MovementJournal = {
  version: 1;
  createdAt: string;
  items: PendingMove[];
};

export const PERSIST_AS_JOURNAL_MSG =
  "Ce fichier est une sauvegarde complète — utilise Importer.";

export const PENDING_JOURNAL_NAME = "mouvements-pending.json";

export const PENDING_JOURNAL_HINT =
  "Enregistre ce fichier dans le dossier Sauvegarde Débit Bois ERP, en remplacement de mouvements-pending.json. Ne l’écrase pas tant que l’atelier n’a pas appliqué le précédent.";

export const APPLIED_IDS_KEEP = 500;

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
    const sku = typeof o.sku === "string" ? o.sku.trim() : "";
    const refId = typeof o.refId === "string" ? o.refId.trim() : "";
    const key = refId || sku;
    if (!key || !Number.isFinite(delta) || delta === 0) continue;
    const move: PendingMove = {
      id: typeof o.id === "string" && o.id.trim() ? o.id : newId(),
      at: typeof o.at === "string" && o.at.trim() ? o.at : new Date().toISOString(),
      refId: key,
      delta,
      reason: typeof o.reason === "string" ? o.reason.trim() : "",
    };
    if (sku) move.sku = sku;
    out.push(move);
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
    const ref =
      (typeof it.refId === "string" && it.refId.trim()) ||
      (typeof it.sku === "string" && it.sku.trim());
    return !!ref && Number.isFinite(Number(it.delta));
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
  if (isPersistSnapshot(data)) {
    return { ok: false, error: PERSIST_AS_JOURNAL_MSG };
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
  return (
    o.version === 5 &&
    Array.isArray(o.stock) &&
    !!o.catalog &&
    typeof o.catalog === "object"
  );
}

export type BridgeFile =
  | { kind: "journal"; journal: MovementJournal }
  | { kind: "persist" }
  | { kind: "invalid"; error: string };

export function classifyBridgeFile(raw: unknown): BridgeFile {
  if (isPersistSnapshot(raw)) return { kind: "persist" };
  const parsed = parseMovementJournal(raw);
  if (parsed.ok) return { kind: "journal", journal: parsed.journal };
  return { kind: "invalid", error: parsed.error };
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
  sku?: string,
): StockItem | undefined {
  const key = refId.trim();
  const skuKey = (sku ?? "").trim();
  if (!key && !skuKey) return undefined;
  const needle = key || skuKey;
  const exactRef = stock.find((it) => it.refId === needle && it.kind !== "offcut");
  if (exactRef) return exactRef;
  const byId = stock.find((it) => it.id === needle);
  if (byId) return byId;
  const bySku = stock.find(
    (it) =>
      it.kind !== "offcut" &&
      !!it.sku &&
      (it.sku === needle || (skuKey !== "" && it.sku === skuKey)),
  );
  if (bySku) return bySku;
  const byName =
    findByName(stock, needle) ?? (skuKey ? findByName(stock, skuKey) : undefined);
  if (byName) return byName;
  return findStockForSpec(stock, needle);
}

export function moveRefLabel(stock: StockItem[], move: PendingMove): string {
  const item = findStockForRef(stock, move.refId, move.sku);
  return item?.sku || item?.name || move.sku || move.refId;
}

export function mergePendingMoves(
  current: PendingMove[],
  incoming: PendingMove[],
): PendingMove[] {
  const seen = new Set(current.map((m) => m.id));
  const extra = incoming.filter((m) => !seen.has(m.id));
  return extra.length === 0 ? current : [...current, ...extra];
}

export function parseAppliedMoveIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== "string") continue;
    const key = id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.length > APPLIED_IDS_KEEP ? out.slice(-APPLIED_IDS_KEEP) : out;
}

export function filterUnapplied(
  items: PendingMove[],
  appliedIds: readonly string[],
): PendingMove[] {
  if (items.length === 0) return items;
  const seen = new Set(appliedIds);
  return items.filter((m) => !seen.has(m.id));
}

export function mergeAppliedIds(
  current: readonly string[],
  ids: readonly string[],
): string[] {
  return parseAppliedMoveIds([...current, ...ids]);
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
    const target = findStockForRef(next, move.refId, move.sku);
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
    const target = findStockForRef(stock, move.refId, move.sku);
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
  item: Pick<StockItem, "id" | "refId" | "sku">,
  delta: number,
  reason: string,
): PendingMove {
  const move: PendingMove = {
    id: newId(),
    at: new Date().toISOString(),
    refId: stockRefKey(item),
    delta,
    reason: reason.trim() || (delta >= 0 ? "Réception chantier" : "Sortie chantier"),
  };
  const sku = typeof item.sku === "string" ? item.sku.trim() : "";
  if (sku) move.sku = sku;
  return move;
}
