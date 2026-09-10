import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer, RotateCcw, Calculator, ChevronDown, Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieceList } from "@/components/piece-list";
import { SettingsBar } from "@/components/settings-bar";
import { ResultsPanel } from "@/components/results-panel";
import { QuotePanel } from "@/components/quote-panel";
import { QuoteDocument } from "@/components/quote-document";
import { CuttingPlanList } from "@/components/cutting-plan";
import { StockPanel } from "@/components/stock-panel";
import {
  optimizeCutting,
  type OptimizeOutput,
  type PieceDef,
  type StrategyId,
} from "@/lib/packing";
import { sellingFromInputs } from "@/lib/pricing";
import {
  ensurePanelRows,
  ensureStockArticle,
  exampleStock,
  jobNeedFromQuote,
  type StockItem,
  type StockMove,
} from "@/lib/stock";
import {
  exampleRows,
  exampleQuoteRows,
  exampleQuotePatch,
  emptyRow,
  defaultQuoteIdentity,
  STORAGE_KEY,
} from "@/lib/presets";
import type { AppSettings, PieceRow } from "@/lib/types";

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

function parseRows(rows: PieceRow[]): PieceDef[] {
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      length: Number(String(r.length).replace(",", ".")),
      width: Number(String(r.width).replace(",", ".")),
      qty: Math.floor(Number(String(r.qty).replace(",", "."))),
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

function Home() {
  const [rows, setRows] = useState<PieceRow[]>(exampleRows);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<OptimizeOutput | null>(null);
  const [selected, setSelected] = useState<StrategyId>("mixed");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [algoOpen, setAlgoOpen] = useState(false);
  const [stock, setStock] = useState<StockItem[]>(exampleStock);
  const [moves, setMoves] = useState<StockMove[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          rows?: PieceRow[];
          settings?: AppSettings;
          stock?: StockItem[];
          moves?: StockMove[];
        };
        if (Array.isArray(saved.rows) && saved.rows.length > 0) {
          setRows(saved.rows);
        }
        if (saved.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
        }
        if (Array.isArray(saved.stock) && saved.stock.length > 0) {
          setStock(ensurePanelRows(saved.stock));
        }
        if (Array.isArray(saved.moves)) {
          setMoves(saved.moves);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const defs = parseRows(rows);
    if (defs.length === 0) {
      setResult(null);
      return;
    }
    const totalQty = defs.reduce((s, d) => s + d.qty, 0);
    if (totalQty > 400) {
      setError("Limitez le débit à 400 pièces pour garder le calcul instantané.");
      return;
    }
    setError(null);
    const out = optimizeCutting(defs, {
      kerf: settings.kerf,
      allowRotation: settings.allowRotation,
      method: settings.method,
    });
    setResult(out);
    setSelected((prev) =>
      out.strategies.some((s) => s.id === prev) ? prev : out.bestId,
    );
  }, [
    hydrated,
    rows,
    settings.kerf,
    settings.allowRotation,
    settings.method,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rows, settings, stock, moves }),
    );
  }, [rows, settings, stock, moves, hydrated]);

  function calculate() {
    const defs = parseRows(rows);
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
    setError(null);
    const out = optimizeCutting(defs, settings);
    setResult(out);
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

  const jobNeed = current
    ? jobNeedFromQuote(current.counts, settings.hardwareItems)
    : null;

  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="font-display text-xl font-medium tracking-tight">Débit Bois</p>
              <p className="text-sm text-muted-foreground">
                Panneaux 2500 × 400 mm et 2500 × 600 mm
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const next = exampleRows();
                setSettings((s) => ({ ...s, surfaceOverrideM2: null }));
                setRows(next);
                setError(null);
                const out = optimizeCutting(parseRows(next), settings);
                setResult(out);
                setSelected(out.bestId);
              }}
            >
              <RotateCcw />
              Exemple
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const next = exampleQuoteRows();
                const nextSettings = { ...settings, ...exampleQuotePatch() };
                setSettings(nextSettings);
                setRows(next);
                setError(null);
                const out = optimizeCutting(parseRows(next), nextSettings);
                setResult(out);
                setSelected(out.bestId);
                requestAnimationFrame(() =>
                  document.getElementById("quote-sheet")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  }),
                );
              }}
            >
              Exemple devis
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                document.getElementById("stocks")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              <Package />
              Stocks
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
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
              onClick={generateQuote}
              disabled={!result || !selling.ok}
            >
              <FileText />
              Générer le devis
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">

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
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="no-print">
          <PieceList
            rows={rows}
            onChange={setRows}
            kerf={settings.kerf}
            allowRotation={settings.allowRotation}
          />
        </div>

        {result && current && (
          <div className="no-print">
            <ResultsPanel
              strategies={result.strategies}
              selected={selected}
              bestId={result.bestId}
              onSelect={setSelected}
              pricePerM2={settings.pricePerM2}
              stock={stock}
            />
          </div>
        )}

        <StockPanel
          items={stock}
          moves={moves}
          onItems={setStock}
          onMoves={setMoves}
          need={jobNeed}
          quoteNumber={settings.quoteNumber}
        />

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
              />
            )}

            {current.unplaced.length > 0 && (
              <div className="no-print rounded-xl border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">
                Pièces non placées :{" "}
                {current.unplaced
                  .map((p) => `${p.name} ${p.w}×${p.h}`)
                  .join(", ")}
                . Vérifiez qu’elles tiennent dans 2500 × 600 mm (trait de scie
                compris).
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
                L’outil compare trois stratégies d’achat : uniquement des
                panneaux 2500 × 400, uniquement des 2500 × 600, et un mix des
                deux. Pour chaque stratégie, deux algorithmes de bin packing 2D
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
                achetée, à pièces toutes placées.
              </p>
              <p className="mt-3">
                Le prix de vente valorise la surface utile du débit : prix réel
                au m² = prix fournisseur / (1 − taux de perte), puis on ajoute
                main d’œuvre (temps × taux) et quincaillerie (somme des
                articles), et on divise par (1 − marge). Exemple devis : 40 €/m²,
                2 m², 15 % de perte, 2,5 h à 40 €/h, 30 € de quincaillerie, 30 %
                de marge → 320,17 € HT. Les stocks atelier rapprochent panneaux
                et quincaillerie du besoin du chantier, et permettent de déduire
                les sorties.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer no-print mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Unités en millimètres. Les panneaux d’achat sont fixes : 2500 × 400 mm et
        2500 × 600 mm.
      </footer>
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
