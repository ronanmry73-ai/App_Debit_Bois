import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CuttingPlanList, type PlanActions } from "@/components/cutting-plan";
import type { StrategyResult } from "@/lib/packing";
import { stockableLeftovers } from "@/lib/packing";
import { hardwareLines } from "@/lib/pricing";
import type { PieceRow, HardwareItem } from "@/lib/types";
import { GRAIN_LABEL, groupPieceRows } from "@/lib/piece-io";
import { pieceLabelRows } from "@/lib/saw-export";
import type { SupplierCost } from "@/lib/supplier";
import { formatArea, formatPct } from "@/lib/utils";

type Props = {
  projectName: string;
  clientName: string;
  rows: PieceRow[];
  strategy: StrategyResult;
  kerf: number;
  wastePct: number;
  planWastePct: number;
  onWastePct: (n: number) => void;
  onResetWaste: () => void;
  supplier: SupplierCost | null;
  hardware: HardwareItem[];
  onPrint: () => void;
  planActions?: PlanActions;
  onExportCsv?: () => void;
  onExportDxf?: () => void;
};

function areaLabel(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function AtelierSheet({
  projectName,
  clientName,
  rows,
  strategy,
  kerf,
  wastePct,
  planWastePct: tauPlan,
  onWastePct,
  onResetWaste,
  supplier,
  hardware,
  onPrint,
  planActions,
  onExportCsv,
  onExportDxf,
}: Props) {
  const pieces = rows.filter(
    (r) =>
      String(r.length).trim() !== "" &&
      String(r.width).trim() !== "" &&
      Number(String(r.qty).replace(",", ".")) > 0,
  );
  const buckets = groupPieceRows(pieces);
  const sectioned = buckets.some((b) => b.key !== "") && buckets.length > 1;
  const hw = hardwareLines(hardware).filter((l) => l.name && l.qty > 0);
  const lines = supplier?.lines ?? [];
  const dateLabel = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const offcutsOut = strategy.offcutsUsed ?? [];
  const leftoversIn = strategy.panels.flatMap((p) =>
    stockableLeftovers(p, kerf).map((r) => ({
      panel: p.index,
      w: r.w,
      h: r.h,
    })),
  );
  const sheetCount = Object.values(strategy.counts).reduce((s, n) => s + n, 0);
  const offcutCount = offcutsOut.reduce((s, o) => s + o.qty, 0);

  return (
    <section aria-labelledby="plans-title" className="flex flex-col gap-4">
      <article
        id="atelier-sheet"
        className="atelier-sheet rounded-xl bg-card px-5 py-6 shadow-[var(--shadow-border)] sm:px-8"
      >
        <div className="print-page">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fiche atelier
              </p>
              <h2
                id="plans-title"
                className="font-display text-2xl font-medium tracking-tight"
              >
                {projectName.trim() || "Sans titre"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {clientName.trim() ? `Chantier · ${clientName}` : "Chantier interne"}
                {" · "}
                {dateLabel}
              </p>
            </div>
            <dl className="text-sm tabular-nums text-right">
              <div>
                <dt className="text-muted-foreground">Chute du plan</dt>
                <dd className="font-medium">{formatPct(strategy.wastePercent)}</dd>
              </div>
              <div className="mt-1">
                <dt className="text-muted-foreground">Surface achetée</dt>
                <dd className="font-medium">{formatArea(strategy.purchasedArea)}</dd>
              </div>
              <div className="mt-1">
                <dt className="text-muted-foreground">À sortir</dt>
                <dd className="font-medium">
                  {sheetCount} feuille{sheetCount > 1 ? "s" : ""}
                  {offcutCount > 0
                    ? ` · ${offcutCount} chute${offcutCount > 1 ? "s" : ""}`
                    : ""}
                </dd>
              </div>
            </dl>
          </header>

          <h3 className="mt-5 font-display text-base font-medium">Liste de débit</h3>
          {sectioned ? (
            <div className="mt-2 flex flex-col gap-4">
              {buckets.map((b) => (
                <div key={b.key || "none"}>
                  <p className="text-sm font-medium">
                    {b.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      {b.qty} pièce{b.qty > 1 ? "s" : ""} ·{" "}
                      {(b.areaMm2 / 1_000_000).toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      m²
                    </span>
                  </p>
                  <DebitTable rows={b.rows} />
                </div>
              ))}
            </div>
          ) : (
            <DebitTable rows={pieces} />
          )}

          <h3 className="mt-5 font-display text-base font-medium">
            Feuilles à sortir
          </h3>
          <table className="quote-table mt-2 w-full text-sm">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Famille</th>
                <th className="num">Qté</th>
                <th className="num">Surface</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4}>Aucune feuille neuve</td>
                </tr>
              ) : (
                lines.map((l) => (
                  <tr key={l.specId}>
                    <td>{l.name}</td>
                    <td>{l.familyName || "—"}</td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{areaLabel(l.areaM2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {supplier?.missing && supplier.missing.length > 0 && (
            <p className="mt-2 text-sm text-destructive">
              Prix incomplet pour {supplier.missing.map((m) => m.label).join(", ")}.
            </p>
          )}

          <h3 className="mt-5 font-display text-base font-medium">
            Chutes à sortir
          </h3>
          {offcutsOut.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucune chute stock.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {offcutsOut.map((o) => (
                <li key={o.stockItemId} className="flex justify-between gap-3">
                  <span>
                    {o.name}{" "}
                    <span className="text-muted-foreground">(stock)</span>
                  </span>
                  <span className="tabular-nums">
                    {o.qty} · {Math.round(o.length)} × {Math.round(o.width)} mm
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 font-display text-base font-medium">
            Chutes à réintégrer
          </h3>
          {leftoversIn.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune chute assez grande (petit côté ≥ 300 mm ou 0,05 m²).
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {leftoversIn.map((r, i) => (
                <li key={`${r.panel}-${i}`} className="tabular-nums">
                  P{r.panel} · {Math.round(r.w)} × {Math.round(r.h)} mm
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 font-display text-base font-medium">
            Quincaillerie à sortir
          </h3>
          {hw.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucun article.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {hw.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span>{l.name}</span>
                  <span className="tabular-nums">{l.qty}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 font-display text-base font-medium">
            Étiquettes pièces
          </h3>
          <table className="quote-table mt-2 w-full text-sm">
            <thead>
              <tr>
                <th>Nom</th>
                <th>L × l</th>
                <th className="num">Qté</th>
                <th>n° panneau</th>
                <th>Groupe</th>
                <th>Fil imposé</th>
              </tr>
            </thead>
            <tbody>
              {strategy.panels.flatMap((p) =>
                pieceLabelRows(p, rows).map((l, i) => (
                  <tr key={`${p.id}-${l.code}-${i}`}>
                    <td>{l.name}</td>
                    <td className="tabular-nums">{l.dims}</td>
                    <td className="num">{l.qty}</td>
                    <td>{l.panel}</td>
                    <td>{l.group || "—"}</td>
                    <td>{l.grainLocked ? "oui" : "non"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 font-display text-base font-medium">Plans de découpe</h3>
        <p className="mt-1 text-sm text-muted-foreground no-print">
          La hachure représente la chute. Un ↻ indique une pièce tournée de 90°.
          Cotes en mm. Guillotine : numéro d’ordre de coupe. Un panneau par page
          à l’impression.
        </p>
        <div className="mt-3">
          <CuttingPlanList
            panels={strategy.panels}
            kerf={kerf}
            actions={planActions}
          />
        </div>

        <div className="mt-5 no-print rounded-lg bg-muted/70 px-4 py-3">
          <Label htmlFor="atelier-waste">Taux de perte (jugement)</Label>
          <div className="mt-1.5 flex flex-wrap items-end gap-3">
            <div className="relative max-w-36">
              <Input
                id="atelier-waste"
                inputMode="decimal"
                className="pr-10 tabular-nums"
                value={String(wastePct)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  onWastePct(Number.isFinite(n) ? n : 0);
                }}
                aria-label="Taux de perte"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                %
              </span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onResetWaste}>
              Reprendre la chute du plan ({formatPct(tauPlan)})
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Prérempli à la chute du plan. Si vous baissez τ, proposez de mettre
            les chutes en stock — elles ne sont pas créées automatiquement.
          </p>
        </div>
        <p className="mt-3 print-only text-sm">
          Taux de perte retenu : {formatPct(wastePct)}
          {wastePct === tauPlan ? " (chute du plan)" : ""}
        </p>
      </article>

      <div className="no-print flex flex-wrap justify-end gap-2">
        {onExportCsv && (
          <Button type="button" variant="outline" onClick={onExportCsv}>
            <FileDown />
            CSV scie
          </Button>
        )}
        {onExportDxf && (
          <Button type="button" variant="outline" onClick={onExportDxf}>
            <FileDown />
            DXF
          </Button>
        )}
        <Button type="button" onClick={onPrint}>
          <Printer />
          Fiche atelier / PDF
        </Button>
      </div>
    </section>
  );
}

function DebitTable({ rows }: { rows: PieceRow[] }) {
  return (
    <table className="quote-table mt-2 w-full text-sm">
      <thead>
        <tr>
          <th>Pièce</th>
          <th>Longueur</th>
          <th>Largeur</th>
          <th className="num">Qté</th>
          <th>Fil</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5}>Aucune pièce</td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name || "—"}</td>
              <td className="tabular-nums">{r.length} mm</td>
              <td className="tabular-nums">{r.width} mm</td>
              <td className="num">{r.qty}</td>
              <td>{GRAIN_LABEL[r.grain ?? "default"]}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
