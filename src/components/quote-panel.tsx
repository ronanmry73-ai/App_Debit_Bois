import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { HardwareList } from "@/components/hardware-list";
import type { AppSettings, HardwareItem } from "@/lib/types";
import type { StockItem } from "@/lib/stock";
import type { SupplierCost } from "@/lib/supplier";
import {
  incompleteSelling,
  laborCost,
  sellingFromInputs,
  type SellingOk,
  type SellingResult,
} from "@/lib/pricing";
import { formatEuro, formatPct } from "@/lib/utils";

type Props = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  usefulAreaM2: number;
  purchasedAreaM2: number;
  planWastePct: number;
  livePricePerM2: number | null;
  supplier: SupplierCost | null;
  onGenerateQuote: () => void;
  onResetWaste: () => void;
  stock?: StockItem[];
  onEnsureStock?: (name: string, unitCost: number) => void;
};

function parseNum(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function m2Label(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function QuotePanel({
  settings,
  onChange,
  usefulAreaM2,
  purchasedAreaM2,
  planWastePct: tauPlan,
  livePricePerM2,
  supplier,
  onGenerateQuote,
  onResetWaste,
  stock = [],
  onEnsureStock,
}: Props) {
  const forced = !!settings.forcePricePerM2;
  const purchasePrice =
    forced && settings.pricePerM2 != null && settings.pricePerM2 > 0
      ? settings.pricePerM2
      : livePricePerM2;
  const surfaceM2 = settings.surfaceOverrideM2 ?? usefulAreaM2;
  const mo = laborCost(settings.laborHours, settings.hourlyRate);
  const selling: SellingResult =
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
      : incompleteSelling();
  const incomplete = !selling.ok && selling.incomplete === true;
  const cAchat = supplier?.totalCost ?? null;

  return (
    <section aria-labelledby="devis-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <h2
            id="devis-title"
            className="font-display text-xl font-medium tracking-tight"
          >
            Prix de vente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            L’achat est mécanique (prix moyen × surface achetée). Le taux de
            perte est un jugement : reprenez la chute du plan, montez-le si
            elle est morte, baissez-le si elle est réutilisable.
          </p>

          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <ReadStat label="Surface achetée" value={m2Label(purchasedAreaM2)} hint="feuilles du calepinage" />
            <ReadStat label="Surface utile" value={m2Label(usefulAreaM2)} hint="pièces dans le meuble" />
            <ReadStat
              label="Chute du plan"
              value={formatPct(tauPlan)}
              hint="100 × (1 − utile / achetée)"
            />
          </dl>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="price-m2">Prix d’achat fournisseur</Label>
                {incomplete ? (
                  <Badge variant="warn">incomplet</Badge>
                ) : forced ? (
                  <Badge variant="outline">modifié manuellement</Badge>
                ) : (
                  <Badge variant="good">calculé</Badge>
                )}
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="price-m2"
                  inputMode="decimal"
                  readOnly={!forced}
                  value={
                    forced
                      ? String(settings.pricePerM2 ?? "")
                      : purchasePrice != null
                        ? String(purchasePrice)
                        : ""
                  }
                  placeholder="—"
                  onChange={(e) => {
                    if (!forced) return;
                    onChange({ pricePerM2: parseNum(e.target.value) });
                  }}
                  className="pr-14 tabular-nums"
                  aria-label="Prix d’achat fournisseur au mètre carré"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  €/m²
                </span>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <Switch
                  checked={forced}
                  onCheckedChange={(on) =>
                    onChange({
                      forcePricePerM2: on,
                      pricePerM2: on
                        ? (livePricePerM2 ?? settings.pricePerM2)
                        : settings.pricePerM2,
                    })
                  }
                  aria-label="Forcer le prix d’achat"
                />
                Forcer le prix d’achat
              </label>
            </div>

            <div>
              <Label htmlFor="surface-m2">Surface utile au devis</Label>
              <div className="relative mt-1.5">
                <Input
                  id="surface-m2"
                  inputMode="decimal"
                  readOnly={settings.surfaceOverrideM2 == null}
                  value={
                    settings.surfaceOverrideM2 != null
                      ? String(settings.surfaceOverrideM2)
                      : String(
                          Number(usefulAreaM2.toFixed(4)).toString(),
                        )
                  }
                  onChange={(e) =>
                    onChange({ surfaceOverrideM2: parseNum(e.target.value) })
                  }
                  className="pr-12 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  m²
                </span>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.surfaceOverrideM2 != null}
                  onCheckedChange={(on) =>
                    onChange({
                      surfaceOverrideM2: on ? usefulAreaM2 : null,
                    })
                  }
                  aria-label="Forcer la surface utile"
                />
                Forcer la surface utile
              </label>
            </div>

            <div>
              <Field
                id="waste"
                label="Taux de perte / chute"
                suffix="%"
                value={settings.wastePct}
                onChange={(wastePct) => onChange({ wastePct })}
                hint={`Chute du plan ${formatPct(tauPlan)}`}
              />
              <Button
                type="button"
                variant="ghost"
                className="mt-1 h-auto px-0 py-0 text-xs"
                onClick={onResetWaste}
              >
                Reprendre la chute du plan
              </Button>
            </div>

            <Field
              id="labor-hours"
              label="Temps de travail"
              suffix="h"
              value={settings.laborHours}
              onChange={(laborHours) => onChange({ laborHours })}
            />
            <Field
              id="hourly-rate"
              label="Taux horaire"
              suffix="€/h"
              value={settings.hourlyRate}
              onChange={(hourlyRate) => onChange({ hourlyRate })}
            />
            <div className="rounded-lg bg-muted/70 px-4 py-3">
              <p className="text-sm text-muted-foreground">Coût main d’œuvre</p>
              <p className="mt-1 text-lg font-medium tabular-nums">
                {formatEuro(mo)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {settings.laborHours} h × {formatEuro(settings.hourlyRate)}/h
              </p>
            </div>
            <Field
              id="margin"
              label="Marge commerciale"
              suffix="%"
              value={settings.marginPct}
              onChange={(marginPct) => onChange({ marginPct })}
              hint="Du prix de vente HT"
            />
          </div>

          <div className="mt-6">
            <HardwareList
              items={settings.hardwareItems}
              onChange={(hardwareItems: HardwareItem[]) =>
                onChange({ hardwareItems })
              }
              stock={stock}
              onEnsureStock={onEnsureStock}
            />
          </div>

          {selling.ok ? (
            <SellingRecap
              selling={selling}
              cAchat={cAchat}
              onGenerateQuote={onGenerateQuote}
            />
          ) : (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">
              <p>{selling.error}</p>
              {incomplete && (
                <p className="mt-1">
                  Complétez les prix au m² dans le catalogue. Aucun
                  montant n’est inventé.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SellingRecap({
  selling,
  cAchat,
  onGenerateQuote,
}: {
  selling: SellingOk;
  cAchat: number | null;
  onGenerateQuote: () => void;
}) {
  return (
    <>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Prix réel compensé"
          value={`${formatEuro(selling.prixM2Reel)} / m²`}
          hint="p_moyen ÷ (1 − τ)"
        />
        <Stat
          label="Coût matière"
          value={formatEuro(selling.coutMatiere)}
          hint="surface utile × prix réel"
        />
        <Stat
          label="Main d’œuvre"
          value={formatEuro(selling.labor)}
          hint="temps × taux horaire"
        />
        <Stat
          label="Quincaillerie"
          value={formatEuro(selling.hardware)}
          hint="somme des articles"
        />
        <Stat
          label="Coût de revient"
          value={formatEuro(selling.coutRevient)}
          hint="matière + MO + quincaillerie"
        />
        <Stat
          label="Prix de vente HT"
          value={formatEuro(selling.prixVente)}
          hint={`${formatEuro(selling.margeEuros)} de marge · ${formatPct(selling.marginPct)}`}
          emphasize
        />
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Achat fournisseur (p_moyen × surface achetée)
          {cAchat != null ? ` : ${formatEuro(cAchat)}` : " : —"}
        </p>
        <Button type="button" onClick={onGenerateQuote} className="no-print">
          <FileText />
          PDF client
        </Button>
      </div>
    </>
  );
}

function ReadStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg bg-muted/70 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-medium tabular-nums">{value}</dd>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({
  id,
  label,
  suffix,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          inputMode="decimal"
          value={String(value)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.,-]/g, "");
            onChange(parseNum(raw));
          }}
          className="pr-14 tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/70 px-4 py-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd
        className={
          emphasize
            ? "mt-1 font-display text-2xl font-medium tabular-nums tracking-tight text-primary"
            : "mt-1 text-lg font-medium tabular-nums"
        }
      >
        {value}
      </dd>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
