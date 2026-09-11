import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ConfirmAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
};

type Props = {
  open: boolean;
  title: string;
  message: string;
  actions: ConfirmAction[];
  value?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  inputLabel?: string;
  children?: ReactNode;
  wide?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  message,
  actions,
  value,
  onValueChange,
  placeholder,
  inputLabel,
  children,
  wide,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className={cn(
          "w-full rounded-xl bg-card p-5 shadow-[var(--shadow-border)]",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <h2 id="confirm-title" className="font-display text-lg font-medium">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {children}
        {onValueChange != null && (
          <div className="mt-4">
            {inputLabel && (
              <label className="mb-1 block text-sm" htmlFor="confirm-input">
                {inputLabel}
              </label>
            )}
            <Input
              id="confirm-input"
              autoFocus
              value={value ?? ""}
              placeholder={placeholder}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const primary = actions.find((a) => (a.variant ?? "default") === "default");
                  primary?.onClick();
                }
              }}
            />
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              type="button"
              variant={a.variant ?? "default"}
              onClick={a.onClick}
              disabled={a.disabled}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
