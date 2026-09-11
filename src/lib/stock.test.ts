import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consumeForJob,
  coverage,
  ensureStockArticle,
  exampleStock,
  hasShortage,
  isPlaceholderDate,
  jobNeedFromQuote,
  PLACEHOLDER_STOCK_DATE,
  restoreDeduction,
  stockStatus,
  stockValue,
  stockValuePriced,
  toOrder,
  unpricedStockCount,
} from "./stock.ts";

test("exemple stock : valeur et seuils", () => {
  const items = exampleStock();
  assert.equal(stockStatus(items[0]!), "ok");
  assert.ok(stockValue(items) > 0);
});

test("couverture devis : 2 panneaux 400 + 4 charnières + 2 poignées", () => {
  const need = jobNeedFromQuote(
    { A: 2, B: 0 },
    [
      { id: "1", name: "Charnières invisibles", qty: "4", unitPrice: "4.5" },
      { id: "2", name: "Poignées inox", qty: "2", unitPrice: "6" },
    ],
  );
  const lines = coverage(exampleStock(), need);
  assert.equal(hasShortage(lines), false);
  const a = lines.find((l) => l.key === "panel-A");
  assert.equal(a?.needed, 2);
  assert.equal(a?.onHand, 10);
  assert.equal(toOrder(lines).length, 0);
});

test("pénurie détectée si trop de panneaux 600", () => {
  const lines = coverage(exampleStock(), {
    panelsA: 0,
    panelsB: 99,
    hardware: [],
  });
  assert.equal(hasShortage(lines), true);
  assert.equal(lines.find((l) => l.key === "panel-B")?.gap, 93);
  assert.deepEqual(toOrder(lines), [{ name: "Panneau 2500 × 600 mm", qty: 93 }]);
});

test("déduction chantier retire les quantités", () => {
  const start = exampleStock();
  const need = jobNeedFromQuote(
    { A: 2, B: 0 },
    [{ id: "1", name: "Charnières invisibles", qty: "4", unitPrice: "4.5" }],
  );
  const out = consumeForJob(start, [], need, "DEVIS-2026-001", false);
  assert.equal(out.ok, true);
  const a = out.items.find((i) => i.id === "stock-panel-A");
  const h = out.items.find((i) => i.name === "Charnières invisibles");
  assert.equal(a?.qty, 8);
  assert.equal(h?.qty, 12);
  assert.equal(out.moves.length, 2);
});

test("déduction bloquée si stock insuffisant (sans partiel)", () => {
  const need = { panelsA: 99, panelsB: 0, hardware: [] };
  const out = consumeForJob(exampleStock(), [], need, "X", false);
  assert.equal(out.ok, false);
  assert.equal(out.items.find((i) => i.id === "stock-panel-A")?.qty, 10);
});

test("créer un article hors stock sans doublon", () => {
  const start = exampleStock();
  const next = ensureStockArticle(start, "Charnières invisibles", 4.5);
  assert.equal(next.length, start.length);
  const added = ensureStockArticle(start, "Tiroirs métalliques", 12);
  assert.equal(added.length, start.length + 1);
  assert.equal(added.at(-1)?.qty, 0);
  assert.equal(added.at(-1)?.name, "Tiroirs métalliques");
});

test("déduction enregistre l’historique et l’annulation restaure le stock", () => {
  const start = exampleStock();
  const need = jobNeedFromQuote({ A: 2, B: 0 }, []);
  const out = consumeForJob(start, [], need, "DEVIS-1", false, {
    projectId: "p1",
    projectName: "Étagère salon",
  });
  assert.equal(out.ok, true);
  assert.ok(out.deduction);
  assert.equal(out.items.find((i) => i.id === "stock-panel-A")?.qty, 8);
  const twice = consumeForJob(out.items, out.moves, need, "DEVIS-1", false);
  assert.equal(twice.ok, true);
  assert.equal(twice.items.find((i) => i.id === "stock-panel-A")?.qty, 6);
  const back = restoreDeduction(out.items, out.moves, out.deduction!);
  assert.equal(back.ok, true);
  assert.equal(back.items.find((i) => i.id === "stock-panel-A")?.qty, 10);
});

test("dates placeholder / epoch ne s’affichent pas comme un vrai mouvement", () => {
  assert.equal(isPlaceholderDate(undefined), true);
  assert.equal(isPlaceholderDate(""), true);
  assert.equal(isPlaceholderDate(PLACEHOLDER_STOCK_DATE), true);
  assert.equal(isPlaceholderDate("1970-01-01T00:00:00.000Z"), true);
  assert.equal(isPlaceholderDate("2026-03-12T14:30:00.000Z"), false);
});

test("valeur stock : articles sans prix exclus et comptés à part", () => {
  const items = exampleStock().map((it, i) =>
    i === 0 ? { ...it, unitCost: 0 } : it,
  );
  assert.equal(unpricedStockCount(items), 1);
  const priced = stockValuePriced(items);
  assert.ok(priced < stockValue(exampleStock()));
  assert.equal(
    priced,
    items
      .filter((it) => it.unitCost > 0)
      .reduce((s, it) => s + it.qty * it.unitCost, 0),
  );
});
