import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HardwareList } from "@/components/hardware-list";
import type { AppSettings, HardwareItem } from "@/lib/types";
import type { StockItem } from "@/lib/stock";
import { laborCost, sellingFromInputs, type SellingOk } from "@/lib/pricing";
import { formatArea, formatEuro, formatPct } from "@/lib/utils";

type Props = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  autoSurfaceM2: number;
  purchasedAreaMm2: number;
  onGenerateQuote: () => void;
  stock?: StockItem[];
  onEnsureStock?: (name: string, unitCost: number) => void;
};

function parseNum(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function QuotePanel({
  settings,
  onChange,
  autoSurfaceM2,
  purchasedAreaMm2,
  onGenerateQuote,
  stock = [],
  onEnsureStock,
}: Props) {
  const surfaceM2 = settings.surfaceOverrideM2 ?? autoSurfaceM2;
  const mo = laborCost(settings.laborHours, settings.hourlyRate);
  const selling = sellingFromInputs(
    surfaceM2,
    settings.pricePerM2,
    settings.wastePct,
    settings.laborHours,
    settings.hourlyRate,
    settings.hardwareItems,
    settings.marginPct,
  );

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
            Surface du débit, perte, main d’œuvre au temps passé, quincaillerie
            ligne à ligne, puis marge.
          </p>

          <div className="no-print mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              id="price-m2"
              label="Prix d’achat fournisseur"
              suffix="€/m²"
              value={settings.pricePerM2}
              onChange={(pricePerM2) => onChange({ pricePerM2 })}
            />
            <div>
              <Label htmlFor="surface-m2">Surface nécessaire</Label>
              <div className="relative mt-1.5">
                <Input
                  id="surface-m2"
                  inputMode="decimal"
                  value={String(surfaceM2)}
                  onChange={(e) =>
                    onChange({ surfaceOverrideM2: parseNum(e.target.value) })
                  }
                  className="pr-12 tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  m²
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Débit :{" "}
                  {autoSurfaceM2.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}{" "}
                  m²
                </span>
                {settings.surfaceOverrideM2 != null && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-1 py-0 text-xs"
                    onClick={() => onChange({ surfaceOverrideM2: null })}
                  >
                    Reprendre le débit
                  </Button>
                )}
              </div>
            </div>
            <Field
              id="waste"
              label="Taux de perte / chute"
              suffix="%"
              value={settings.wastePct}
              onChange={(wastePct) => onChange({ wastePct })}
              hint="Défaut 15 %"
            />
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
              hint="Défaut 20 % du prix de vente"
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
              purchasedAreaMm2={purchasedAreaMm2}
              pricePerM2={settings.pricePerM2}
              onGenerateQuote={onGenerateQuote}
            />
          ) : (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive">
              {selling.error}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SellingRecap({
  selling,
  purchasedAreaMm2,
  pricePerM2,
  onGenerateQuote,
}: {
  selling: SellingOk;
  purchasedAreaMm2: number;
  pricePerM2: number;
  onGenerateQuote: () => void;
}) {
  const achatPanneaux = (purchasedAreaMm2 / 1_000_000) * pricePerM2;

  return (
    <>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Prix réel compensé"
          value={`${formatEuro(selling.prixM2Reel)} / m²`}
          hint="achat ÷ (1 − taux de perte)"
        />
        <Stat
          label="Coût matière"
          value={formatEuro(selling.coutMatiere)}
          hint="surface × prix réel"
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
          Achat panneaux du calepinage ({formatArea(purchasedAreaMm2)} ×{" "}
          {formatEuro(pricePerM2)}/m²) : {formatEuro(achatPanneaux)}
        </p>
        <Button type="button" onClick={onGenerateQuote} className="no-print">
          <FileText />
          Générer le devis
        </Button>
      </div>
    </>
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
      <dt className="text-sm text-muted-foreground">{label}</dt>
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
