import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Calculator,
  ChevronDown,
  Package,
  Layers,
  Hammer,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieceList } from "@/components/piece-list";
import { SettingsBar } from "@/components/settings-bar";
import { ResultsPanel } from "@/components/results-panel";
import { QuotePanel } from "@/components/quote-panel";
import { QuoteDocument } from "@/components/quote-document";
import { StockPanel } from "@/components/stock-panel";
import { CatalogPanel } from "@/components/catalog-panel";
import { ProjectsBar } from "@/components/projects-bar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { JobNeedPanel } from "@/components/job-need-panel";
import { SupplierCostPanel } from "@/components/supplier-cost-panel";
import { AtelierSheet } from "@/components/atelier-sheet";
import { HardwareList } from "@/components/hardware-list";
import { JobStatusBadge } from "@/components/job-status-badge";
import {
  optimizeCutting,
  refreshStrategyMetrics,
  repackLockedPanel,
  stockableLeftovers,
  swapOnPanel,
  type FreeRect,
  type OccupiedRect,
  type OptimizeOutput,
  type PackedPanel,
  type PieceDef,
  type StrategyId,
  type StrategyResult,
} from "@/lib/packing";
import { incompleteSelling, planWastePct, sellingFromInputs } from "@/lib/pricing";
import {
  emptyOffcutItem,
  ensureStockArticle,
  exampleStock,
  jobNeedFromStrategy,
  nameOffcut,
  offcutBinsFromStock,
  recordMove,
  syncStockWithCatalog,
  type StockDeduction,
  type StockItem,
  type StockMove,
} from "@/lib/stock";
import {
  emptyRow,
  INITIAL_EMPTY_ROW,
  emptyQuoteIdentity,
  emptyWorkshopPrefs,
  isDemoCompany,
  settingsFromWorkshopPrefs,
  type WorkshopPrefs,
} from "@/lib/presets";
import {
  packingSpecs,
  mergeCatalog,
  seedCatalog,
  type Catalog,
} from "@/lib/catalog";
import {
  duplicateProject,
  findProjectByName,
  parseImportedProject,
  serializeProject,
  snapshotProject,
  uniqueImportedName,
  usedRefIdsFromProjects,
  type Project,
  type JobStatusInput,
} from "@/lib/projects";
import {
  applyWindowTitle,
  emptyMeta,
  exportText,
  importText,
  loadPersisted,
  savePersisted,
  type ProjectMeta,
} from "@/lib/persist";
import type { AppSettings, PieceRow } from "@/lib/types";
import { effectivePurchasePrice, supplierCostFromCounts } from "@/lib/supplier";
import { newId, cn } from "@/lib/utils";
import { cuttingCsv, strategyDxf } from "@/lib/saw-export";
import { pieceCanRotate } from "@/lib/piece-io";

export const Route = createFileRoute("/")({ component: Home });

const DEFAULT_SETTINGS: AppSettings = {
  ...emptyQuoteIdentity(),
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
  hardwareItems: [{ id: "hw-empty-1", name: "", qty: "1", unitPrice: "" }],
};

type ViewMode = "atelier" | "stock" | "devis";

type DialogState =
  | { kind: "none" }
  | { kind: "unsaved"; next: () => void }
  | { kind: "save-as"; next?: () => void }
  | { kind: "rename"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "import-dup"; project: Project; catalog?: Catalog }
  | { kind: "clear-rows" }
  | { kind: "alert"; title: string; message: string }
  | { kind: "stock-plan-offcuts" };

function parseRows(
  rows: PieceRow[],
  catalog: Catalog,
  allowRotation: boolean,
): PieceDef[] {
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      length: Number(String(r.length).replace(",", ".")),
      width: Number(String(r.width).replace(",", ".")),
      qty: Math.floor(Number(String(r.qty).replace(",", "."))),
      familyId: r.familyId || null,
      familyName: catalog.families.find((f) => f.id === r.familyId)?.name ?? null,
      canRotate: pieceCanRotate(r.grain, allowRotation),
    }))
    .filter(
      (p) =>
        Number.isFinite(p.length) &&
        Number.isFinite(p.width) &&
        Number.isFinite(p.qty) &&
        p.length > 0 &&
        p.width > 0 &&
        p.qty > 0,
    );
}

function fpOf(input: {
  rows: PieceRow[];
  settings: AppSettings;
  selected: string;
  meta: ProjectMeta;
}): string {
  return JSON.stringify(input);
}

function usedFromOutput(out: OptimizeOutput | null): string[] {
  if (!out) return [];
  const ids = new Set<string>();
  for (const s of out.strategies) {
    for (const [id, n] of Object.entries(s.counts)) {
      if (n > 0 && !id.startsWith("offcut:")) ids.add(id);
    }
    for (const p of s.panels) {
      if (p.source === "offcut" || p.format.startsWith("offcut:")) continue;
      ids.add(p.format);
    }
  }
  return [...ids];
}

function printSheet(kind: "atelier" | "client") {
  const cls = kind === "atelier" ? "print-atelier" : "print-client";
  document.body.classList.add(cls);
  const cleanup = () => {
    document.body.classList.remove(cls);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

function packIsValid(out: OptimizeOutput | null, selected: string): boolean {
  if (!out) return false;
  const s =
    out.strategies.find((x) => x.id === selected) ??
    out.strategies.find((x) => x.id === out.bestId) ??
    null;
  return !!s && s.panels.some((p) => p.placements.length > 0);
}

function Home() {
  const [rows, setRows] = useState<PieceRow[]>([INITIAL_EMPTY_ROW]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<OptimizeOutput | null>(null);
  const [selected, setSelected] = useState<StrategyId>("mixed");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [algoOpen, setAlgoOpen] = useState(false);
  const [stock, setStock] = useState<StockItem[]>(exampleStock);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [catalog, setCatalog] = useState<Catalog>(seedCatalog);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectMeta, setProjectMeta] = useState<ProjectMeta>(emptyMeta);
  const [usedRefIds, setUsedRefIds] = useState<string[]>([]);
  const [stockDeduction, setStockDeduction] = useState<StockDeduction | null>(null);
  const [savedFp, setSavedFp] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [promptValue, setPromptValue] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("atelier");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [workshopPrefs, setWorkshopPrefs] = useState<WorkshopPrefs>(emptyWorkshopPrefs);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  const [quoteIssuedAt, setQuoteIssuedAt] = useState<string | null>(null);
  const skipNextPack = useRef(false);
  const skipWastePrefill = useRef(true);
  const lastPlanId = useRef("");
  const tauPrompted = useRef("");
  const [lastSwap, setLastSwap] = useState<{
    strategyId: string;
    panel: PackedPanel;
  } | null>(null);

  const liveFp = useMemo(
    () => fpOf({ rows, settings, selected, meta: projectMeta }),
    [rows, settings, selected, projectMeta],
  );
  const dirty = hydrated && liveFp !== savedFp;

  const specs = useMemo(
    () => packingSpecs(catalog, usedRefIds),
    [catalog, usedRefIds],
  );
  const jobScopeId = currentProjectId ?? "draft";

  function packingOffcuts() {
    return offcutBinsFromStock(stock, jobScopeId).map((b) => ({
      ...b,
      familyName:
        catalog.families.find((f) => f.id === b.familyId)?.name ?? b.familyName,
    }));
  }

  const blockedRefIds = useMemo(() => {
    const ids = new Set(usedRefIds);
    for (const id of usedRefIdsFromProjects(projects)) ids.add(id);
    return [...ids];
  }, [usedRefIds, projects]);

  useEffect(() => {
    let cancelled = false;
    void loadPersisted({ settings: DEFAULT_SETTINGS, emptyRow: INITIAL_EMPTY_ROW }).then(
      (saved) => {
        if (cancelled) return;
        skipNextPack.current = true;
        setRows(saved.rows);
        const named = saved.projects.find((p) => p.id === saved.currentProjectId);
        const prefs = saved.workshopPrefs ?? emptyWorkshopPrefs();
        let nextSettings: AppSettings = { ...DEFAULT_SETTINGS, ...saved.settings };
        if (!named && isDemoCompany(nextSettings.companyName) && !prefs.companyName.trim()) {
          nextSettings = {
            ...nextSettings,
            ...emptyQuoteIdentity(),
            ...prefs,
            clientName: saved.projectMeta.clientName || "",
          };
        }
        setSettings(nextSettings);
        const stockSynced = syncStockWithCatalog(saved.stock, saved.catalog);
        setStock(stockSynced);
        setMoves(saved.moves);
        setCatalog(saved.catalog);
        setProjects(saved.projects);
        setProjectMeta(saved.projectMeta);
        setUsedRefIds(saved.usedRefIds);
        setSelected(saved.selectedStrategy || "mixed");
        setWorkshopPrefs(prefs);
        setStockDeduction(named?.stockDeduction ?? saved.stockDeduction ?? null);
        setCalculatedAt(named?.calculatedAt ?? saved.calculatedAt ?? null);
        setQuoteIssuedAt(named?.quoteIssuedAt ?? saved.quoteIssuedAt ?? null);
        setCurrentProjectId(saved.currentProjectId || newId());
        setSavedFp(
          named
            ? fpOf({
                rows: named.rows,
                settings: named.settings,
                selected: named.selectedStrategy,
                meta: {
                  name: named.name,
                  description: named.description,
                  notes: named.notes,
                  clientName: named.clientName,
                },
              })
            : fpOf({
                rows: saved.rows,
                settings: nextSettings,
                selected: saved.selectedStrategy || "mixed",
                meta: saved.projectMeta,
              }),
        );
        setHydrated(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      void savePersisted({
        version: 5,
        rows,
        settings,
        stock,
        moves,
        catalog,
        projects,
        currentProjectId,
        projectMeta,
        selectedStrategy: selected,
        usedRefIds,
        stockDeduction,
        workshopPrefs,
        calculatedAt,
        quoteIssuedAt,
      });
    }, 280);
    return () => clearTimeout(t);
  }, [
    hydrated,
    rows,
    settings,
    stock,
    moves,
    catalog,
    projects,
    currentProjectId,
    projectMeta,
    selected,
    usedRefIds,
    stockDeduction,
    workshopPrefs,
    calculatedAt,
    quoteIssuedAt,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextPack.current) {
      skipNextPack.current = false;
    }
    const defs = parseRows(rows, catalog, settings.allowRotation);
    if (defs.length === 0) {
      setResult(null);
      setCalculatedAt(null);
      return;
    }
    const totalQty = defs.reduce((s, d) => s + d.qty, 0);
    if (totalQty > 400) {
      setError("Limitez le débit à 400 pièces pour garder le calcul instantané.");
      return;
    }
    if (specs.length === 0) {
      setResult(null);
      setError(
        "Aucune référence de panneau active. Activez une référence ou ajoutez-en une.",
      );
      return;
    }
    setError(null);
    const out = optimizeCutting(defs, {
      kerf: settings.kerf,
      allowRotation: settings.allowRotation,
      method: settings.method,
      specs,
      offcuts: packingOffcuts(),
    });
    setLastSwap(null);
    setResult(out);
    setCalculatedAt((prev) =>
      packIsValid(out, selected) || packIsValid(out, out.bestId)
        ? prev ?? new Date().toISOString()
        : null,
    );
    setUsedRefIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of usedFromOutput(out)) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? [...next] : prev;
    });
    setSelected((prev) =>
      out.strategies.some((s) => s.id === prev) ? prev : out.bestId,
    );
  }, [
    hydrated,
    rows,
    catalog,
    specs,
    settings.kerf,
    settings.allowRotation,
    settings.method,
  ]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4500);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!hydrated) return;
    applyWindowTitle(projectMeta.name, dirty);
  }, [hydrated, projectMeta.name, dirty]);

  function calculate() {
    skipWastePrefill.current = false;
    lastPlanId.current = "";
    const defs = parseRows(rows, catalog, settings.allowRotation);
    if (defs.length === 0) {
      setResult(null);
      setError("Ajoutez au moins une pièce avec longueur, largeur et quantité.");
      return;
    }
    const totalQty = defs.reduce((s, d) => s + d.qty, 0);
    if (totalQty > 400) {
      setError("Limitez le débit à 400 pièces pour garder le calcul instantané.");
      return;
    }
    if (specs.length === 0) {
      setError(
        "Aucune référence de panneau active. Activez une référence ou ajoutez-en une.",
      );
      return;
    }
    setError(null);
    const out = optimizeCutting(defs, {
      ...settings,
      specs,
      offcuts: packingOffcuts(),
    });
    setLastSwap(null);
    setResult(out);
    setCalculatedAt((prev) =>
      packIsValid(out, out.bestId) ? prev ?? new Date().toISOString() : null,
    );
    setUsedRefIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of usedFromOutput(out)) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? [...next] : prev;
    });
    setSelected(out.bestId);
  }

  const current = useMemo(
    () => result?.strategies.find((s) => s.id === selected) ?? null,
    [result, selected],
  );

  const liveSupplier = useMemo(
    () =>
      current
        ? supplierCostFromCounts(current.counts, packingSpecs(catalog, Object.keys(current.counts)))
        : null,
    [current, catalog],
  );

  const autoSurfaceM2 = current ? current.usedArea / 1_000_000 : 0;
  const purchasedAreaM2 = current ? current.purchasedArea / 1_000_000 : 0;
  const tauPlan = planWastePct(autoSurfaceM2, purchasedAreaM2);
  const surfaceM2 = settings.surfaceOverrideM2 ?? autoSurfaceM2;
  const purchasePrice = effectivePurchasePrice(liveSupplier, settings);
  const selling = useMemo(
    () =>
      purchasePrice != null
        ? sellingFromInputs(
            surfaceM2,
            purchasePrice,
            settings.wastePct,
            settings.laborHours,
            settings.hourlyRate,
            settings.hardwareItems,
            settings.marginPct,
          )
        : incompleteSelling(),
    [
      surfaceM2,
      purchasePrice,
      settings.wastePct,
      settings.laborHours,
      settings.hourlyRate,
      settings.hardwareItems,
      settings.marginPct,
    ],
  );

  useEffect(() => {
    if (!current) {
      lastPlanId.current = "";
      return;
    }
    const planId = `${selected}:${current.purchasedArea}:${current.usedArea}:${current.wastePercent}`;
    if (planId === lastPlanId.current) return;
    lastPlanId.current = planId;
    const tau = planWastePct(
      current.usedArea / 1_000_000,
      current.purchasedArea / 1_000_000,
    );
    if (skipWastePrefill.current) {
      skipWastePrefill.current = false;
      if (settings.wastePct > 0) return;
    }
    setSettings((s) => (s.wastePct === tau ? s : { ...s, wastePct: tau }));
  }, [current, selected, settings.wastePct]);

  function goDevis() {
    setCatalogOpen(false);
    setViewMode("devis");
    requestAnimationFrame(() => {
      document.getElementById("quote-sheet")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function goAtelierHardware() {
    setCatalogOpen(false);
    setViewMode("atelier");
    requestAnimationFrame(() => {
      document.getElementById("quinca-atelier")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function patchSettings(patch: Partial<AppSettings>) {
    setSettings((s) => ({ ...s, ...patch }));
    if (patch.clientName !== undefined) {
      setProjectMeta((m) => ({ ...m, clientName: patch.clientName ?? "" }));
    }
    setWorkshopPrefs((p) => {
      const next = { ...p };
      let changed = false;
      const map: Array<[keyof WorkshopPrefs, keyof AppSettings]> = [
        ["companyName", "companyName"],
        ["companyAddress", "companyAddress"],
        ["companyPhone", "companyPhone"],
        ["companyEmail", "companyEmail"],
        ["companySiret", "companySiret"],
        ["logoDataUrl", "logoDataUrl"],
        ["hourlyRate", "hourlyRate"],
        ["vatPct", "vatPct"],
        ["validity", "validity"],
        ["payment", "payment"],
        ["legal", "legal"],
      ];
      for (const [pk, sk] of map) {
        if (patch[sk] !== undefined && patch[sk] !== next[pk]) {
          (next as Record<string, unknown>)[pk] = patch[sk];
          changed = true;
        }
      }
      return changed ? next : p;
    });
  }

  const specLabels = useMemo(
    () => Object.fromEntries(specs.map((s) => [s.id, s.label])),
    [specs],
  );

  const jobNeed = current
    ? jobNeedFromStrategy(current, settings.hardwareItems, specLabels)
    : null;

  const stockedOffcutKeys = useMemo(() => {
    const s = new Set<string>();
    for (const it of stock) {
      if (it.kind !== "offcut") continue;
      if (it.sourceProjectId && it.sourceProjectId !== jobScopeId) continue;
      if (it.sourcePanelIndex && it.length && it.width) {
        s.add(
          `${it.sourcePanelIndex}:${Math.round(it.length)}x${Math.round(it.width)}`,
        );
      }
    }
    return s;
  }, [stock, jobScopeId]);

  function patchStrategy(mutator: (s: StrategyResult) => StrategyResult) {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        strategies: prev.strategies.map((s) =>
          s.id === selected ? mutator(s) : s,
        ),
      };
    });
  }

  function stockLeftover(panel: PackedPanel, rect: FreeRect) {
    const name = nameOffcut(projectMeta.name, panel.index, rect.w, rect.h);
    const dup = stock.find(
      (it) =>
        it.kind === "offcut" &&
        it.sourceProjectId === jobScopeId &&
        it.sourcePanelIndex === panel.index &&
        it.length === rect.w &&
        it.width === rect.h &&
        it.qty > 0,
    );
    if (dup) {
      setFlash("Cette chute est déjà en stock.");
      return;
    }
    const item = emptyOffcutItem({
      name,
      length: rect.w,
      width: rect.h,
      familyId: panel.familyId,
      sourceProjectId: jobScopeId,
      sourceProjectName: projectMeta.name.trim() || "Sans titre",
      sourcePanelIndex: panel.index,
      qty: 1,
      usable: true,
    });
    setStock((prev) => [...prev, item]);
    setMoves((prev) =>
      recordMove(prev, item.id, "in", 1, "Chute du plan", settings.quoteNumber, {
        projectId: jobScopeId,
        projectName: projectMeta.name,
      }),
    );
    setFlash(`${name} mise en stock.`);
  }

  function stockAllPlanOffcuts() {
    if (!current) return;
    for (const panel of current.panels) {
      for (const rect of stockableLeftovers(panel, settings.kerf)) {
        stockLeftover(panel, rect);
      }
    }
  }

  function handleWastePct(n: number) {
    setSettings((s) => ({ ...s, wastePct: n }));
    if (!current) return;
    const leftovers = current.panels.flatMap((p) =>
      stockableLeftovers(p, settings.kerf),
    );
    const planKey = `${selected}:${current.purchasedArea}`;
    if (
      n < tauPlan - 0.05 &&
      leftovers.length > 0 &&
      tauPrompted.current !== planKey
    ) {
      tauPrompted.current = planKey;
      setDialog({ kind: "stock-plan-offcuts" });
    }
  }

  function handleSwap(
    panelId: string,
    a: string,
    b: string,
  ): { ok: true } | { ok: false; reason: string } {
    if (!current) return { ok: false, reason: "Aucun plan." };
    const panel = current.panels.find((p) => p.id === panelId);
    if (!panel) return { ok: false, reason: "Panneau introuvable." };
    const res = swapOnPanel(panel, a, b);
    if (!res.ok) return res;
    setLastSwap({ strategyId: selected, panel });
    patchStrategy((s) => ({
      ...s,
      panels: s.panels.map((p) => (p.id === panelId ? res.panel : p)),
    }));
    setFlash("Pièces échangées. Le devis matière est inchangé.");
    return { ok: true };
  }

  function handleUndoSwap() {
    if (!lastSwap || !current) return;
    patchStrategy((s) => ({
      ...s,
      panels: s.panels.map((p) =>
        p.id === lastSwap.panel.id ? lastSwap.panel : p,
      ),
    }));
    setLastSwap(null);
    setFlash("Échange annulé.");
  }

  function handleLock(panelId: string, rect: OccupiedRect) {
    patchStrategy((s) => ({
      ...s,
      panels: s.panels.map((p) =>
        p.id === panelId
          ? { ...p, lockedRects: [...(p.lockedRects ?? []), rect] }
          : p,
      ),
    }));
    setFlash("Chute verrouillée. Recalculez ce panneau pour l’honorer.");
  }

  function handleUnlock(panelId: string, rect: OccupiedRect) {
    patchStrategy((s) => ({
      ...s,
      panels: s.panels.map((p) =>
        p.id === panelId
          ? {
              ...p,
              lockedRects: (p.lockedRects ?? []).filter(
                (r) =>
                  !(r.x === rect.x && r.y === rect.y && r.w === rect.w && r.h === rect.h),
              ),
            }
          : p,
      ),
    }));
  }

  function handleRecalcPanel(panelId: string) {
    if (!current) return;
    const panel = current.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const packed = repackLockedPanel(panel, {
      kerf: settings.kerf,
      allowRotation: settings.allowRotation,
      method: settings.method,
      specs,
    });
    patchStrategy((s) => {
      const others = s.panels.filter((p) => p.id !== panelId);
      const nextPanels = [packed.panel, ...packed.extra, ...others];
      const next: StrategyResult = {
        ...s,
        panels: nextPanels,
        unplaced: [...packed.unplaced, ...s.unplaced.filter((u) =>
          !nextPanels.some((p) => p.placements.some((pl) => pl.instanceId === u.instanceId)),
        )],
      };
      return refreshStrategyMetrics(next, specs);
    });
    setLastSwap(null);
    if (packed.extra.length > 0) {
      setFlash(
        `Chute verrouillée respectée. ${packed.extra.length} feuille${packed.extra.length > 1 ? "s" : ""} de plus.`,
      );
    } else {
      setFlash("Panneau recalculé. La chute verrouillée reste vide.");
    }
  }

  async function exportCsv() {
    if (!current) return;
    const name = (projectMeta.name.trim() || "debit").replace(/[^\wÀ-ÿ-]+/g, "-");
    const ok = await exportText(
      `${name}-scie.csv`,
      cuttingCsv(current, { rows, catalog }),
      "text/csv;charset=utf-8",
    );
    if (ok) setFlash("CSV scie exporté.");
  }

  async function exportDxf() {
    if (!current) return;
    const name = (projectMeta.name.trim() || "debit").replace(/[^\wÀ-ÿ-]+/g, "-");
    const ok = await exportText(
      `${name}-plans.dxf`,
      strategyDxf(current),
      "application/dxf;charset=utf-8",
    );
    if (ok) setFlash("DXF exporté.");
  }

  function guardUnsaved(next: () => void) {
    if (!dirty) {
      next();
      return;
    }
    setDialog({ kind: "unsaved", next });
  }

  function collectProject(name: string, id?: string, createdAt?: string): Project {
    const clientName = projectMeta.clientName || settings.clientName;
    return snapshotProject({
      id,
      createdAt,
      name,
      description: projectMeta.description,
      clientName,
      notes: projectMeta.notes,
      rows,
      settings: { ...settings, clientName },
      selectedStrategy: selected,
      usedRefIds: [...new Set([...usedRefIds, ...usedFromOutput(result)])],
      supplierSnapshot: liveSupplier,
      stockDeduction,
      calculatedAt,
      stockDeductedAt: stockDeduction?.date ?? null,
      quoteIssuedAt,
    });
  }

  function rememberSaved(p: Project) {
    setCurrentProjectId(p.id);
    setProjectMeta({
      name: p.name,
      description: p.description,
      notes: p.notes,
      clientName: p.clientName,
    });
    setUsedRefIds(p.usedRefIds ?? []);
    setSavedFp(
      fpOf({
        rows: p.rows,
        settings: p.settings,
        selected: p.selectedStrategy,
        meta: {
          name: p.name,
          description: p.description,
          notes: p.notes,
          clientName: p.clientName,
        },
      }),
    );
  }

  function saveNamed(name: string, asCopy: boolean): boolean {
    const trimmed = name.trim();
    if (!trimmed) {
      setDialog({
        kind: "alert",
        title: "Nom manquant",
        message: "Indiquez un nom de projet pour l’enregistrer.",
      });
      return false;
    }
    const clash = findProjectByName(
      projects,
      trimmed,
      asCopy ? undefined : currentProjectId ?? undefined,
    );
    if (clash && (asCopy || clash.id !== currentProjectId)) {
      setDialog({
        kind: "alert",
        title: "Nom déjà utilisé",
        message: `Un projet nommé « ${trimmed} » existe déjà. Choisissez un autre nom.`,
      });
      return false;
    }
    const existing = asCopy ? undefined : projects.find((p) => p.id === currentProjectId);
    const p = collectProject(trimmed, existing?.id, existing?.createdAt);
    setProjects((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i >= 0) {
        const next = prev.slice();
        next[i] = p;
        return next;
      }
      return [...prev, p];
    });
    rememberSaved(p);
    setSettings(p.settings);
    setFlash(`Projet « ${p.name} » enregistré.`);
    return true;
  }

  function saveCurrent(): boolean {
    if (!projectMeta.name.trim()) {
      setPromptValue("");
      setDialog({ kind: "save-as" });
      return false;
    }
    return saveNamed(projectMeta.name, false);
  }

  function resetWorkspace() {
    const nextRows = [emptyRow()];
    const nextMeta = emptyMeta();
    const nextSettings = settingsFromWorkshopPrefs(workshopPrefs);
    skipNextPack.current = true;
    skipWastePrefill.current = true;
    lastPlanId.current = "";
    setRows(nextRows);
    setResult(null);
    setError(null);
    setCurrentProjectId(newId());
    setProjectMeta(nextMeta);
    setUsedRefIds([]);
    setSelected("mixed");
    setSettings(nextSettings);
    setStockDeduction(null);
    setCalculatedAt(null);
    setQuoteIssuedAt(null);
    setCatalogOpen(false);
    setViewMode("atelier");
    setSavedFp(
      fpOf({
        rows: nextRows,
        settings: nextSettings,
        selected: "mixed",
        meta: nextMeta,
      }),
    );
  }

  function openProject(p: Project) {
    skipNextPack.current = true;
    skipWastePrefill.current = true;
    lastPlanId.current = "";
    setRows(p.rows.length > 0 ? p.rows : [emptyRow()]);
    const clientName = p.clientName || p.settings.clientName || "";
    setSettings({ ...DEFAULT_SETTINGS, ...p.settings, clientName });
    setSelected(p.selectedStrategy || "mixed");
    setStockDeduction(p.stockDeduction ?? null);
    setCalculatedAt(p.calculatedAt ?? null);
    setQuoteIssuedAt(p.quoteIssuedAt ?? null);
    rememberSaved(p);
    setError(null);
    setFlash(`Projet « ${p.name} » ouvert.`);
    setCatalogOpen(false);
    setViewMode("atelier");
  }

  function applyImported(project: Project, incomingCatalog?: Catalog, rename?: string) {
    const nextCat = mergeCatalog(catalog, incomingCatalog);
    setCatalog(nextCat);
    const named: Project = {
      ...project,
      name: rename ?? project.name,
    };
    setProjects((prev) => {
      const i = prev.findIndex((x) => x.id === named.id);
      if (i >= 0) {
        const copy = prev.slice();
        copy[i] = named;
        return copy;
      }
      if (prev.some((x) => x.id === named.id)) {
        return [...prev, { ...named, id: named.id }];
      }
      return [...prev, named];
    });
    openProject(named);
  }

  async function handleExport() {
    const name = projectMeta.name.trim() || "projet-debit-bois";
    const existing = projects.find((p) => p.id === currentProjectId);
    const p = collectProject(name, existing?.id, existing?.createdAt);
    const ok = await exportText(
      `${name.replace(/[^\wÀ-ÿ-]+/g, "-")}.json`,
      serializeProject(p, catalog),
    );
    if (ok) setFlash("Projet exporté.");
  }

  async function handleImport() {
    const raw = await importText();
    if (raw == null) return;
    const parsed = parseImportedProject(raw);
    if (!parsed.ok) {
      setDialog({
        kind: "alert",
        title: "Fichier invalide",
        message: parsed.error,
      });
      return;
    }
    const clash = findProjectByName(projects, parsed.project.name);
    if (clash) {
      setDialog({
        kind: "import-dup",
        project: parsed.project,
        catalog: parsed.catalog,
      });
      return;
    }
    applyImported(parsed.project, parsed.catalog);
  }

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;
  const stockWide = !catalogOpen && viewMode === "stock";
  const shellWidth = stockWide ? "max-w-none" : "max-w-6xl";
  const jobStatus: JobStatusInput = {
    hasValidPack: packIsValid(result, selected),
    calculatedAt,
    stockDeductedAt: stockDeduction?.date ?? currentProject?.stockDeductedAt ?? null,
    quoteIssuedAt,
    stockDeduction,
  };

  function printClient() {
    setQuoteIssuedAt((prev) => prev ?? new Date().toISOString());
    printSheet("client");
  }

  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-border bg-card/80">
        <div
          className={cn(
            "mx-auto flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6",
            shellWidth,
          )}
        >
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="font-display text-xl font-medium tracking-tight">Débit Bois</p>
              <p className="text-sm text-muted-foreground">
                {projectMeta.name.trim() || "Sans titre"}
                {dirty ? " •" : ""}
                {" — poste d’atelier"}
              </p>
              <div className="mt-1">
                <JobStatusBadge info={jobStatus} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={!catalogOpen && viewMode === "atelier" ? "default" : "outline"}
              onClick={() => {
                setCatalogOpen(false);
                setViewMode("atelier");
              }}
            >
              <Hammer />
              Atelier
            </Button>
            <Button
              type="button"
              variant={!catalogOpen && viewMode === "stock" ? "default" : "outline"}
              onClick={() => {
                setCatalogOpen(false);
                setViewMode("stock");
              }}
            >
              <Package />
              Stock
            </Button>
            <Button
              type="button"
              variant={!catalogOpen && viewMode === "devis" ? "default" : "outline"}
              onClick={() => {
                setCatalogOpen(false);
                setViewMode("devis");
              }}
            >
              <FileText />
              Devis
            </Button>
            <Button
              type="button"
              variant={catalogOpen ? "default" : "ghost"}
              onClick={() => setCatalogOpen((v) => !v)}
            >
              <Settings2 />
              Catalogue
            </Button>
            {viewMode === "atelier" && !catalogOpen && (
              <Button
                type="button"
                variant="outline"
                onClick={() => printSheet("atelier")}
                disabled={!result || !current}
              >
                Fiche atelier / PDF
              </Button>
            )}
            {viewMode === "devis" && !catalogOpen && (
              <Button
                type="button"
                onClick={() => (current ? printClient() : goDevis())}
                disabled={!result || !current}
              >
                <FileText />
                PDF client
              </Button>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8",
          shellWidth,
        )}
      >
        {(flash || error) && (
          <div className="no-print space-y-2">
            {flash && (
              <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                {flash}
              </p>
            )}
            {error && (
              <p className="rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        {catalogOpen && (
          <CatalogPanel
            catalog={catalog}
            usedRefIds={blockedRefIds}
            onChange={(next, err) => {
              setCatalog(next);
              setStock((prev) => syncStockWithCatalog(prev, next));
              if (err) setError(err);
              else setError(null);
            }}
          />
        )}

        {!catalogOpen && viewMode === "stock" && (
          <StockPanel
            items={stock}
            moves={moves}
            onItems={setStock}
            onMoves={setMoves}
            catalog={catalog}
            deduction={stockDeduction}
            onCatalog={() => setCatalogOpen(true)}
          />
        )}

        {!catalogOpen && viewMode === "atelier" && (
          <>
            <ProjectsBar
              meta={projectMeta}
              onMeta={(patch) => {
                setProjectMeta((m) => ({ ...m, ...patch }));
                if (patch.clientName !== undefined) {
                  setSettings((s) => ({ ...s, clientName: patch.clientName ?? "" }));
                }
              }}
              currentId={currentProjectId}
              dirty={dirty}
              projects={projects}
              onNew={() => guardUnsaved(() => resetWorkspace())}
              onSave={() => {
                saveCurrent();
              }}
              onSaveAs={() => {
                setPromptValue(projectMeta.name ? `${projectMeta.name} (copie)` : "");
                setDialog({ kind: "save-as" });
              }}
              onOpen={(id) => {
                const p = projects.find((x) => x.id === id);
                if (!p) return;
                if (id === currentProjectId) return;
                guardUnsaved(() => openProject(p));
              }}
              onClose={() => guardUnsaved(() => resetWorkspace())}
              onDuplicate={(id) => {
                const p = projects.find((x) => x.id === id);
                if (!p) return;
                const copy = duplicateProject(p);
                setProjects((prev) => [...prev, copy]);
                guardUnsaved(() => openProject(copy));
              }}
              onRename={(id) => {
                const p = projects.find((x) => x.id === id);
                if (!p) return;
                setPromptValue(p.name);
                setDialog({ kind: "rename", id });
              }}
              onDelete={(id) => setDialog({ kind: "delete", id })}
              onExport={() => {
                void handleExport();
              }}
              onImport={() => {
                void handleImport();
              }}
              jobStatus={jobStatus}
            />

            <Card className="no-print">
              <CardHeader>
                <CardTitle>Options de découpe</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <SettingsBar
                  settings={settings}
                  onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" size="lg" onClick={calculate}>
                    <Calculator />
                    Calculer le débit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCatalogOpen(true)}
                  >
                    <Layers />
                    Catalogue
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="no-print">
              <PieceList
                rows={rows}
                onChange={setRows}
                kerf={settings.kerf}
                allowRotation={settings.allowRotation}
                families={catalog.families}
                catalog={catalog}
                specs={specs}
                onClear={() => setDialog({ kind: "clear-rows" })}
              />
            </div>

            {result && result.warnings.length > 0 && (
              <div className="no-print rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">
                <ul className="space-y-1">
                  {result.warnings.map((w) => (
                    <li key={`${w.pieceId}-${w.message}`}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result && current && (
              <div className="no-print">
                <ResultsPanel
                  strategies={result.strategies}
                  selected={selected}
                  bestId={result.bestId}
                  onSelect={(id) => {
                    skipWastePrefill.current = false;
                    lastPlanId.current = "";
                    setSelected(id);
                  }}
                  stock={stock}
                  specs={specs}
                />
              </div>
            )}

            {result && current && (
              <AtelierSheet
                projectName={projectMeta.name}
                clientName={projectMeta.clientName || settings.clientName}
                rows={rows}
                strategy={current}
                kerf={settings.kerf}
                wastePct={settings.wastePct}
                planWastePct={tauPlan}
                onWastePct={handleWastePct}
                onResetWaste={() => {
                  skipWastePrefill.current = false;
                  setSettings((s) => ({ ...s, wastePct: tauPlan }));
                }}
                supplier={liveSupplier}
                hardware={settings.hardwareItems}
                onPrint={() => printSheet("atelier")}
                onExportCsv={exportCsv}
                onExportDxf={exportDxf}
                planActions={{
                  interactive: true,
                  onStockOffcut: stockLeftover,
                  stockedKeys: stockedOffcutKeys,
                  onSwap: handleSwap,
                  onUndoSwap: handleUndoSwap,
                  canUndoSwap: !!lastSwap && lastSwap.strategyId === selected,
                  onLockLeftover: handleLock,
                  onUnlockLeftover: handleUnlock,
                  onRecalcPanel: handleRecalcPanel,
                }}
              />
            )}

            {result && current && current.unplaced.length > 0 && (
              <div className="no-print rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">
                Pièces non placées :{" "}
                {current.unplaced
                  .map((p) => `${p.name} ${p.w}×${p.h}`)
                  .join(", ")}
                . Vérifiez qu’elles tiennent dans une référence active
                {currentProject ? " de ce projet" : ""}.
              </div>
            )}

            {result && current && (
              <SupplierCostPanel
                live={liveSupplier}
                snapshot={
                  projects.find((p) => p.id === currentProjectId)?.supplierSnapshot ??
                  null
                }
                onEditPrices={() => setCatalogOpen(true)}
              />
            )}

            {result && current && (
              <JobNeedPanel
                need={jobNeed}
                items={stock}
                moves={moves}
                catalog={catalog}
                specs={specs}
                quoteNumber={settings.quoteNumber}
                projectId={currentProjectId}
                projectName={projectMeta.name}
                deduction={stockDeduction}
                onStock={(nextItems, nextMoves) => {
                  setStock(nextItems);
                  setMoves(nextMoves);
                }}
                onDeduction={(d) => {
                  setStockDeduction(d);
                  if (currentProjectId) {
                    setProjects((prev) =>
                      prev.map((p) =>
                        p.id === currentProjectId
                          ? {
                              ...p,
                              stockDeduction: d,
                              stockDeductedAt: d ? d.date : undefined,
                              updatedAt: new Date().toISOString(),
                            }
                          : p,
                      ),
                    );
                  }
                }}
              />
            )}

            <Card className="no-print">
              <CardContent className="p-5">
                <HardwareList
                  items={settings.hardwareItems}
                  onChange={(hardwareItems) =>
                    setSettings((s) => ({ ...s, hardwareItems }))
                  }
                  stock={stock}
                  onEnsureStock={(name, unitCost) =>
                    setStock((prev) => ensureStockArticle(prev, name, unitCost))
                  }
                />
              </CardContent>
            </Card>

            {!result && (
              <p className="no-print rounded-xl bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
                Saisissez votre débit puis lancez le calcul pour obtenir le nombre de
                panneaux et les plans de découpe.
              </p>
            )}

            <section className="no-print">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl bg-card px-5 py-4 text-left shadow-[var(--shadow-border)]"
                onClick={() => setAlgoOpen((v) => !v)}
                aria-expanded={algoOpen}
              >
                <span className="font-display text-base font-medium">
                  Comment le calepinage est calculé
                </span>
                <ChevronDown
                  className={algoOpen ? "size-4 rotate-180 transition-transform duration-150" : "size-4 transition-transform duration-150"}
                />
              </button>
              {algoOpen && (
                <div className="mt-2 rounded-xl bg-card px-5 py-4 text-sm leading-relaxed text-ink-soft shadow-[var(--shadow-border)]">
                  <p>
                    L’outil compare une stratégie par référence de panneau active, plus
                    un mix. Pour chaque stratégie, deux algorithmes de bin packing 2D
                    sont évalués :
                  </p>
                  <ul className="mt-3 list-disc space-y-2 pl-5">
                    <li>
                      <strong>Rectangles maximaux (MaxRects)</strong> — on place
                      chaque pièce dans le rectangle libre qui laisse le plus petit
                      reliquat (BSSF, Best Short Side Fit). Bon rendement, plans
                      parfois plus denses.
                    </li>
                    <li>
                      <strong>Guillotine</strong> — chaque placement fend le
                      panneau par des coupes droites successives. Plus proche d’une
                      découpe à la scie sur table.
                    </li>
                  </ul>
                  <p className="mt-3">
                    Le trait de scie gonfle chaque pièce et le panneau de la même
                    valeur. Une famille prioritaire restreint le calcul aux références
                    actives de cette famille — sans repli silencieux.
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {!catalogOpen && viewMode === "devis" && (
          <>
            <p className="no-print text-sm text-muted-foreground">
              Projet {projectMeta.name.trim() || "Sans titre"}
              {projectMeta.clientName ? ` · ${projectMeta.clientName}` : ""}
              . Les plans restent dans Atelier. Ici : devis client.
            </p>
            <div className="no-print flex flex-wrap items-center gap-2">
              <JobStatusBadge info={jobStatus} />
              {quoteIssuedAt ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuoteIssuedAt(new Date().toISOString())}
                >
                  Marquer le devis émis
                </Button>
              )}
            </div>
            <QuotePanel
              settings={settings}
              onChange={patchSettings}
              usefulAreaM2={autoSurfaceM2}
              purchasedAreaM2={purchasedAreaM2}
              planWastePct={tauPlan}
              livePricePerM2={liveSupplier?.weightedPricePerM2 ?? null}
              supplier={liveSupplier}
              onGenerateQuote={() => (current ? printClient() : goDevis())}
              onResetWaste={() => {
                skipWastePrefill.current = false;
                setSettings((s) => ({ ...s, wastePct: tauPlan }));
              }}
              onEditHardware={goAtelierHardware}
            />
            {result && current ? (
              <QuoteDocument
                settings={settings}
                onChange={patchSettings}
                selling={selling}
                strategy={current}
                supplier={liveSupplier}
                onPrint={() => printClient()}
              />
            ) : (
              <p className="no-print rounded-xl bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
                Calculez un débit dans Atelier pour prévisualiser le devis client.
              </p>
            )}
          </>
        )}
      </main>

      <footer
        className={cn(
          "app-footer no-print mx-auto w-full px-4 pb-10 text-xs text-muted-foreground sm:px-6",
          shellWidth,
        )}
      >
        Unités en millimètres. Atelier, stock et devis. Catalogue à part. Le projet
        est un fichier : enregistrez pour le conserver.
      </footer>

      <ConfirmDialog
        open={dialog.kind === "unsaved"}
        title="Modifications non enregistrées"
        message="Des modifications n’ont pas été enregistrées. Voulez-vous enregistrer avant de quitter ?"
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setDialog({ kind: "none" }),
          },
          {
            label: "Quitter sans enregistrer",
            variant: "outline",
            onClick: () => {
              if (dialog.kind !== "unsaved") return;
              const next = dialog.next;
              setDialog({ kind: "none" });
              next();
            },
          },
          {
            label: "Enregistrer",
            onClick: () => {
              if (dialog.kind !== "unsaved") return;
              const next = dialog.next;
              if (!projectMeta.name.trim()) {
                setPromptValue("");
                setDialog({ kind: "save-as", next });
                return;
              }
              if (saveNamed(projectMeta.name, false)) {
                setDialog({ kind: "none" });
                next();
              }
            },
          },
        ]}
      />

      <ConfirmDialog
        open={dialog.kind === "save-as"}
        title="Enregistrer sous"
        message="Donnez un nom à ce projet. Une copie indépendante sera créée."
        inputLabel="Nom du projet"
        placeholder="Étagère salon"
        value={promptValue}
        onValueChange={setPromptValue}
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setDialog({ kind: "none" }),
          },
          {
            label: "Enregistrer",
            onClick: () => {
              const next = dialog.kind === "save-as" ? dialog.next : undefined;
              if (saveNamed(promptValue, true)) {
                setDialog({ kind: "none" });
                next?.();
              }
            },
          },
        ]}
      />

      <ConfirmDialog
        open={dialog.kind === "rename"}
        title="Renommer le projet"
        message="Le nouveau nom remplace l’ancien, sans créer de doublon."
        inputLabel="Nouveau nom"
        value={promptValue}
        onValueChange={setPromptValue}
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setDialog({ kind: "none" }),
          },
          {
            label: "Renommer",
            onClick: () => {
              if (dialog.kind !== "rename") return;
              const trimmed = promptValue.trim();
              if (!trimmed) return;
              const clash = findProjectByName(projects, trimmed, dialog.id);
              if (clash) {
                setDialog({
                  kind: "alert",
                  title: "Nom déjà utilisé",
                  message: `Un projet nommé « ${trimmed} » existe déjà.`,
                });
                return;
              }
              setProjects((prev) =>
                prev.map((p) =>
                  p.id === dialog.id
                    ? { ...p, name: trimmed, updatedAt: new Date().toISOString() }
                    : p,
                ),
              );
              if (currentProjectId === dialog.id) {
                setProjectMeta((m) => ({ ...m, name: trimmed }));
              }
              setDialog({ kind: "none" });
              setFlash("Projet renommé.");
            },
          },
        ]}
      />

      <ConfirmDialog
        open={dialog.kind === "delete"}
        title="Supprimer le projet"
        message="Cette action est définitive. Le projet sera retiré de cet ordinateur."
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setDialog({ kind: "none" }),
          },
          {
            label: "Supprimer",
            variant: "destructive",
            onClick: () => {
              if (dialog.kind !== "delete") return;
              const id = dialog.id;
              setProjects((prev) => prev.filter((p) => p.id !== id));
              if (currentProjectId === id) resetWorkspace();
              setDialog({ kind: "none" });
              setFlash("Projet supprimé.");
            },
          },
        ]}
      />

      <ConfirmDialog
        open={dialog.kind === "import-dup"}
        title="Un projet porte déjà ce nom"
        message="Voulez-vous l’enregistrer sous un nouveau nom, ou remplacer le projet existant ?"
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setDialog({ kind: "none" }),
          },
          {
            label: "Nouveau nom",
            variant: "outline",
            onClick: () => {
              if (dialog.kind !== "import-dup") return;
              const name = uniqueImportedName(projects, dialog.project.name);
              applyImported({ ...dialog.project, name }, dialog.catalog, name);
              setDialog({ kind: "none" });
            },
          },
          {
            label: "Remplacer",
            onClick: () => {
              if (dialog.kind !== "import-dup") return;
              const existing = findProjectByName(projects, dialog.project.name);
              const merged = {
                ...dialog.project,
                id: existing?.id ?? dialog.project.id,
                createdAt: existing?.createdAt ?? dialog.project.createdAt,
              };
              applyImported(merged, dialog.catalog);
              setDialog({ kind: "none" });
            },
          },
        ]}
      />

      <ConfirmDialog
        open={dialog.kind === "clear-rows"}
        title="Vider la liste de débit"
        message="Toutes les pièces de ce projet seront effacées. Le calepinage sera perdu jusqu’au prochain calcul."
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setDialog({ kind: "none" }),
          },
          {
            label: "Vider la liste",
            variant: "destructive",
            onClick: () => {
              setRows([emptyRow()]);
              setResult(null);
              setError(null);
              setDialog({ kind: "none" });
            },
          },
        ]}
      />

      <ConfirmDialog
        open={dialog.kind === "alert"}
        title={dialog.kind === "alert" ? dialog.title : ""}
        message={dialog.kind === "alert" ? dialog.message : ""}
        actions={[
          {
            label: "OK",
            onClick: () => setDialog({ kind: "none" }),
          },
        ]}
      />

      <ConfirmDialog
        open={dialog.kind === "stock-plan-offcuts"}
        title="τ < chute du plan"
        message="Mettre les chutes du plan en stock ? Elles ne sont pas créées automatiquement. Le prochain calepinage s’en servira avant d’acheter une feuille neuve."
        actions={[
          {
            label: "Plus tard",
            variant: "ghost",
            onClick: () => setDialog({ kind: "none" }),
          },
          {
            label: "Mettre en stock",
            onClick: () => {
              stockAllPlanOffcuts();
              setDialog({ kind: "none" });
            },
          },
        ]}
      />
    </div>
  );
}

function Logo() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden
      className="shrink-0"
    >
      <rect width="40" height="40" rx="10" fill="#2c4a3e" />
      <rect x="7" y="10" width="26" height="6" rx="1.5" fill="#f4f1ea" />
      <rect x="7" y="18" width="26" height="8" rx="1.5" fill="#d4c4a8" />
      <rect x="7" y="28" width="16" height="5" rx="1.5" fill="#e7dfd2" />
    </svg>
  );
}
