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

/**
 * État de vie du chantier — à ne pas confondre avec le statut métier dérivé
 * (`deriveJobStatus` : brouillon → calepiné → stock déduit → devis émis), qui
 * décrit l'avancement du dossier, pas la fin du chantier.
 */
export type ProjectStatus = "en_cours" | "termine";

export type Project = {
  id: string;
  name: string;
  description: string;
  clientName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** État de vie : absent = « en cours » (rétrocompatible avec les projets existants). */
  status?: ProjectStatus;
  /** Date de clôture du chantier (ISO). */
  finishedAt?: string;
  /** Remarque de clôture, facultative. */
  finishedNote?: string;
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
  status: ProjectStatus;
  finishedAt?: string;
};

export function emptyProjectMeta(): Pick<
  Project,
  "name" | "description" | "clientName" | "notes"
> {
  return { name: "", description: "", clientName: "", notes: "" };
}

/** Normalise un état de vie venu d'un fichier ou d'un formulaire. */
function normalizeStatus(value: unknown): ProjectStatus | undefined {
  return value === "termine" ? "termine" : value === "en_cours" ? "en_cours" : undefined;
}

/** État de vie du chantier : absence de champ = « en cours ». */
export function projectStatus(p: Pick<Project, "status">): ProjectStatus {
  return p.status === "termine" ? "termine" : "en_cours";
}

export function isProjectFinished(p: Pick<Project, "status">): boolean {
  return projectStatus(p) === "termine";
}

/** Libellé d'état, prêt à afficher : « En cours » / « Terminé le 12/08/2026 ». */
export function projectStatusLabel(
  p: Pick<Project, "status" | "finishedAt">,
): string {
  if (!isProjectFinished(p)) return "En cours";
  const day = formatDay(p.finishedAt);
  return day ? `Terminé le ${day}` : "Terminé";
}

/**
 * Clôture le chantier. On **marque**, on ne verrouille rien : le projet reste
 * ouvrable et modifiable, et se rouvre explicitement (`reopenProject`).
 * Un chantier se rouvre souvent (reprise, SAV), donc pas de verrou.
 */
export function finishProject(
  project: Project,
  opts: { at?: string; note?: string } = {},
): Project {
  const at =
    typeof opts.at === "string" && opts.at.trim()
      ? opts.at
      : new Date().toISOString();
  const note = typeof opts.note === "string" ? opts.note.trim() : "";
  return {
    ...project,
    status: "termine",
    finishedAt: at,
    finishedNote: note || undefined,
    updatedAt: new Date().toISOString(),
  };
}

/** Rouvre un chantier : il repart « en cours », la clôture est effacée. */
export function reopenProject(project: Project): Project {
  const next: Project = {
    ...project,
    status: "en_cours",
    updatedAt: new Date().toISOString(),
  };
  delete next.finishedAt;
  delete next.finishedNote;
  return next;
}

/** Répartition des chantiers par état, pour l'écran d'historique. */
export function countProjectsByStatus(projects: Project[]): {
  enCours: number;
  termines: number;
  total: number;
} {
  let termines = 0;
  for (const p of projects) if (isProjectFinished(p)) termines += 1;
  return { enCours: projects.length - termines, termines, total: projects.length };
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
  status?: ProjectStatus | null;
  finishedAt?: string | null;
  finishedNote?: string | null;
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
    status: normalizeStatus(input.status),
    finishedAt:
      typeof input.finishedAt === "string" && input.finishedAt.trim()
        ? input.finishedAt
        : undefined,
    finishedNote:
      typeof input.finishedNote === "string" && input.finishedNote.trim()
        ? input.finishedNote.trim()
        : undefined,
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
    // Une copie est un nouveau chantier : elle repart « en cours ».
    status: "en_cours",
    finishedAt: undefined,
    finishedNote: undefined,
  };
}

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    clientName: p.clientName,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    status: projectStatus(p),
    finishedAt: p.finishedAt,
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
    status: normalizeStatus(project.status),
    finishedAt:
      typeof project.finishedAt === "string" && project.finishedAt.trim()
        ? project.finishedAt
        : undefined,
    finishedNote:
      typeof project.finishedNote === "string" && project.finishedNote.trim()
        ? project.finishedNote.trim()
        : undefined,
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
