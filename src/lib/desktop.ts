export type DriveBackupStatus = {
  ok: boolean;
  at: string | null;
  path?: string;
  error?: string | null;
};

export type PendingJournalRead = {
  ok: boolean;
  raw: string | null;
  missing?: boolean;
  path?: string;
  error?: string | null;
};

export type PendingJournalArchive = {
  ok: boolean;
  path?: string;
  archived?: string | null;
  error?: string | null;
};

export type DebitBoisDesktop = {
  isDesktop: boolean;
  platform?: string;
  readStore: () => Promise<string | null>;
  writeStore: (json: string) => Promise<boolean>;
  exportFile: (suggestedName: string, content: string) => Promise<boolean>;
  importFile: () => Promise<string | null>;
  setTitle?: (title: string) => Promise<boolean>;
  getDriveStatus?: () => Promise<DriveBackupStatus | null>;
  restoreDriveBackup?: () => Promise<{ restored: boolean }>;
  readPendingJournal?: (hintJson?: string) => Promise<PendingJournalRead | null>;
  archivePendingJournal?: (hintJson?: string) => Promise<PendingJournalArchive | null>;
  onDriveStatus?: (cb: (status: DriveBackupStatus) => void) => () => void;
  onStoreRestored?: (cb: (json: string) => void) => () => void;
  onPendingJournalCheck?: (cb: () => void) => () => void;
};

export function desktopApi(): DebitBoisDesktop | null {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { debitBoisDesktop?: DebitBoisDesktop })
    .debitBoisDesktop;
  if (!api?.isDesktop) return null;
  return api;
}

export function formatDriveStatusLabel(status: DriveBackupStatus | null): string {
  if (!status) return "";
  if (status.ok && status.at) {
    const d = new Date(status.at);
    if (!Number.isNaN(d.getTime())) {
      const p = (n: number) => String(n).padStart(2, "0");
      return `Sauvegarde Drive : ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    return "Sauvegarde Drive : OK";
  }
  if (status.ok) return "Sauvegarde Drive : prête";
  return "Drive indisponible — données locales OK";
}
