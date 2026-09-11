import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyRow, defaultQuoteIdentity } from "./presets.ts";
import {
  duplicateProject,
  findProjectByName,
  parseImportedProject,
  serializeProject,
  snapshotProject,
  uniqueImportedName,
} from "./projects.ts";
import type { AppSettings } from "./types.ts";

function sampleSettings(): AppSettings {
  return {
    ...defaultQuoteIdentity(),
    kerf: 3,
    allowRotation: true,
    method: "auto",
    pricePerM2: 40,
    wastePct: 15,
    marginPct: 20,
    surfaceOverrideM2: null,
    laborHours: 0,
    hourlyRate: 45,
    hardwareItems: [],
  };
}

function sampleProject() {
  return snapshotProject({
    name: "Étagère salon",
    description: "Bibliothèque",
    clientName: "Martin",
    notes: "Livraison juin",
    rows: [
      {
        id: "p1",
        name: "Côté gauche",
        length: "800",
        width: "350",
        qty: "1",
        familyId: "fam-tilly",
      },
      emptyRow(),
    ],
    settings: sampleSettings(),
    selectedStrategy: "mixed",
    usedRefIds: ["A", "B"],
    supplierSnapshot: {
      lines: [
        {
          specId: "A",
          familyId: "fam-standard",
          familyName: "Standard",
          name: "P-400",
          length: 2500,
          width: 400,
          qty: 4,
          areaM2: 4,
          pricePerM2: 20,
          cost: 80,
        },
      ],
      totalAreaM2: 4,
      weightedPricePerM2: 20,
      totalCost: 80,
      missing: [],
      calculatedAt: "2026-01-01T00:00:00.000Z",
    },
    stockDeduction: {
      id: "ded-1",
      date: "2026-01-02T00:00:00.000Z",
      quoteNumber: "DEVIS-1",
      projectId: "x",
      projectName: "Étagère salon",
      partial: false,
      lines: [
        {
          itemId: "stock-panel-A",
          specId: "A",
          name: "Panneau 2500 × 400 mm",
          qty: 2,
          areaM2: 2,
          before: 10,
          after: 8,
        },
      ],
    },
  });
}

test("export / import JSON reconstitue le projet", () => {
  const p = sampleProject();
  const json = serializeProject(p);
  const parsed = parseImportedProject(json);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.project.name, "Étagère salon");
  assert.equal(parsed.project.clientName, "Martin");
  assert.equal(parsed.project.rows[0]?.familyId, "fam-tilly");
  assert.deepEqual(parsed.project.usedRefIds, ["A", "B"]);
  assert.equal(parsed.project.supplierSnapshot?.weightedPricePerM2, 20);
  assert.equal(parsed.project.stockDeduction?.id, "ded-1");
});

test("fichier invalide → message clair", () => {
  const bad = parseImportedProject("{nope");
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.match(bad.error, /JSON/i);
  const other = parseImportedProject('{"hello":1}');
  assert.equal(other.ok, false);
});

test("dupliquer change l’id et le nom, pas les pièces, et n’emporte pas la déduction", () => {
  const p = sampleProject();
  const copy = duplicateProject(p);
  assert.notEqual(copy.id, p.id);
  assert.match(copy.name, /copie/);
  assert.equal(copy.rows[0]?.name, "Côté gauche");
  assert.equal(copy.stockDeduction, null);
  assert.equal(copy.supplierSnapshot?.weightedPricePerM2, 20);
});

test("nom d’import unique si collision", () => {
  const p = sampleProject();
  const name = uniqueImportedName([p], "Étagère salon");
  assert.equal(name, "Étagère salon (2)");
  assert.ok(findProjectByName([p], "Étagère salon"));
});

test("snapshot n’embarque pas le stock atelier", () => {
  const p = snapshotProject({
    name: "Test",
    description: "",
    clientName: "",
    notes: "",
    rows: [emptyRow()],
    settings: sampleSettings(),
    selectedStrategy: "mixed",
    usedRefIds: ["A"],
  });
  assert.equal(p.stock, undefined);
  assert.equal(p.moves, undefined);
  assert.equal(p.supplierSnapshot, null);
  assert.equal(p.stockDeduction, null);
});
