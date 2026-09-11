import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Printer,
  Calculator,
  ChevronDown,
  Package,
  Layers,
  FolderOpen,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieceList } from "@/components/piece-list";
import { SettingsBar } from "@/components/settings-bar";
import { ResultsPanel } from "@/components/results-panel";
import { QuotePanel } from "@/components/quote-panel";
import { QuoteDocument } from "@/components/quote-document";
import { CuttingPlanList } from "@/components/cutting-plan";
import { StockPanel } from "@/components/stock-panel";
import { CatalogPanel } from "@/components/catalog-panel";
import { ProjectsBar } from "@/components/projects-bar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { JobNeedPanel } from "@/components/job-need-panel";
import { SupplierCostPanel } from "@/components/supplier-cost-panel";
import {
  optimizeCutting,
  type OptimizeOutput,
  type PieceDef,
  type StrategyId,
} from "@/lib/packing";
import { sellingFromInputs } from "@/lib/pricing";
import {
  ensureStockArticle,
  exampleStock,
  jobNeedFromQuote,
  syncStockWithCatalog,
  type StockDeduction,
  type StockItem,
  type StockMove,
} from "@/lib/stock";
import {
  emptyRow,
  INITIAL_EMPTY_ROW,
  defaultQuoteIdentity,
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
} from "@/lib/projects";
import {
  emptyMeta,
  exportText,
  importText,
  loadPersisted,
  savePersisted,
  type ProjectMeta,
} from "@/lib/persist";
import type { AppSettings, PieceRow } from "@/lib/types";
import { supplierCostFromCounts } from "@/lib/supplier";

export const Route = createFileRoute("/")({ component: Home });

const DEFAULT_SETTINGS: AppSettings = {
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
  hardwareItems: [{ id: "hw-empty-1", name: "", qty: "1", unitPrice: "" }],
};

type AppTab = "projet" | "catalogue" | "stocks";

type DialogState =
  | { kind: "none" }
  | { kind: "unsaved"; next: () => void }
  | { kind: "save-as"; next?: () => void }
  | { kind: "rename"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "import-dup"; project: Project; catalog?: Catalog }
  | { kind: "alert"; title: string; message: string };

function parseRows(rows: PieceRow[], catalog: Catalog): PieceDef[] {
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      length: Number(String(r.length).replace(",", ".")),
      width: Number(String(r.width).replace(",", ".")),
      qty: Math.floor(Number(String(r.qty).replace(",", "."))),
      familyId: r.familyId || null,
      familyName: catalog.families.find((f) => f.id === r.familyId)?.name ?? null,
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
      if (n > 0) ids.add(id);
    }
    for (const p of s.panels) ids.add(p.format);
  }
  return [...ids];
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
  const [tab, setTab] = useState<AppTab>("projet");
  const skipNextPack = useRef(false);

  const liveFp = useMemo(
    () => fpOf({ rows, settings, selected, meta: projectMeta }),
    [rows, settings, selected, projectMeta],
  );
  const dirty = hydrated && liveFp !== savedFp;

  const specs = useMemo(
    () => packingSpecs(catalog, usedRefIds),
    [catalog, usedRefIds],
  );

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
        setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
        const stockSynced = syncStockWithCatalog(saved.stock, saved.catalog);
        setStock(stockSynced);
        setMoves(saved.moves);
        setCatalog(saved.catalog);
        setProjects(saved.projects);
        setCurrentProjectId(saved.currentProjectId);
        setProjectMeta(saved.projectMeta);
        setUsedRefIds(saved.usedRefIds);
        setSelected(saved.selectedStrategy || "mixed");
        const named = saved.projects.find((p) => p.id === saved.currentProjectId);
        setStockDeduction(named?.stockDeduction ?? saved.stockDeduction ?? null);
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
                settings: { ...DEFAULT_SETTINGS, ...saved.settings },
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
  ]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextPack.current) {
      skipNextPack.current = false;
    }
    const defs = parseRows(rows, catalog);
    if (defs.length === 0) {
      setResult(null);
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
    });
    setResult(out);
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

  function calculate() {
    const defs = parseRows(rows, catalog);
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
    });
    setResult(out);
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

  const autoSurfaceM2 = current ? current.usedArea / 1_000_000 : 0;
  const surfaceM2 = settings.surfaceOverrideM2 ?? autoSurfaceM2;
  const selling = useMemo(
    () =>
      sellingFromInputs(
        surfaceM2,
        settings.pricePerM2,
        settings.wastePct,
        settings.laborHours,
        settings.hourlyRate,
        settings.hardwareItems,
        settings.marginPct,
      ),
    [
      surfaceM2,
      settings.pricePerM2,
      settings.wastePct,
      settings.laborHours,
      settings.hourlyRate,
      settings.hardwareItems,
      settings.marginPct,
    ],
  );

  function generateQuote() {
    const el = document.getElementById("quote-sheet");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const specLabels = useMemo(
    () => Object.fromEntries(specs.map((s) => [s.id, s.label])),
    [specs],
  );

  const jobNeed = current
    ? jobNeedFromQuote(current.counts, settings.hardwareItems, specLabels)
    : null;

  const liveSupplier = useMemo(
    () =>
      current
        ? supplierCostFromCounts(current.counts, specs)
        : null,
    [current, specs],
  );

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
    const nextSettings = { ...settings, surfaceOverrideM2: null };
    skipNextPack.current = true;
    setRows(nextRows);
    setResult(null);
    setError(null);
    setCurrentProjectId(null);
    setProjectMeta(nextMeta);
    setUsedRefIds([]);
    setSelected("mixed");
    setSettings(nextSettings);
    setStockDeduction(null);
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
    setRows(p.rows.length > 0 ? p.rows : [emptyRow()]);
    setSettings({ ...DEFAULT_SETTINGS, ...p.settings });
    setSelected(p.selectedStrategy || "mixed");
    setStockDeduction(p.stockDeduction ?? null);
    rememberSaved(p);
    setError(null);
    setFlash(`Projet « ${p.name} » ouvert.`);
    setTab("projet");
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

  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="font-display text-xl font-medium tracking-tight">Débit Bois</p>
              <p className="text-sm text-muted-foreground">
                Calepinage, devis et projets — références de panneaux paramétrables
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={tab === "projet" ? "default" : "outline"}
              onClick={() => setTab("projet")}
            >
              <FolderOpen />
              Projet
            </Button>
            <Button
              type="button"
              variant={tab === "catalogue" ? "default" : "outline"}
              onClick={() => setTab("catalogue")}
            >
              <Layers />
              Familles et références
            </Button>
            <Button
              type="button"
              variant={tab === "stocks" ? "default" : "outline"}
              onClick={() => setTab("stocks")}
            >
              <Package />
              Stocks atelier
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTab("projet");
                generateQuote();
                window.print();
              }}
              disabled={!result || !selling.ok}
            >
              <Printer />
              Imprimer / PDF
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTab("projet");
                generateQuote();
              }}
              disabled={!result || !selling.ok}
            >
              <FileText />
              Générer le devis
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
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

        {tab === "catalogue" && (
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

        {tab === "stocks" && (
          <StockPanel
            items={stock}
            moves={moves}
            onItems={setStock}
            onMoves={setMoves}
            catalog={catalog}
          />
        )}

        {tab === "projet" && (
          <>
        <ProjectsBar
          meta={projectMeta}
          onMeta={(patch) => setProjectMeta((m) => ({ ...m, ...patch }))}
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
                onClick={() => {
                  setRows([emptyRow()]);
                  setResult(null);
                  setError(null);
                }}
              >
                Vider la liste
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
              onSelect={setSelected}
              pricePerM2={settings.pricePerM2}
              stock={stock}
              specs={specs}
            />
          </div>
        )}

        {result && current && (
          <SupplierCostPanel
            live={liveSupplier}
            snapshot={
              projects.find((p) => p.id === currentProjectId)?.supplierSnapshot ??
              null
            }
            onApplyToQuote={(pricePerM2) => {
              setSettings((s) => ({ ...s, pricePerM2 }));
              setFlash("Prix moyen fournisseur appliqué au devis.");
            }}
            onEditPrices={() => setTab("catalogue")}
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
                          updatedAt: new Date().toISOString(),
                        }
                      : p,
                  ),
                );
              }
            }}
          />
        )}

        {result && current && (
          <>
            <div className="no-print">
              <QuotePanel
                settings={settings}
                onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                autoSurfaceM2={autoSurfaceM2}
                purchasedAreaMm2={current.purchasedArea}
                onGenerateQuote={generateQuote}
                stock={stock}
                onEnsureStock={(name, unitCost) =>
                  setStock((prev) => ensureStockArticle(prev, name, unitCost))
                }
              />
            </div>

            {selling.ok && (
              <QuoteDocument
                settings={settings}
                onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                selling={selling}
                strategy={current}
                stock={stock}
                specs={specs}
              />
            )}

            {current.unplaced.length > 0 && (
              <div className="no-print rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">
                Pièces non placées :{" "}
                {current.unplaced
                  .map((p) => `${p.name} ${p.w}×${p.h}`)
                  .join(", ")}
                . Vérifiez qu’elles tiennent dans une référence active
                {currentProject ? " de ce projet" : ""}.
              </div>
            )}

            <section
              aria-labelledby="plans-title"
              className="no-print flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2
                    id="plans-title"
                    className="font-display text-xl font-medium tracking-tight"
                  >
                    Plans de découpe
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La hachure représente la chute. Un ↻ indique une pièce tournée
                    de 90°.
                  </p>
                </div>
              </div>
              <CuttingPlanList panels={current.panels} kerf={settings.kerf} />
            </section>
          </>
        )}

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
                valeur : les pièces sont séparées du kerf, sans « faux trait »
                sur le bord du panneau. La rotation 90° est testée si elle est
                activée. La stratégie retenue est celle qui minimise la surface
                achetée, à pièces toutes placées. Une famille prioritaire sur une
                pièce restreint le calcul aux références actives de cette famille
                — sans repli silencieux sur une autre famille.
              </p>
              <p className="mt-3">
                Le prix de vente valorise la surface utile du débit : prix réel
                au m² = prix fournisseur / (1 − taux de perte), puis on ajoute
                main d’œuvre (temps × taux) et quincaillerie (somme des
                articles), et on divise par (1 − marge). Les stocks atelier
                rapprochent panneaux et quincaillerie du besoin du chantier.
              </p>
            </div>
          )}
        </section>
          </>
        )}
      </main>

      <footer className="app-footer no-print mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Unités en millimètres. Familles, références et stocks sont globaux. Les
        projets conservent l’historique des prix et des déductions.
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
