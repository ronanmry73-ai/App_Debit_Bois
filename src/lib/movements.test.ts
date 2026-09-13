import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyJournal,
  isMovementJournal,
  isPersistSnapshot,
  makePendingMove,
  parseMovementJournal,
  pendingDeltaFor,
  serializeMovementJournal,
  stockRefKey,
} from "./movements.ts";
import { exampleStock } from "./stock.ts";

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
  assert.equal(pendingDeltaFor([move], stockRefKey(item)), 5);
  assert.equal(pendingDeltaFor([move], "autre"), 0);
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
