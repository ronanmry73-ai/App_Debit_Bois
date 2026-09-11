import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyRow, defaultQuoteIdentity } from "./presets.ts";
import { exampleStock } from "./stock.ts";
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
    stock: exampleStock(),
    moves: [],
    selectedStrategy: "mixed",
    usedRefIds: ["A", "B"],
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
});

test("fichier invalide → message clair", () => {
  const bad = parseImportedProject("{nope");
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.match(bad.error, /JSON/i);
  const other = parseImportedProject('{"hello":1}');
  assert.equal(other.ok, false);
});

test("dupliquer change l’id et le nom, pas les pièces", () => {
  const p = sampleProject();
  const copy = duplicateProject(p);
  assert.notEqual(copy.id, p.id);
  assert.match(copy.name, /copie/);
  assert.equal(copy.rows[0]?.name, "Côté gauche");
});

test("nom d’import unique si collision", () => {
  const p = sampleProject();
  const name = uniqueImportedName([p], "Étagère salon");
  assert.equal(name, "Étagère salon (2)");
  assert.ok(findProjectByName([p], "Étagère salon"));
});
