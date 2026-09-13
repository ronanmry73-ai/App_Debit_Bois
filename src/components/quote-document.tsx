import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyVat,
  hardwareLines,
  laborCost,
  type SellingResult,
} from "@/lib/pricing";
import type { AppSettings } from "@/lib/types";
import type { StrategyResult } from "@/lib/packing";
import type { SupplierCost } from "@/lib/supplier";
import { formatArea, formatEuro, formatPct } from "@/lib/utils";

type Props = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  selling: SellingResult;
  strategy: StrategyResult;
  supplier: SupplierCost | null;
  onPrint?: () => void;
  readOnly?: boolean;
};

export function QuoteDocument({
  settings,
  onChange,
  selling,
  strategy,
  supplier,
  onPrint,
  readOnly = false,
}: Props) {
  const hw = hardwareLines(settings.hardwareItems).filter(
    (l) => l.name.trim() && l.qty > 0,
  );
  const hwTotal = hw.reduce((s, l) => s + l.subtotal, 0);
  const mo = laborCost(settings.laborHours, settings.hourlyRate);
  const incomplete = !selling.ok;
  const vat = selling.ok ? applyVat(selling.prixVente, settings.vatPct) : null;
  const dateLabel = formatQuoteDate(settings.quoteDate);
  const lines = supplier?.lines ?? [];

  return (
    <section aria-labelledby="quote-sheet-title">
      {!readOnly && <IdentityForm settings={settings} onChange={onChange} />}

      <article
        id="quote-sheet"
        className="quote-sheet mt-4 rounded-xl bg-card px-5 py-6 shadow-[var(--shadow-border)] sm:px-8 sm:py-8"
      >
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-5">
          <div className="flex items-start gap-3">
            {settings.logoDataUrl ? (
              <img
                src={settings.logoDataUrl}
                alt=""
                className="h-14 w-14 rounded-md object-contain"
              />
            ) : (
              <DefaultMark />
            )}
            <div>
              <p className="font-display text-xl font-medium tracking-tight">
                {settings.companyName || "Votre atelier"}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {settings.companyAddress}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[settings.companyPhone, settings.companyEmail]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {settings.companySiret && (
                <p className="text-xs text-muted-foreground">
                  SIRET {settings.companySiret}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p
              id="quote-sheet-title"
              className="font-display text-2xl font-medium tracking-tight"
            >
              Devis
            </p>
            <p className="mt-1 text-sm tabular-nums">{settings.quoteNumber}</p>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Client
            </p>
            <p className="mt-1 font-medium">{settings.clientName || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Objet
            </p>
            <p className="mt-1 font-medium">
              {settings.furnitureDescription || "Meuble sur mesure"}
            </p>
          </div>
        </div>

        <QuoteTable title="1. Matière première — panneaux consommés">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Dimensions</th>
              <th className="num">Qté</th>
              <th className="num">Surface</th>
              <th className="num">Prix €/m²</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5}>Aucun panneau</td>
              </tr>
            ) : (
              lines.map((p) => (
                <tr key={p.specId}>
                  <td>Panneau {p.name}</td>
                  <td>
                    {p.length} × {p.width} mm
                  </td>
                  <td className="num">{p.qty}</td>
                  <td className="num">
                    {p.areaM2.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    m²
                  </td>
                  <td className="num">
                    {p.pricePerM2 != null ? formatEuro(p.pricePerM2) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </QuoteTable>
        <p className="mt-2 text-xs text-muted-foreground">
          Surface utile {formatArea(strategy.usedArea)} · Surface achetée{" "}
          {formatArea(strategy.purchasedArea)}
          {selling.ok
            ? ` · Prix moyen ${formatEuro(selling.pricePerM2)}/m²`
            : " · Prix incomplet"}
        </p>

        <QuoteTable title="2. Quincaillerie et fournitures">
          <thead>
            <tr>
              <th>Article</th>
              <th className="num">Qté</th>
              <th className="num">Prix unit.</th>
              <th className="num">Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {hw.length === 0 ? (
              <tr>
                <td colSpan={4}>Aucun article</td>
              </tr>
            ) : (
              hw.map((l) => (
                <tr key={l.id}>
                  <td>{l.name || "Article"}</td>
                  <td className="num">{l.qty}</td>
                  <td className="num">{formatEuro(l.unitPrice)}</td>
                  <td className="num">{formatEuro(l.subtotal)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total quincaillerie</td>
              <td className="num">{formatEuro(hwTotal)}</td>
            </tr>
          </tfoot>
        </QuoteTable>

        <QuoteTable title="3. Main d’œuvre">
          <thead>
            <tr>
              <th>Désignation</th>
              <th className="num">Temps</th>
              <th className="num">Taux</th>
              <th className="num">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Fabrication et pose</td>
              <td className="num">{settings.laborHours} h</td>
              <td className="num">{formatEuro(settings.hourlyRate)} / h</td>
              <td className="num">{formatEuro(mo)}</td>
            </tr>
          </tbody>
        </QuoteTable>

        <div className="mt-6 ml-auto w-full max-w-sm">
          <h3 className="font-display text-base font-medium">
            4. Récapitulatif
          </h3>
          <dl className="mt-3 text-sm">
            <Row
              label="Coût matière"
              value={
                selling.ok ? formatEuro(selling.coutMatiere) : "prix incomplet"
              }
            />
            <Row
              label="Quincaillerie"
              value={formatEuro(hwTotal)}
            />
            <Row label="Main d’œuvre" value={formatEuro(mo)} />
            {selling.ok ? (
              <>
                <Row label="Coût de revient" value={formatEuro(selling.coutRevient)} />
                <Row
                  label={`Marge (${formatPct(selling.marginPct)})`}
                  value={formatEuro(selling.margeEuros)}
                />
                <Row label="Prix de vente HT" value={formatEuro(selling.prixVente)} strong />
                {vat && (
                  <>
                    <Row
                      label={`TVA (${formatPct(settings.vatPct)})`}
                      value={formatEuro(vat.tva)}
                    />
                    <Row label="Prix de vente TTC" value={formatEuro(vat.ttc)} total />
                  </>
                )}
              </>
            ) : (
              <Row
                label="Prix de vente"
                value="prix incomplet"
                total
              />
            )}
          </dl>
          {incomplete && (
            <p className="mt-3 text-xs text-destructive">
              {selling.error} Aucun euro n’est inventé pour la matière.
            </p>
          )}
        </div>

        <footer className="mt-8 space-y-2 border-t border-border pt-4 text-sm text-ink-soft">
          <p>{settings.validity}</p>
          <p>{settings.payment}</p>
          {settings.legal && <p className="text-xs text-muted-foreground">{settings.legal}</p>}
        </footer>
      </article>

      {!readOnly && (
      <div className="no-print mt-3 flex justify-end">
        <Button type="button" onClick={() => (onPrint ? onPrint() : window.print())}>
          <Printer />
          PDF client
        </Button>
      </div>
      )}
    </section>
  );
}

function IdentityForm({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="no-print rounded-xl bg-card px-5 py-5 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-xl font-medium tracking-tight">
        En-tête du devis
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Le client est celui du projet. Ces informations apparaissent sur le
        document.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          id="co-name"
          label="Nom de l’entreprise"
          value={settings.companyName}
          onChange={(companyName) => onChange({ companyName })}
          placeholder="Nom de l’atelier"
        />
        <div>
          <Label htmlFor="co-logo">Logo (optionnel)</Label>
          <Input
            id="co-logo"
            type="file"
            accept="image/*"
            className="mt-1.5"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 400_000) return;
              const reader = new FileReader();
              reader.onload = () =>
                onChange({ logoDataUrl: String(reader.result ?? "") });
              reader.readAsDataURL(file);
            }}
          />
          {settings.logoDataUrl && (
            <Button
              type="button"
              variant="ghost"
              className="mt-1 h-auto px-0 py-0 text-xs"
              onClick={() => onChange({ logoDataUrl: "" })}
            >
              Retirer le logo
            </Button>
          )}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="co-addr">Coordonnées</Label>
          <textarea
            id="co-addr"
            rows={3}
            value={settings.companyAddress}
            onChange={(e) => onChange({ companyAddress: e.target.value })}
            className="mt-1.5 flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <TextField
          id="co-phone"
          label="Téléphone"
          value={settings.companyPhone}
          onChange={(companyPhone) => onChange({ companyPhone })}
        />
        <TextField
          id="co-email"
          label="E-mail"
          value={settings.companyEmail}
          onChange={(companyEmail) => onChange({ companyEmail })}
        />
        <TextField
          id="co-siret"
          label="SIRET"
          value={settings.companySiret}
          onChange={(companySiret) => onChange({ companySiret })}
        />
        <TextField
          id="client"
          label="Nom du client"
          value={settings.clientName}
          onChange={(clientName) => onChange({ clientName })}
          placeholder="M. et Mme Martin"
        />
        <div>
          <Label htmlFor="q-date">Date du devis</Label>
          <Input
            id="q-date"
            type="date"
            className="mt-1.5"
            value={settings.quoteDate}
            onChange={(e) => onChange({ quoteDate: e.target.value })}
          />
        </div>
        <TextField
          id="q-num"
          label="N° de devis"
          value={settings.quoteNumber}
          onChange={(quoteNumber) => onChange({ quoteNumber })}
        />
        <div className="sm:col-span-2">
          <Label htmlFor="q-desc">Description du meuble</Label>
          <Input
            id="q-desc"
            className="mt-1.5"
            value={settings.furnitureDescription}
            placeholder="Étagère salon"
            onChange={(e) =>
              onChange({ furnitureDescription: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor="vat">TVA</Label>
          <div className="relative mt-1.5">
            <Input
              id="vat"
              inputMode="decimal"
              className="pr-10 tabular-nums"
              value={String(settings.vatPct)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(",", "."));
                onChange({ vatPct: Number.isFinite(n) ? n : 0 });
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>
        <TextField
          id="validity"
          label="Validité"
          value={settings.validity}
          onChange={(validity) => onChange({ validity })}
        />
        <div className="sm:col-span-2">
          <Label htmlFor="payment">Modalités de paiement</Label>
          <Input
            id="payment"
            className="mt-1.5"
            value={settings.payment}
            onChange={(e) => onChange({ payment: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="legal">Mention légale</Label>
          <Input
            id="legal"
            className="mt-1.5"
            value={settings.legal}
            onChange={(e) => onChange({ legal: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1.5"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function QuoteTable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="font-display text-base font-medium">{title}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="quote-table w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  total,
}: {
  label: string;
  value: string;
  strong?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={
        total
          ? "mt-2 flex items-baseline justify-between border-t border-border pt-2 font-display text-lg font-medium"
          : "flex items-baseline justify-between gap-4 py-1"
      }
    >
      <dt className={strong || total ? undefined : "text-muted-foreground"}>
        {label}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function DefaultMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect width="40" height="40" rx="10" fill="#2c4a3e" />
      <rect x="7" y="10" width="26" height="6" rx="1.5" fill="#f4f1ea" />
      <rect x="7" y="18" width="26" height="8" rx="1.5" fill="#d4c4a8" />
      <rect x="7" y="28" width="16" height="5" rx="1.5" fill="#e7dfd2" />
    </svg>
  );
}

function formatQuoteDate(iso: string): string {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
