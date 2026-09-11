import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CuttingPlanList } from "@/components/cutting-plan";
import type { StrategyResult } from "@/lib/packing";
import { hardwareLines } from "@/lib/pricing";
import type { PieceRow, HardwareItem } from "@/lib/types";
import type { SupplierCost } from "@/lib/supplier";
import { formatArea, formatEuro, formatPct } from "@/lib/utils";

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
}: Props) {
  const pieces = rows.filter(
    (r) =>
      String(r.length).trim() !== "" &&
      String(r.width).trim() !== "" &&
      Number(String(r.qty).replace(",", ".")) > 0,
  );
  const hw = hardwareLines(hardware).filter((l) => l.name && l.qty > 0);
  const lines = supplier?.lines ?? [];
  const dateLabel = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <section aria-labelledby="plans-title" className="flex flex-col gap-4">
      <article
        id="atelier-sheet"
        className="atelier-sheet rounded-xl bg-card px-5 py-6 shadow-[var(--shadow-border)] sm:px-8"
      >
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
          </dl>
        </header>

        <h3 className="mt-5 font-display text-base font-medium">Plans de découpe</h3>
        <p className="mt-1 text-sm text-muted-foreground no-print">
          La hachure représente la chute. Un ↻ indique une pièce tournée de 90°.
        </p>
        <div className="mt-3">
          <CuttingPlanList panels={strategy.panels} kerf={kerf} />
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
            Prérempli à la chute du plan. À côté du plan, pas dans le devis client.
          </p>
        </div>
        <p className="mt-3 print-only text-sm">
          Taux de perte retenu : {formatPct(wastePct)}
          {wastePct === tauPlan ? " (chute du plan)" : ""}
        </p>

        <h3 className="mt-5 font-display text-base font-medium">Liste de débit</h3>
        <table className="quote-table mt-2 w-full text-sm">
          <thead>
            <tr>
              <th>Pièce</th>
              <th>Longueur</th>
              <th>Largeur</th>
              <th className="num">Qté</th>
            </tr>
          </thead>
          <tbody>
            {pieces.length === 0 ? (
              <tr>
                <td colSpan={4}>Aucune pièce</td>
              </tr>
            ) : (
              pieces.map((r) => (
                <tr key={r.id}>
                  <td>{r.name || "—"}</td>
                  <td className="tabular-nums">{r.length} mm</td>
                  <td className="tabular-nums">{r.width} mm</td>
                  <td className="num">{r.qty}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h3 className="mt-5 font-display text-base font-medium">Besoin matière</h3>
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
                <td colSpan={4}>Aucun panneau</td>
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
      </article>

      <div className="no-print flex justify-end">
        <Button type="button" onClick={onPrint}>
          <Printer />
          Fiche atelier / PDF
        </Button>
      </div>
    </section>
  );
}
