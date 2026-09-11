import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyRow, defaultQuoteIdentity } from "./presets.ts";
import { migrateState } from "./persist.ts";
import type { AppSettings } from "./types.ts";

function defaults() {
  const settings: AppSettings = {
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
  return { settings, emptyRow: emptyRow() };
}

test("v4 avec pièces → projet « Projet existant »", () => {
  const d = defaults();
  const migrated = migrateState(
    {
      rows: [
        { id: "1", name: "Montant", length: "1800", width: "380", qty: "2" },
      ],
      settings: { kerf: 4 },
      stock: [],
      moves: [],
    },
    d,
  );
  assert.equal(migrated.version, 5);
  assert.equal(migrated.rows[0]?.name, "Montant");
  assert.equal(migrated.settings.kerf, 4);
  assert.equal(migrated.catalog.refs.some((r) => r.id === "A"), true);
  assert.equal(migrated.catalog.refs.some((r) => r.id === "B"), true);
  assert.equal(migrated.projects.length, 1);
  assert.equal(migrated.projects[0]?.name, "Projet existant");
  assert.ok(migrated.currentProjectId);
});

test("état vide ne crée pas de projet démo", () => {
  const migrated = migrateState(null, defaults());
  assert.equal(migrated.projects.length, 0);
  assert.equal(migrated.currentProjectId, null);
  assert.equal(migrated.catalog.refs.length, 2);
});
