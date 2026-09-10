import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { METHOD_OPTIONS } from "@/lib/presets";
import type { PackMethod } from "@/lib/packing";
import type { AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
};

function parsePositive(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function SettingsBar({ settings, onChange }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="kerf">Trait de scie (kerf)</Label>
        <div className="relative mt-1.5">
          <Input
            id="kerf"
            inputMode="decimal"
            value={String(settings.kerf)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.,]/g, "");
              onChange({ kerf: parsePositive(raw) });
            }}
            className="pr-10 tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            mm
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Défaut 3 mm</p>
      </div>

      <div>
        <Label htmlFor="method">Méthode de calepinage</Label>
        <select
          id="method"
          value={settings.method}
          onChange={(e) => onChange({ method: e.target.value as PackMethod })}
          className={cn(
            "mt-1.5 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/70 px-4 py-3 sm:mt-6">
        <div>
          <Label htmlFor="rotation">Autoriser la rotation 90°</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Utile si le fil du bois n’est pas imposé
          </p>
        </div>
        <Switch
          id="rotation"
          checked={settings.allowRotation}
          onCheckedChange={(v) => onChange({ allowRotation: v })}
        />
      </div>
    </div>
  );
}
