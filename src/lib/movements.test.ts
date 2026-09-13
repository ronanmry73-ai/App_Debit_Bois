import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyJournal,
  classifyBridgeFile,
  isMovementJournal,
  isPersistSnapshot,
  makePendingMove,
  mergePendingMoves,
  moveRefLabel,
  parseMovementJournal,
  pendingDeltaFor,
  PERSIST_AS_JOURNAL_MSG,
  serializeMovementJournal,
  stockRefKey,
} from "./movements.ts";
import { exampleStock, PANEL_A_ID } from "./stock.ts";

test("carnet v1 : parse, round-trip, ignore projet", () => {
  const raw = serializeMovementJournal([
    { id: "m1", at: "2026-09-13T10:00:00.000Z", refId: "A", delta: 5, reason: "Réception" },
  ]);
  const parsed = parseMovementJournal(raw);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.journal.version, 1);
  assert.equal(parsed.journal.items[0]?.delta, 5);
  assert.equal(parsed.journal.items[0]?.refId, "A");
  assert.equal(isMovementJournal({ kind: "debit-bois-project", version: 1, items: [] }), false);
});

test("appliquer +5 sur le panneau A, projets non concernés", () => {
  const start = exampleStock();
  const beforeB = start.find((s) => s.id === "stock-panel-B")?.qty;
  const { stock, applied, skipped } = applyJournal(start, [
    { id: "m1", at: "2026-09-13T10:00:00.000Z", refId: "A", delta: 5, reason: "Réception" },
  ]);
  assert.equal(applied.length, 1);
  assert.equal(skipped.length, 0);
  assert.equal(stock.find((s) => s.id === "stock-panel-A")?.qty, 15);
  assert.equal(stock.find((s) => s.id === "stock-panel-B")?.qty, beforeB);
  assert.equal(start.find((s) => s.id === "stock-panel-A")?.qty, 10);
});

test("P-400 : id réel, sku ou ref A → +5", () => {
  const start = exampleStock();
  const qty = (s: typeof start) => s.find((it) => it.id === PANEL_A_ID)?.qty;
  for (const refId of [PANEL_A_ID, "A", "P-400"]) {
    const { stock, applied } = applyJournal(start, [
      { id: "t1", at: "2026-09-13T20:00:00Z", refId, delta: 5, reason: "réception" },
    ]);
    assert.equal(applied.length, 1, refId);
    assert.equal(qty(stock), 15, refId);
  }
  const viaSku = applyJournal(start, [
    { id: "t2", at: "2026-09-13T20:00:00Z", refId: "inconnu", sku: "P-400", delta: 5, reason: "réception" },
  ]);
  assert.equal(viaSku.applied.length, 1);
  assert.equal(qty(viaSku.stock), 15);
});

test("référence inconnue : skipped, stock intact", () => {
  const start = exampleStock();
  const { stock, skipped } = applyJournal(start, [
    { id: "m1", at: "2026-09-13T10:00:00.000Z", refId: "inconnu", delta: 3, reason: "x" },
  ]);
  assert.equal(skipped.length, 1);
  assert.equal(stock.find((s) => s.id === "stock-panel-A")?.qty, 10);
});

test("delta en attente et clé de référence", () => {
  const item = exampleStock()[0]!;
  const move = makePendingMove(item, 5, "Réception");
  assert.equal(stockRefKey(item), item.refId || item.id);
  assert.equal(move.sku, "P-400");
  assert.equal(pendingDeltaFor([move], stockRefKey(item)), 5);
  assert.equal(pendingDeltaFor([move], "autre"), 0);
  assert.equal(moveRefLabel(exampleStock(), move), "P-400");
});

test("snapshot persist v5 reconnu, carnet v1 non", () => {
  assert.equal(
    isPersistSnapshot({ version: 5, stock: [], catalog: { families: [], refs: [] } }),
    true,
  );
  assert.equal(
    isPersistSnapshot({
      version: 1,
      createdAt: "",
      items: [{ id: "1", at: "", refId: "A", delta: 1, reason: "" }],
    }),
    false,
  );
});

test("Importer le carnet refuse une sauvegarde complète", () => {
  const persist = { version: 5, stock: [], catalog: { families: [], refs: [] } };
  const classified = classifyBridgeFile(persist);
  assert.equal(classified.kind, "persist");
  const parsed = parseMovementJournal(persist);
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.error, PERSIST_AS_JOURNAL_MSG);
});

test("classifyBridgeFile : carnet v1 vs JSON quelconque", () => {
  const journal = classifyBridgeFile({
    version: 1,
    createdAt: "2026-09-13T20:00:00Z",
    items: [{ id: "t1", at: "2026-09-13T20:00:00Z", refId: "A", delta: 5, reason: "réception" }],
  });
  assert.equal(journal.kind, "journal");
  if (journal.kind !== "journal") return;
  assert.equal(journal.journal.items[0]?.delta, 5);
  const bad = classifyBridgeFile({ foo: 1 });
  assert.equal(bad.kind, "invalid");
});

test("fusion du carnet : pas de doublon d’id", () => {
  const a = [{ id: "t1", at: "2026-09-13T20:00:00Z", refId: "A", delta: 5, reason: "a" }];
  const merged = mergePendingMoves(a, [
    { id: "t1", at: "2026-09-13T20:00:00Z", refId: "A", delta: 5, reason: "a" },
    { id: "t2", at: "2026-09-13T21:00:00Z", refId: "A", delta: -1, reason: "b" },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[1]?.id, "t2");
});
