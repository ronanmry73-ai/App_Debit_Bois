import { Cloud, CloudOff } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status.linked ? (
          <>
            {/* État, non cliquable : déconnecter est une action à part. */}
            <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm">
              <Cloud />
              Drive lié
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmDisconnect(true)}
              disabled={busy}
            >
              Déconnecter
            </Button>
          </>
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
      {pendingCount > 0 && (
        <p className="text-sm text-accent-foreground">
          {pendingCount} mouvement{pendingCount > 1 ? "s" : ""}
          {status.linked
            ? " transmis — en attente d’application à l’atelier."
            : " à envoyer — Enregistrez le carnet."}
        </p>
      )}
      {status.linked && status.email ? (
        <p className="text-xs text-muted-foreground">{status.email}</p>
      ) : null}
      {status.error && <p className="text-sm text-destructive">{status.error}</p>}
      {status.pulling && !status.error && (
        <p className="text-xs text-muted-foreground">Lecture stock Drive…</p>
      )}
      <ConfirmDialog
        open={confirmDisconnect}
        title="Déconnecter Google Drive ?"
        message="Le téléphone arrêtera de lire le stock de l’atelier et d’envoyer le carnet. Les mouvements déjà saisis ici restent dans l’application, et l’export / import JSON reste disponible."
        actions={[
          { label: "Annuler", variant: "outline", onClick: () => setConfirmDisconnect(false) },
          {
            label: "Déconnecter",
            variant: "destructive",
            onClick: () => {
              setConfirmDisconnect(false);
              onDisconnect();
            },
          },
        ]}
      />
    </div>
  );
}
