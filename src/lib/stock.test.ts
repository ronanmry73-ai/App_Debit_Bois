import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SPECS, optimizeCutting } from "./packing.ts";
import {
  consumeForJob,
  coverage,
  emptyOffcutItem,
  ensureStockArticle,
  exampleStock,
  hasShortage,
  isPlaceholderDate,
  jobNeedFromQuote,
  jobNeedFromStrategy,
  migrateStockItems,
  offcutBinsFromStock,
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
  assert.equal(a?.kind, "panel");
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

test("chute : bacs, skip projet source, déduction distincte des feuilles", () => {
  const oc = emptyOffcutItem({
    id: "oc1",
    name: "Chute JobA · P1 · 1200×380",
    length: 1200,
    width: 380,
    familyId: "fam-standard",
    qty: 1,
    sourceProjectId: "job-a",
  });
  const items = [...exampleStock(), oc];
  const bins = offcutBinsFromStock(items, "job-a");
  assert.equal(bins.length, 0, "ne pas manger sa propre chute");
  const binsB = offcutBinsFromStock(items, "job-b");
  assert.equal(binsB.length, 1);
  assert.equal(binsB[0]!.length, 1200);

  const packed = optimizeCutting(
    [
      {
        id: "t",
        name: "Tablette",
        length: 800,
        width: 350,
        qty: 1,
        familyId: "fam-standard",
        familyName: "Standard",
      },
    ],
    {
      kerf: 3,
      allowRotation: true,
      method: "auto",
      specs: DEFAULT_SPECS,
      offcuts: binsB,
    },
  );
  const best = packed.strategies.find((s) => s.id === packed.bestId)!;
  const need = jobNeedFromStrategy(best, []);
  assert.equal(need.offcuts?.length, 1);
  const lines = coverage(items, need, DEFAULT_SPECS);
  const off = lines.find((l) => l.kind === "offcut");
  assert.ok(off);
  assert.equal(off?.needed, 1);
  const out = consumeForJob(items, [], need, "B", false);
  assert.equal(out.ok, true);
  assert.equal(out.items.find((i) => i.id === "oc1")?.qty, 0);
  assert.equal(out.items.find((i) => i.id === "stock-panel-A")?.qty, 10);
});

test("migrateStockItems : chute sans usable → vivante", () => {
  const raw = [
    {
      id: "oc-old",
      kind: "offcut",
      name: "Chute",
      sku: "",
      qty: 1,
      unit: "pièce",
      unitCost: 0,
      minQty: 0,
      length: 1200,
      width: 400,
    },
  ];
  const next = migrateStockItems(raw);
  assert.equal(next[0]!.usable, true);
  assert.equal(next[0]!.kind, "offcut");
});
