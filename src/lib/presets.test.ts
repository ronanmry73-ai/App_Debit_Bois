import assert from "node:assert/strict";
import { test } from "node:test";
import type { AppSettings } from "./types.ts";
import {
  DEMO_CLIENT_NAME,
  DEMO_COMPANY_NAME,
  defaultQuoteIdentity,
  emptyQuoteIdentity,
  emptyWorkshopPrefs,
  isDemoCompany,
  migrateWorkshopPrefs,
  settingsFromWorkshopPrefs,
} from "./presets.ts";

function demoSettings(): AppSettings {
  return {
    ...defaultQuoteIdentity(),
    kerf: 3,
    allowRotation: true,
    method: "auto",
    pricePerM2: null,
    forcePricePerM2: false,
    wastePct: 0,
    marginPct: 20,
    surfaceOverrideM2: null,
    laborHours: 0,
    hourlyRate: 45,
    hardwareItems: [],
  };
}

test("projet neuf : valeurs vides, pas de Martin ni Atelier Lyon", () => {
  const id = emptyQuoteIdentity();
  assert.equal(id.companyName, "");
  assert.equal(id.clientName, "");
  assert.equal(id.companyAddress, "");
  assert.equal(id.furnitureDescription, "");
  assert.notEqual(id.clientName, DEMO_CLIENT_NAME);
  assert.notEqual(id.companyName, DEMO_COMPANY_NAME);
});

test("préférences atelier ignorent l’identité démo", () => {
  const prefs = migrateWorkshopPrefs(undefined, demoSettings());
  assert.equal(prefs.companyName, "");
  assert.equal(isDemoCompany(DEMO_COMPANY_NAME), true);
  assert.equal(isDemoCompany("Mon atelier"), false);
});

test("projet neuf reprend les préférences, jamais le client démo", () => {
  const s = settingsFromWorkshopPrefs({
    ...emptyWorkshopPrefs(),
    companyName: "Atelier du Port",
    hourlyRate: 50,
  });
  assert.equal(s.companyName, "Atelier du Port");
  assert.equal(s.clientName, "");
  assert.equal(s.hourlyRate, 50);
  assert.equal(s.pricePerM2, null);
});

test("chemin Drive : vide par défaut, conservé à la migration", () => {
  assert.equal(emptyWorkshopPrefs().driveBackupPath, "");
  const prefs = migrateWorkshopPrefs(
    { companyName: "Atelier", driveBackupPath: "  D:/Sauve/Debit  " },
    demoSettings(),
  );
  assert.equal(prefs.driveBackupPath, "D:/Sauve/Debit");
  const empty = migrateWorkshopPrefs({ companyName: "Atelier" }, demoSettings());
  assert.equal(empty.driveBackupPath, "");
});
