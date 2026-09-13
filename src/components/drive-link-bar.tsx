import { Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TerrainDriveStatus } from "@/lib/use-terrain-drive";

type Props = {
  status: TerrainDriveStatus;
  pendingCount: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendNow: () => void;
};

export function DriveLinkBar({
  status,
  pendingCount,
  onConnect,
  onDisconnect,
  onSendNow,
}: Props) {
  const busy = status.linking || status.pulling || status.pushing;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status.linked ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onDisconnect}
            disabled={busy}
          >
            <Cloud />
            Drive lié · déconnecter
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onConnect}
            disabled={busy}
          >
            <CloudOff />
            {status.linking ? "Connexion…" : "Lier Google Drive"}
          </Button>
        )}
        {status.linked && pendingCount > 0 && (
          <Button
            type="button"
            className="min-h-11"
            onClick={onSendNow}
            disabled={status.pushing}
          >
            Envoyer maintenant
          </Button>
        )}
      </div>
      {status.linked && pendingCount > 0 && (
        <p className="text-sm text-accent-foreground">
          {pendingCount} mouvement{pendingCount > 1 ? "s" : ""} à envoyer
        </p>
      )}
      {status.linked && status.email ? (
        <p className="text-xs text-muted-foreground">{status.email}</p>
      ) : null}
      {status.error && (
        <p className="text-sm text-destructive">{status.error}</p>
      )}
      {status.pulling && !status.error && (
        <p className="text-xs text-muted-foreground">Lecture stock Drive…</p>
      )}
    </div>
  );
}
