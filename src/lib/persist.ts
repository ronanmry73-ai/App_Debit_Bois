/**
 * Persistance locale : localStorage + fichier Electron (userData) si présent.
 * Catalogue, stocks et projets partagent le même fichier / la même clé.
 */

import { migrateCatalog, seedCatalog, type Catalog } from "./catalog.ts";
import { desktopApi } from "./desktop.ts";
import {
  emptyWorkshopPrefs,
  migrateWorkshopPrefs,
  type WorkshopPrefs,
} from "./presets.ts";
import { snapshotProject, type Project } from "./projects.ts";
import {
  exampleStock,
  migrateStockItems,
  type StockDeduction,
  type StockItem,
  type StockMove,
} from "./stock.ts";
import type { AppSettings, PieceRow } from "./types.ts";

export const STORAGE_KEY = "debit-bois-v5";
export const LEGACY_STORAGE_KEY = "debit-bois-v4";

export type ProjectMeta = {
  name: string;
  description: string;
  notes: string;
  clientName: string;
};

export type PersistedState = {
  version: 5;
  rows: PieceRow[];
  settings: AppSettings;
  stock: StockItem[];
  moves: StockMove[];
  catalog: Catalog;
  projects: Project[];
  currentProjectId: string | null;
  projectMeta: ProjectMeta;
  selectedStrategy: string;
  usedRefIds: string[];
  stockDeduction: StockDeduction | null;
  workshopPrefs: WorkshopPrefs;
};

export function emptyMeta(): ProjectMeta {
  return { name: "", description: "", notes: "", clientName: "" };
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rowsHaveWork(rows: PieceRow[]): boolean {
  return rows.some(
    (r) =>
      String(r.length ?? "").trim() !== "" &&
      String(r.width ?? "").trim() !== "",
  );
}

export function migrateState(
  raw: unknown,
  defaults: { settings: AppSettings; emptyRow: PieceRow },
): PersistedState {
  const base: PersistedState = {
    version: 5,
    rows: [defaults.emptyRow],
    settings: defaults.settings,
    stock: exampleStock(),
    moves: [],
    catalog: seedCatalog(),
    projects: [],
    currentProjectId: null,
    projectMeta: emptyMeta(),
    selectedStrategy: "mixed",
    usedRefIds: [],
    stockDeduction: null,
    workshopPrefs: emptyWorkshopPrefs(),
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const settings = o.settings
    ? { ...defaults.settings, ...(o.settings as AppSettings) }
    : defaults.settings;
  const rows =
    Array.isArray(o.rows) && o.rows.length > 0
      ? (o.rows as PieceRow[])
      : base.rows;
  const stock = migrateStockItems(o.stock);
  const moves = Array.isArray(o.moves) ? (o.moves as StockMove[]) : [];
  const catalog = migrateCatalog(o.catalog);
  let projects = Array.isArray(o.projects) ? (o.projects as Project[]) : [];
  const projectMeta: ProjectMeta = {
    ...emptyMeta(),
    ...((o.projectMeta as Partial<ProjectMeta>) ?? {}),
  };
  if (!projectMeta.notes && typeof o.notes === "string") {
    projectMeta.notes = o.notes;
  }
  if (!projectMeta.clientName && settings.clientName) {
    projectMeta.clientName = settings.clientName;
  }
  let currentProjectId =
    typeof o.currentProjectId === "string" ? o.currentProjectId : null;
  const usedRefIds = Array.isArray(o.usedRefIds)
    ? (o.usedRefIds as string[])
    : [];
  const stockDeduction =
    o.stockDeduction && typeof o.stockDeduction === "object"
      ? (o.stockDeduction as StockDeduction)
      : null;
  const workshopPrefs = migrateWorkshopPrefs(o.workshopPrefs, settings);

  const isV5 = o.version === 5;
  if (!isV5 && projects.length === 0 && rowsHaveWork(rows)) {
    const converted = snapshotProject({
      name: "Projet existant",
      description: "Données reprises de la version précédente.",
      clientName: projectMeta.clientName,
      notes: projectMeta.notes,
      rows,
      settings,
      selectedStrategy:
        typeof o.selectedStrategy === "string" ? o.selectedStrategy : "mixed",
      usedRefIds: usedRefIds.length > 0 ? usedRefIds : ["A", "B"],
    });
    projects = [converted];
    currentProjectId = converted.id;
    projectMeta.name = converted.name;
    projectMeta.description = converted.description;
  }

  return {
    version: 5,
    rows,
    settings,
    stock,
    moves,
    catalog,
    projects,
    currentProjectId,
    projectMeta,
    selectedStrategy:
      typeof o.selectedStrategy === "string" ? o.selectedStrategy : "mixed",
    usedRefIds,
    stockDeduction,
    workshopPrefs,
  };
}

export async function loadPersisted(
  defaults: { settings: AppSettings; emptyRow: PieceRow },
): Promise<PersistedState> {
  const desktop = desktopApi();
  if (desktop?.readStore) {
    try {
      const fromFile = await desktop.readStore();
      const parsed = parseJson(fromFile);
      if (parsed) return migrateState(parsed, defaults);
    } catch {
      /* fallback navigateur */
    }
  }
  if (typeof localStorage === "undefined") {
    return migrateState(null, defaults);
  }
  const v5 = parseJson(localStorage.getItem(STORAGE_KEY));
  if (v5) return migrateState(v5, defaults);
  const v4 = parseJson(localStorage.getItem(LEGACY_STORAGE_KEY));
  return migrateState(v4, defaults);
}

export async function savePersisted(state: PersistedState): Promise<void> {
  const json = JSON.stringify(state);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* quota */
    }
  }
  const desktop = desktopApi();
  if (desktop?.writeStore) {
    try {
      await desktop.writeStore(json);
    } catch {
      /* fichier indisponible */
    }
  }
}

export function formatWindowTitle(name: string, dirty: boolean): string {
  const label = name.trim() || "Sans titre";
  const marked = dirty ? `${label} •` : label;
  return `Débit Bois — ${marked}`;
}

export function applyWindowTitle(name: string, dirty: boolean): void {
  const full = formatWindowTitle(name, dirty);
  if (typeof document !== "undefined") {
    document.title = full;
  }
  const desktop = desktopApi();
  if (desktop?.setTitle) {
    void desktop.setTitle(full);
  }
}

export async function exportText(
  suggestedName: string,
  content: string,
): Promise<boolean> {
  const desktop = desktopApi();
  if (desktop?.exportFile) {
    return desktop.exportFile(suggestedName, content);
  }
  if (typeof document === "undefined") return false;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName.endsWith(".json")
    ? suggestedName
    : `${suggestedName}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function importText(): Promise<string | null> {
  const desktop = desktopApi();
  if (desktop?.importFile) {
    return desktop.importFile();
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then(resolve).catch(() => resolve(null));
    };
    input.click();
  });
}
