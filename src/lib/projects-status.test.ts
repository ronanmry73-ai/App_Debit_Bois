/**
 * État de vie des chantiers : clôture, réouverture, copie, migration.
 *
 * Ce que ces tests protègent :
 *   - un projet sans état compte comme « en cours » (rétrocompatibilité) ;
 *   - une sauvegarde n'efface jamais une clôture ;
 *   - une copie repart en cours ;
 *   - un état inconnu (fichier bricolé) est neutralisé, pas propagé.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  countProjectsByStatus,
  duplicateProject,
  finishProject,
  isProjectFinished,
  migrateProject,
  projectStatus,
  projectStatusLabel,
  reopenProject,
  snapshotProject,
  summarize,
  type Project,
} from "./projects.ts";
import type { AppSettings } from "./types.ts";

const SETTINGS = {} as AppSettings;

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "Étagère salon",
    description: "",
    clientName: "Romain",
    notes: "",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    rows: [],
    settings: SETTINGS,
    selectedStrategy: "auto",
    usedRefIds: [],
    ...overrides,
  };
}

test("un projet sans état compte comme « en cours »", () => {
  const p = project();
  assert.equal(projectStatus(p), "en_cours");
  assert.equal(isProjectFinished(p), false);
  assert.equal(projectStatusLabel(p), "En cours");
});

test("finishProject marque le chantier, sans rien verrouiller", () => {
  const p = finishProject(project(), {
    at: "2026-09-12T12:00:00.000Z",
    note: "Pose terminée, reprise des plinthes à faire",
  });
  assert.equal(p.status, "termine");
  assert.equal(p.finishedAt, "2026-09-12T12:00:00.000Z");
  assert.equal(p.finishedNote, "Pose terminée, reprise des plinthes à faire");
  assert.equal(isProjectFinished(p), true);
  assert.equal(projectStatusLabel(p), "Terminé le 12/09/2026");
  // Les données du projet restent intactes : on marque, on ne fige pas.
  assert.deepEqual(p.rows, []);
  assert.equal(p.name, "Étagère salon");
});

test("finishProject sans date prend l'instant courant", () => {
  const before = Date.now();
  const p = finishProject(project());
  const at = new Date(p.finishedAt ?? "").getTime();
  assert.ok(at >= before && at <= Date.now());
  assert.equal(p.finishedNote, undefined, "remarque vide → absente");
});

test("reopenProject efface la clôture et repart en cours", () => {
  const closed = finishProject(project(), {
    at: "2026-09-12T12:00:00.000Z",
    note: "SAV",
  });
  const reopened = reopenProject(closed);
  assert.equal(reopened.status, "en_cours");
  assert.equal(reopened.finishedAt, undefined);
  assert.equal(reopened.finishedNote, undefined);
  assert.equal(isProjectFinished(reopened), false);
});

test("une sauvegarde conserve l'état de vie (elle n'efface pas la clôture)", () => {
  const base = {
    name: "Étagère salon",
    description: "",
    clientName: "Romain",
    notes: "",
    rows: [],
    settings: SETTINGS,
    selectedStrategy: "auto",
    usedRefIds: [],
  };
  const closed = snapshotProject({
    ...base,
    status: "termine",
    finishedAt: "2026-09-12T12:00:00.000Z",
    finishedNote: "SAV",
  });
  assert.equal(closed.status, "termine");
  assert.equal(closed.finishedAt, "2026-09-12T12:00:00.000Z");
  assert.equal(closed.finishedNote, "SAV");

  const fresh = snapshotProject(base);
  assert.equal(fresh.status, undefined);
  assert.equal(projectStatus(fresh), "en_cours");
});

test("une copie repart « en cours »", () => {
  const closed = finishProject(project(), { at: "2026-09-12T12:00:00.000Z", note: "SAV" });
  const copy = duplicateProject(closed, "Étagère salon (copie)");
  assert.notEqual(copy.id, closed.id);
  assert.equal(copy.status, "en_cours");
  assert.equal(copy.finishedAt, undefined);
  assert.equal(copy.finishedNote, undefined);
  assert.equal(copy.quoteIssuedAt, undefined);
});

test("migrateProject neutralise un état inconnu et garde un état valide", () => {
  const weird = migrateProject(
    project({ status: "archive" as unknown as Project["status"] }),
  );
  assert.equal(weird.status, undefined);
  assert.equal(projectStatus(weird), "en_cours");

  const valid = migrateProject(
    project({
      status: "termine",
      finishedAt: "2026-09-12T12:00:00.000Z",
      finishedNote: "  SAV  ",
    }),
  );
  assert.equal(valid.status, "termine");
  assert.equal(valid.finishedNote, "SAV", "remarque nettoyée");
});

test("countProjectsByStatus répartit les chantiers", () => {
  const list = [
    project({ id: "a" }),
    project({ id: "b", status: "termine", finishedAt: "2026-09-01T12:00:00.000Z" }),
    project({ id: "c", status: "en_cours" }),
    project({ id: "d", status: "termine", finishedAt: "2026-09-10T12:00:00.000Z" }),
  ];
  assert.deepEqual(countProjectsByStatus(list), { enCours: 2, termines: 2, total: 4 });
  assert.deepEqual(countProjectsByStatus([]), { enCours: 0, termines: 0, total: 0 });
});

test("summarize porte l'état et la date de fin", () => {
  const closed = finishProject(project(), { at: "2026-09-12T12:00:00.000Z" });
  const s = summarize(closed);
  assert.equal(s.status, "termine");
  assert.equal(s.finishedAt, "2026-09-12T12:00:00.000Z");
  const open = summarize(project());
  assert.equal(open.status, "en_cours");
  assert.equal(open.finishedAt, undefined);
});
