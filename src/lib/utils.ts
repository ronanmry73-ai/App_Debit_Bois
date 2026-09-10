import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMm(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} mm`;
}

export function formatArea(mm2: number): string {
  const m2 = mm2 / 1_000_000;
  return `${m2.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function formatPct(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function newId(): string {
  return crypto.randomUUID();
}
