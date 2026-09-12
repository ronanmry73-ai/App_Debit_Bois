import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyRow, defaultQuoteIdentity } from "./presets.ts";
import { migrateState, formatWindowTitle } from "./persist.ts";
import type { AppSettings } from "./types.ts";

function defaults() {
  const settings: AppSettings = {
    ...defaultQuoteIdentity(),
    kerf: 3,
    allowRotation: true,
    method: "auto",
    pricePerM2: null,
    wastePct: 0,
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
  assert.equal(migrated.catalog.refs.find((r) => r.id === "A")?.pricePerM2, null);
  assert.equal(migrated.projects.length, 1);
  assert.equal(migrated.projects[0]?.name, "Projet existant");
  assert.ok(migrated.currentProjectId);
  assert.equal(migrated.stockDeduction, null);
  assert.equal(migrated.projects[0]?.supplierSnapshot, null);
});

test("état vide ne crée pas de projet démo", () => {
  const migrated = migrateState(null, defaults());
  assert.equal(migrated.projects.length, 0);
  assert.equal(migrated.currentProjectId, null);
  assert.equal(migrated.catalog.refs.length, 2);
  assert.equal(migrated.stockDeduction, null);
  assert.equal(migrated.workshopPrefs.companyName, "");
});

test("v5 conserve prix catalogue, stock atelier global et déduction", () => {
  const d = defaults();
  const migrated = migrateState(
    {
      version: 5,
      rows: [{ id: "1", name: "Montant", length: "1800", width: "380", qty: "2" }],
      settings: d.settings,
      catalog: {
        families: [
          {
            id: "fam-standard",
            name: "Standard",
            active: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
        refs: [
          {
            id: "A",
            familyId: "fam-standard",
            name: "P-400",
            length: 2500,
            width: 400,
            pricePerM2: 18.5,
            active: true,
          },
          {
            id: "B",
            familyId: "fam-standard",
            name: "P-600",
            length: 2500,
            width: 600,
            pricePerM2: 30,
            active: true,
          },
        ],
      },
      stock: [
        {
          id: "stock-panel-A",
          kind: "panel-A",
          name: "Panneau 2500 × 400 mm",
          sku: "P-400",
          qty: 42,
          unit: "pièce",
          unitCost: 40,
          minQty: 4,
        },
      ],
      moves: [],
      projects: [
        {
          id: "p1",
          name: "Chantier",
          description: "",
          clientName: "",
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          rows: [{ id: "1", name: "Montant", length: "1800", width: "380", qty: "2" }],
          settings: d.settings,
          selectedStrategy: "mixed",
          usedRefIds: ["A"],
          supplierSnapshot: {
            lines: [],
            totalAreaM2: 4,
            weightedPricePerM2: 18.5,
            totalCost: 74,
            missing: [],
            calculatedAt: "2026-01-01T00:00:00.000Z",
          },
          stockDeduction: {
            id: "d1",
            date: "2026-01-01T00:00:00.000Z",
            quoteNumber: "X",
            projectId: "p1",
            projectName: "Chantier",
            partial: false,
            lines: [],
          },
          stock: [{ id: "copied-into-project", qty: 1 }],
        },
      ],
      currentProjectId: "p1",
      projectMeta: { name: "Chantier", description: "", notes: "", clientName: "" },
      selectedStrategy: "mixed",
      usedRefIds: ["A"],
      stockDeduction: {
        id: "d1",
        date: "2026-01-01T00:00:00.000Z",
        quoteNumber: "X",
        projectId: "p1",
        projectName: "Chantier",
        partial: false,
        lines: [],
      },
    },
    d,
  );
  assert.equal(migrated.catalog.refs.find((r) => r.id === "A")?.pricePerM2, 18.5);
  assert.equal(migrated.catalog.refs.find((r) => r.id === "B")?.pricePerM2, 30);
  assert.equal(migrated.stock.find((s) => s.id === "stock-panel-A")?.qty, 42);
  assert.equal(migrated.stock.some((s) => s.id === "copied-into-project"), false);
  assert.equal(migrated.projects[0]?.supplierSnapshot?.weightedPricePerM2, 18.5);
  assert.equal(migrated.stockDeduction?.id, "d1");
  assert.equal(migrated.projects[0]?.stockDeduction?.id, "d1");
  assert.equal(migrated.projects[0]?.rows[0]?.grain, "default");
  assert.equal(migrated.projects[0]?.stockDeductedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(migrated.calculatedAt, "2026-01-01T00:00:00.000Z");
});

test("titre fenêtre = nom du projet, puce si dirty", () => {
  assert.equal(formatWindowTitle("", false), "Débit Bois — Sans titre");
  assert.equal(formatWindowTitle("  ", true), "Débit Bois — Sans titre •");
  assert.equal(formatWindowTitle("Étagère salon", false), "Débit Bois — Étagère salon");
  assert.equal(formatWindowTitle("Étagère salon", true), "Débit Bois — Étagère salon •");
});

test("identité démo n’est pas copiée dans les préférences atelier", () => {
  const d = defaults();
  const migrated = migrateState({ settings: d.settings }, d);
  assert.equal(migrated.workshopPrefs.companyName, "");
  assert.equal(migrated.workshopPrefs.companyAddress, "");
});
