import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SupplierCost } from "@/lib/supplier";
import { formatEuro } from "@/lib/utils";

type Props = {
  live: SupplierCost | null;
  snapshot: SupplierCost | null;
  onEditPrices?: () => void;
};

function areaLabel(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function SupplierCostPanel({
  live,
  snapshot,
  onEditPrices,
}: Props) {
  const cost = live;
  if (!cost || cost.lines.length === 0) return null;
  const historic =
    snapshot &&
    snapshot.lines.length > 0 &&
    (snapshot.weightedPricePerM2 !== cost.weightedPricePerM2 ||
      snapshot.totalCost !== cost.totalCost);

  return (
    <section aria-labelledby="fournisseur-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <h2
            id="fournisseur-title"
            className="font-display text-xl font-medium tracking-tight"
          >
            Achat fournisseur
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Moyenne pondérée par la surface achetée : Σ (surface × prix) / Σ
            surface. Ce n’est pas une moyenne des tarifs catalogue. Ce prix
            alimente le devis.
          </p>

          {cost.missing.length > 0 && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-card px-3 py-3 text-sm text-destructive">
              <p>
                Prix manquant pour{" "}
                {cost.missing.map((m) => m.label).join(", ")}. Aucun montant n’est
                inventé. Complétez le prix au m² dans Familles et références, puis
                le calcul se met à jour.
              </p>
              {onEditPrices && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onEditPrices}
                >
                  Compléter les prix
                </Button>
              )}
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Référence</th>
                  <th className="px-3 py-2.5 font-medium">Famille</th>
                  <th className="px-3 py-2.5 font-medium">Qté</th>
                  <th className="px-3 py-2.5 font-medium">Surface</th>
                  <th className="px-3 py-2.5 font-medium">Prix €/m²</th>
                  <th className="px-3 py-2.5 font-medium">Coût</th>
                </tr>
              </thead>
              <tbody>
                {cost.lines.map((l) => (
                  <tr key={l.specId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {l.familyName || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{l.qty}</td>
                    <td className="px-3 py-2 tabular-nums">{areaLabel(l.areaM2)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {l.pricePerM2 != null ? formatEuro(l.pricePerM2) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {l.cost != null ? formatEuro(l.cost) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Surface achetée</dt>
              <dd className="font-medium tabular-nums">{areaLabel(cost.totalAreaM2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Prix moyen pondéré</dt>
              <dd className="font-medium tabular-nums">
                {cost.weightedPricePerM2 != null
                  ? `${formatEuro(cost.weightedPricePerM2)}/m²`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total achat fournisseur</dt>
              <dd className="font-medium tabular-nums">
                {cost.totalCost != null ? formatEuro(cost.totalCost) : "prix incomplet"}
              </dd>
            </div>
          </dl>

          {historic && snapshot && (
            <div className="mt-4 rounded-lg bg-muted/70 px-3 py-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Historique du projet</Badge>
                <span className="text-muted-foreground">
                  Prix enregistrés à la sauvegarde — inchangés si le catalogue
                  évolue.
                </span>
              </div>
              <p className="mt-2 tabular-nums">
                {snapshot.totalAreaM2.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                m² · moyenne{" "}
                {snapshot.weightedPricePerM2 != null
                  ? `${formatEuro(snapshot.weightedPricePerM2)}/m²`
                  : "—"}{" "}
                · total{" "}
                {snapshot.totalCost != null ? formatEuro(snapshot.totalCost) : "—"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
