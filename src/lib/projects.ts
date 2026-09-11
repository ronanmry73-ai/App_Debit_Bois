/**
 * Projets enregistrés localement : tout ce qu’il faut pour rouvrir et recalculer.
 */

import type { Catalog } from "./catalog.ts";
import type { StockItem, StockMove } from "./stock.ts";
import type { AppSettings, PieceRow } from "./types.ts";
import { newId } from "./utils.ts";

export const PROJECT_FILE_VERSION = 1;

export type Project = {
  id: string;
  name: string;
  description: string;
  clientName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  rows: PieceRow[];
  settings: AppSettings;
  stock: StockItem[];
  moves: StockMove[];
  selectedStrategy: string;
  usedRefIds: string[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  clientName: string;
  updatedAt: string;
  createdAt: string;
};

export function emptyProjectMeta(): Pick<
  Project,
  "name" | "description" | "clientName" | "notes"
> {
  return { name: "", description: "", clientName: "", notes: "" };
}

export function snapshotProject(input: {
  id?: string;
  createdAt?: string;
  name: string;
  description: string;
  clientName: string;
  notes: string;
  rows: PieceRow[];
  settings: AppSettings;
  stock: StockItem[];
  moves: StockMove[];
  selectedStrategy: string;
  usedRefIds: string[];
}): Project {
  const t = new Date().toISOString();
  return {
    id: input.id ?? newId(),
    name: input.name.trim() || "Sans titre",
    description: input.description,
    clientName: input.clientName,
    notes: input.notes,
    createdAt: input.createdAt ?? t,
    updatedAt: t,
    rows: input.rows,
    settings: input.settings,
    stock: input.stock,
    moves: input.moves,
    selectedStrategy: input.selectedStrategy,
    usedRefIds: input.usedRefIds,
  };
}

export function duplicateProject(project: Project, name?: string): Project {
  const t = new Date().toISOString();
  return {
    ...structuredClone(project),
    id: newId(),
    name: name?.trim() || `${project.name} (copie)`,
    createdAt: t,
    updatedAt: t,
  };
}

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    clientName: p.clientName,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
  };
}

export function usedRefIdsFromProjects(projects: Project[]): string[] {
  const ids = new Set<string>();
  for (const p of projects) {
    for (const id of p.usedRefIds ?? []) ids.add(id);
  }
  return [...ids];
}

export function findProjectByName(
  projects: Project[],
  name: string,
  exceptId?: string,
): Project | undefined {
  const k = name.trim().toLowerCase();
  if (!k) return undefined;
  return projects.find(
    (p) => p.id !== exceptId && p.name.trim().toLowerCase() === k,
  );
}

export type ExportFile = {
  kind: "debit-bois-project";
  version: number;
  exportedAt: string;
  project: Project;
  catalog?: Catalog;
};

export function serializeProject(
  project: Project,
  catalog?: Catalog,
): string {
  const payload: ExportFile = {
    kind: "debit-bois-project",
    version: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    catalog,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseImportedProject(
  raw: string,
): { ok: true; project: Project; catalog?: Catalog } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Le fichier n’est pas un JSON valide." };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Fichier de projet invalide." };
  }
  const obj = data as Partial<ExportFile> & { rows?: PieceRow[] };
  const project =
    obj.kind === "debit-bois-project" && obj.project
      ? obj.project
      : looksLikeProject(obj)
        ? (obj as unknown as Project)
        : null;
  if (!project || !Array.isArray(project.rows) || !project.name) {
    return {
      ok: false,
      error: "Ce fichier n’est pas un projet Débit Bois reconnu.",
    };
  }
  const catalog =
    obj.kind === "debit-bois-project" ? obj.catalog : undefined;
  return { ok: true, project: { ...project, id: project.id || newId() }, catalog };
}

function looksLikeProject(obj: object): boolean {
  const o = obj as { rows?: unknown; name?: unknown; settings?: unknown };
  return typeof o.name === "string" && Array.isArray(o.rows);
}

export function uniqueImportedName(
  projects: Project[],
  name: string,
): string {
  const base = name.trim() || "Projet importé";
  if (!findProjectByName(projects, base)) return base;
  let i = 2;
  while (findProjectByName(projects, `${base} (${i})`)) i += 1;
  return `${base} (${i})`;
}
