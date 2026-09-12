import assert from "node:assert/strict";
import { test } from "node:test";
import { seedCatalog } from "./catalog.ts";
import { optimizeCutting } from "./packing.ts";
import { cuttingCsv, strategyDxf } from "./saw-export.ts";
import type { PieceRow } from "./types.ts";

test("CSV : une ligne par pièce placée, UTF-8 point-virgule", () => {
  const out = optimizeCutting(
    [
      {
        id: "p0",
        name: "Montant",
        length: 800,
        width: 350,
        qty: 2,
      },
    ],
    { kerf: 3, allowRotation: true, method: "auto" },
  );
  const best = out.strategies.find((s) => s.id === out.bestId)!;
  const rows: PieceRow[] = [
    {
      id: "p0",
      name: "Montant",
      length: "800",
      width: "350",
      qty: "2",
      grain: "locked",
      group: "Caisson",
    },
  ];
  const csv = cuttingCsv(best, { rows, catalog: seedCatalog() });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("groupe;nom;L;l"));
  const data = csv.replace(/^\uFEFF/, "").trim().split("\n");
  const placed = data.filter((l) => l.includes("Montant"));
  assert.equal(placed.length, 2);
  assert.ok(placed[0]!.includes("Caisson"));
  assert.ok(placed[0]!.includes("Imposé"));
});

test("CSV : pièces non placées en bas, pas silencieuses", () => {
  const out = optimizeCutting(
    [
      {
        id: "xx",
        name: "Trop grande",
        length: 4000,
        width: 900,
        qty: 1,
      },
    ],
    { kerf: 3, allowRotation: false, method: "auto" },
  );
  const best = out.strategies.find((s) => s.id === out.bestId)!;
  assert.ok(best.unplaced.length >= 1);
  const csv = cuttingCsv(best, {
    rows: [
      {
        id: "xx",
        name: "Trop grande",
        length: "4000",
        width: "900",
        qty: "1",
      },
    ],
    catalog: seedCatalog(),
  });
  assert.ok(csv.includes("non placées"));
  assert.ok(csv.includes("Trop grande"));
});

test("DXF R12 : contour + pièces", () => {
  const out = optimizeCutting(
    [{ id: "p0", name: "A", length: 800, width: 350, qty: 1 }],
    { kerf: 3, allowRotation: false, method: "auto" },
  );
  const best = out.strategies.find((s) => s.id === out.bestId)!;
  const dxf = strategyDxf(best);
  assert.ok(dxf.includes("SECTION"));
  assert.ok(dxf.includes("ENTITIES"));
  assert.ok(dxf.includes("POLYLINE"));
  assert.ok(dxf.includes("VERTEX"));
  assert.ok(dxf.includes("TEXT"));
  assert.ok(dxf.trim().endsWith("EOF"));
});
