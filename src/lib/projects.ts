/**
 * Projets enregistrés localement : tout ce qu’il faut pour rouvrir et recalculer.
 * Le stock atelier et le catalogue sont globaux : on n’y copie plus le stock.
 */

import type { Catalog } from "./catalog.ts";
import { migratePieceRow, migratePieceRows } from "./piece-io.ts";
import type { StockDeduction } from "./stock.ts";
import type { SupplierCost } from "./supplier.ts";
import type { AppSettings, JobStatus, PieceRow } from "./types.ts";
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
  /** Conservé pour les anciens fichiers, ignoré à l’ouverture. */
  stock?: unknown;
  moves?: unknown;
  selectedStrategy: string;
  usedRefIds: string[];
  supplierSnapshot?: SupplierCost | null;
  stockDeduction?: StockDeduction | null;
  /** Premier calepinage valide (conservé tant que le pack reste honnête). */
  calculatedAt?: string;
  /** Date de déduction stock. Ne pas effacer sans action claire. */
  stockDeductedAt?: string;
  /** Date d’émission du PDF client / marqueur devis. */
  quoteIssuedAt?: string;
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
  selectedStrategy: string;
  usedRefIds: string[];
  supplierSnapshot?: SupplierCost | null;
  stockDeduction?: StockDeduction | null;
  calculatedAt?: string | null;
  stockDeductedAt?: string | null;
  quoteIssuedAt?: string | null;
}): Project {
  const t = new Date().toISOString();
  const stockDeductedAt =
    input.stockDeductedAt || input.stockDeduction?.date || undefined;
  return {
    id: input.id ?? newId(),
    name: input.name.trim() || "Sans titre",
    description: input.description,
    clientName: input.clientName,
    notes: input.notes,
    createdAt: input.createdAt ?? t,
    updatedAt: t,
    rows: input.rows.map((r) => migratePieceRow(r)),
    settings: input.settings,
    selectedStrategy: input.selectedStrategy,
    usedRefIds: input.usedRefIds,
    supplierSnapshot: input.supplierSnapshot ?? null,
    stockDeduction: input.stockDeduction ?? null,
    calculatedAt: input.calculatedAt || undefined,
    stockDeductedAt,
    quoteIssuedAt: input.quoteIssuedAt || undefined,
  };
}

export function duplicateProject(project: Project, name?: string): Project {
  const t = new Date().toISOString();
  const copy = structuredClone(project);
  return {
    ...copy,
    id: newId(),
    name: name?.trim() || `${project.name} (copie)`,
    createdAt: t,
    updatedAt: t,
    stockDeduction: null,
    stockDeductedAt: undefined,
    quoteIssuedAt: undefined,
    calculatedAt: undefined,
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
  return { ok: true, project: migrateProject({ ...project, id: project.id || newId() }), catalog };
}

export function migrateProject(project: Project): Project {
  const stockDeductedAt =
    (typeof project.stockDeductedAt === "string" && project.stockDeductedAt) ||
    project.stockDeduction?.date ||
    undefined;
  const calculatedAt =
    typeof project.calculatedAt === "string" && project.calculatedAt
      ? project.calculatedAt
      : project.usedRefIds?.length || project.supplierSnapshot
        ? project.updatedAt
        : undefined;
  return {
    ...project,
    rows: migratePieceRows(project.rows),
    calculatedAt,
    stockDeductedAt,
    quoteIssuedAt:
      typeof project.quoteIssuedAt === "string" && project.quoteIssuedAt
        ? project.quoteIssuedAt
        : undefined,
  };
}

export type JobStatusInput = {
  hasValidPack: boolean;
  calculatedAt?: string | null;
  stockDeductedAt?: string | null;
  quoteIssuedAt?: string | null;
  stockDeduction?: { date: string } | null;
};

export function deriveJobStatus(p: JobStatusInput): JobStatus {
  const stockAt = p.stockDeductedAt || p.stockDeduction?.date;
  if (p.quoteIssuedAt) return "devis_emis";
  if (stockAt) return "stock_deduit";
  if (p.hasValidPack && p.calculatedAt) return "calepine";
  if (p.hasValidPack) return "calepine";
  return "brouillon";
}

export function formatDay(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatJobStatusLine(p: JobStatusInput): string {
  const stockAt = p.stockDeductedAt || p.stockDeduction?.date || null;
  const packed = p.hasValidPack || Boolean(p.calculatedAt);
  const pack = packed ? "Calepiné" : "Brouillon";
  const stock = stockAt
    ? `Stock déduit le ${formatDay(stockAt)}`
    : "Stock non déduit";
  const quote = p.quoteIssuedAt
    ? `Devis émis le ${formatDay(p.quoteIssuedAt)}`
    : "Devis non émis";
  return `${pack} · ${stock} · ${quote}`;
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
