/** Enregistre le service worker app-shell. Jamais en dev (évite un cache stale). */

export function registerDebitBoisSW(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* hors ligne / Pages sans SW */
    });
  });
}
