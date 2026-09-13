/**
 * Google Identity Services — jeton Drive pour la PWA Terrain.
 * Client ID public : import.meta.env.VITE_GOOGLE_CLIENT_ID
 */

import { GOOGLE_DRIVE_SCOPES } from "./google-drive.ts";

const TOKEN_KEY = "debit-bois-drive-token";
const GIS_SRC = "https://accounts.google.com/gsi/client";

type TokenBlob = { accessToken: string; expiresAt: number };

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

type TokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (cfg: TokenClientConfig) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;

export function googleClientId(): string {
  try {
    return String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
  } catch {
    return "";
  }
}

export function loadStoredAccessToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const blob = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null") as TokenBlob | null;
    if (!blob?.accessToken) return null;
    if (Date.now() >= blob.expiresAt - 15_000) return null;
    return blob.accessToken;
  } catch {
    return null;
  }
}

function saveToken(accessToken: string, expiresIn: number): void {
  if (typeof sessionStorage === "undefined") return;
  const expiresAt = Date.now() + Math.max(60, expiresIn) * 1000;
  try {
    sessionStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ accessToken, expiresAt } satisfies TokenBlob),
    );
  } catch {
    /* ignore */
  }
}

export function clearStoredAccessToken(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity nécessite un navigateur."));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Identity indisponible.")),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gsiPromise = null;
      reject(new Error("Google Identity indisponible."));
    };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

export function requestAccessToken(opts?: {
  prompt?: "" | "consent";
}): Promise<string> {
  const clientId = googleClientId();
  if (!clientId) {
    return Promise.reject(
      new Error(
        "Client ID Google manquant. Colle VITE_GOOGLE_CLIENT_ID dans Cloudflare Pages (build) puis redéploie.",
      ),
    );
  }
  const cached = loadStoredAccessToken();
  if (cached && opts?.prompt !== "consent") return Promise.resolve(cached);

  return loadGsiScript().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const oauth = window.google?.accounts?.oauth2;
        if (!oauth) {
          reject(new Error("Google Identity non chargé."));
          return;
        }
        const client = oauth.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_DRIVE_SCOPES,
          callback: (resp) => {
            if (resp.error || !resp.access_token) {
              reject(new Error(resp.error || "Connexion Google annulée."));
              return;
            }
            saveToken(resp.access_token, Number(resp.expires_in) || 3600);
            resolve(resp.access_token);
          },
          error_callback: (err) => {
            reject(new Error(err.message || "Connexion Google refusée."));
          },
        });
        client.requestAccessToken({ prompt: opts?.prompt ?? "consent" });
      }),
  );
}

export function revokeAccessToken(): void {
  const token = loadStoredAccessToken();
  clearStoredAccessToken();
  const oauth = window.google?.accounts?.oauth2;
  if (token && oauth?.revoke) {
    try {
      oauth.revoke(token);
    } catch {
      /* ignore */
    }
  }
}
