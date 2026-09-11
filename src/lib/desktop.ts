export type DebitBoisDesktop = {
  isDesktop: boolean;
  platform?: string;
  readStore: () => Promise<string | null>;
  writeStore: (json: string) => Promise<boolean>;
  exportFile: (suggestedName: string, content: string) => Promise<boolean>;
  importFile: () => Promise<string | null>;
};

export function desktopApi(): DebitBoisDesktop | null {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { debitBoisDesktop?: DebitBoisDesktop })
    .debitBoisDesktop;
  if (!api?.isDesktop) return null;
  return api;
}
