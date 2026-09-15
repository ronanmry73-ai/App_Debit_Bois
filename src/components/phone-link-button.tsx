import { Copy, Smartphone } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  storedUrl: string;
  onStoredUrl: (next: string) => void;
};

/**
 * Adresse à ouvrir sur le téléphone. Le PC Electron ne connaît pas l'URL
 * déployée, donc elle est mémorisée ici ; quand l'app tourne déjà sur un site
 * https, sa propre adresse est proposée par défaut.
 */
export function PhoneLinkButton({ storedUrl, onStoredUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(storedUrl);
  const [copied, setCopied] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const suggested = storedUrl.trim() || (origin.startsWith("https://") ? origin : "");

  async function copy() {
    const value = (draft.trim() || suggested).trim();
    if (!value) return;
    if (value !== storedUrl.trim()) onStoredUrl(value);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setDraft(suggested);
          setCopied(false);
          setOpen(true);
        }}
      >
        <Smartphone />
        Lien téléphone
      </Button>
      <ConfirmDialog
        open={open}
        title="Utiliser l’application sur le téléphone"
        message="Ouvre cette adresse sur le téléphone, puis ajoute-la à l’écran d’accueil (Partager → Sur l’écran d’accueil). L’interface terrain s’affiche automatiquement sur un petit écran."
        actions={[
          { label: "Fermer", variant: "outline", onClick: () => setOpen(false) },
          {
            label: copied ? "Lien copié" : "Copier le lien",
            onClick: () => {
              void copy();
            },
          },
        ]}
      >
        <div className="mt-4">
          <Label htmlFor="phone-url">Adresse de l’application</Label>
          <Input
            id="phone-url"
            className="mt-1"
            value={draft}
            placeholder="https://app-debit-bois.ronan-mry73.workers.dev"
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Mémorisée sur ce poste. Sur un site https, la valeur proposée est déjà l’adresse de l’app.
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
