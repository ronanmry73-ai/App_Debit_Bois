import { useCallback, useEffect, useRef, useState } from "react";
import { createDriveClient, DriveAuthError } from "./google-drive-api.ts";
import {
  DRIVE_FOLDER_NAME,
  readStoredDriveLink,
  writeStoredDriveLink,
  type DriveLink,
} from "./google-drive.ts";
import {
  clearStoredAccessToken,
  googleClientId,
  requestAccessToken,
  revokeAccessToken,
} from "./google-gis.ts";
import { isPersistSnapshot } from "./movements.ts";
import type { PendingMove } from "./movements.ts";

export type TerrainDriveStatus = {
  clientId: string;
  linked: boolean;
  linking: boolean;
  pulling: boolean;
  pushing: boolean;
  email: string | null;
  error: string | null;
  lastPullAt: string | null;
  lastPushAt: string | null;
};

const emptyStatus = (clientId: string, linked: boolean, email: string | null): TerrainDriveStatus => ({
  clientId,
  linked,
  linking: false,
  pulling: false,
  pushing: false,
  email,
  error: null,
  lastPullAt: null,
  lastPushAt: null,
});

export function useTerrainDrive(opts: {
  enabled: boolean;
  hydrated: boolean;
  pendingMoves: PendingMove[];
  setPendingMoves: (next: PendingMove[] | ((prev: PendingMove[]) => PendingMove[])) => void;
  onDernier: (raw: unknown) => boolean;
  onMessage: (msg: string) => void;
}) {
  const clientId = googleClientId();
  const [link, setLink] = useState<DriveLink | null>(() =>
    opts.enabled ? readStoredDriveLink() : null,
  );
  const [status, setStatus] = useState<TerrainDriveStatus>(() =>
    emptyStatus(clientId, !!link, link?.email ?? null),
  );

  const pendingRef = useRef(opts.pendingMoves);
  pendingRef.current = opts.pendingMoves;
  const onDernierRef = useRef(opts.onDernier);
  onDernierRef.current = opts.onDernier;
  const onMessageRef = useRef(opts.onMessage);
  onMessageRef.current = opts.onMessage;
  const linkRef = useRef(link);
  linkRef.current = link;
  const pushLock = useRef<Promise<void> | null>(null);
  const pullLock = useRef<Promise<void> | null>(null);

  const setErr = useCallback((error: string | null) => {
    setStatus((s) => ({ ...s, error }));
  }, []);

  const withToken = useCallback(async (forceConsent = false) => {
    const token = await requestAccessToken({
      prompt: forceConsent ? "consent" : "",
    });
    return createDriveClient({ accessToken: token });
  }, []);

  const pullDernier = useCallback(async () => {
    const current = linkRef.current;
    if (!opts.enabled || !current) return;
    if (pullLock.current) return pullLock.current;
    const run = (async () => {
      setStatus((s) => ({ ...s, pulling: true, error: null }));
      try {
        const api = await withToken();
        const rawText = await api.readDernier(current);
        let data: unknown;
        try {
          data = JSON.parse(rawText);
        } catch {
          onMessageRef.current(
            "debit-bois-dernier.json illisible — état local conservé.",
          );
          return;
        }
        if (!isPersistSnapshot(data)) {
          onMessageRef.current(
            "debit-bois-dernier.json illisible — état local conservé.",
          );
          return;
        }
        const ok = onDernierRef.current(data);
        if (ok) {
          setStatus((s) => ({
            ...s,
            lastPullAt: new Date().toISOString(),
            error: null,
          }));
        }
      } catch (err) {
        if (err instanceof DriveAuthError) {
          clearStoredAccessToken();
          try {
            const api = await withToken(true);
            const rawText = await api.readDernier(current);
            const data = JSON.parse(rawText) as unknown;
            if (isPersistSnapshot(data)) onDernierRef.current(data);
          } catch (inner) {
            setErr(messageOf(inner));
          }
          return;
        }
        setErr(messageOf(err));
      } finally {
        setStatus((s) => ({ ...s, pulling: false }));
      }
    })();
    pullLock.current = run;
    try {
      await run;
    } finally {
      pullLock.current = null;
    }
  }, [opts.enabled, setErr, withToken]);

  const pushPending = useCallback(async () => {
    const current = linkRef.current;
    const local = pendingRef.current;
    if (!opts.enabled || !current || local.length === 0) return;
    if (pushLock.current) return pushLock.current;
    const snapshot = local.slice();
    const run = (async () => {
      setStatus((s) => ({ ...s, pushing: true, error: null }));
      try {
        const api = await withToken();
        const { pendingFileId } = await api.pushPending(current, snapshot);
        if (pendingFileId && pendingFileId !== current.pendingFileId) {
          const nextLink = { ...current, pendingFileId };
          linkRef.current = nextLink;
          setLink(nextLink);
          writeStoredDriveLink(nextLink);
        }
        // La file locale n'est vidée que sur accusé de réception (appliedMoveIds
        // publiés dans le miroir par le PC), jamais sur un envoi réussi : sinon un
        // carnet écrasé côté PC ou non rapatrié par Drive perd le mouvement.
        setStatus((s) => ({
          ...s,
          lastPushAt: new Date().toISOString(),
          error: null,
        }));
      } catch (err) {
        if (err instanceof DriveAuthError) {
          clearStoredAccessToken();
          setErr("Session Google expirée — reconnecte Drive.");
          return;
        }
        if (!navigator.onLine) {
          setErr("Hors-ligne — les mouvements restent en local.");
          return;
        }
        setErr(messageOf(err));
      } finally {
        setStatus((s) => ({ ...s, pushing: false }));
      }
    })();
    pushLock.current = run;
    try {
      await run;
    } finally {
      pushLock.current = null;
    }
  }, [opts.enabled, opts.setPendingMoves, setErr, withToken]);

  /** Carnet distant illisible : on l'écarte, puis on repart d'un carnet neuf. */
  const repairPending = useCallback(async () => {
    const current = linkRef.current;
    if (!opts.enabled || !current) return;
    if (pushLock.current) return pushLock.current;
    const run = (async () => {
      setStatus((s) => ({ ...s, pushing: true, error: null }));
      try {
        const api = await withToken();
        const { archivedName } = await api.repairPending(current);
        const nextLink = { ...current, pendingFileId: null };
        linkRef.current = nextLink;
        setLink(nextLink);
        writeStoredDriveLink(nextLink);
        onMessageRef.current(
          archivedName
            ? "Carnet illisible écarté sous « " + archivedName + " ». Un carnet neuf sera créé au prochain envoi."
            : "Aucun carnet à réparer. Un carnet neuf sera créé au prochain envoi.",
        );
      } catch (err) {
        setErr(messageOf(err));
      } finally {
        setStatus((s) => ({ ...s, pushing: false }));
      }
    })();
    pushLock.current = run;
    try {
      await run;
    } finally {
      pushLock.current = null;
    }
  }, [opts.enabled, setErr, withToken]);

  const connect = useCallback(async () => {
    if (!opts.enabled) return;
    if (!googleClientId()) {
      setErr(
        "Client ID Google manquant. Dans Cloudflare Pages → Variables : VITE_GOOGLE_CLIENT_ID (ID public OAuth, type Application Web), puis redéploie. Pas un secret.",
      );
      return;
    }
    setStatus((s) => ({ ...s, linking: true, error: null }));
    try {
      const api = await withToken(true);
      const next = await api.resolveLink();
      linkRef.current = next;
      setLink(next);
      writeStoredDriveLink(next);
      setStatus((s) => ({
        ...s,
        linked: true,
        linking: false,
        email: next.email ?? null,
        error: null,
      }));
      onMessageRef.current(
        next.lastFileId
          ? `Drive lié (${DRIVE_FOLDER_NAME}).`
          : `Drive lié, mais debit-bois-dernier.json absent — enregistre depuis le PC.`,
      );
      if (next.lastFileId) await pullDernier();
      if (pendingRef.current.length > 0) await pushPending();
    } catch (err) {
      setStatus((s) => ({ ...s, linking: false, error: messageOf(err) }));
    }
  }, [opts.enabled, pullDernier, pushPending, setErr, withToken]);

  const disconnect = useCallback(() => {
    revokeAccessToken();
    writeStoredDriveLink(null);
    linkRef.current = null;
    setLink(null);
    setStatus(emptyStatus(googleClientId(), false, null));
    onMessageRef.current("Drive déconnecté. Export / import manuel toujours dispo.");
  }, []);

  useEffect(() => {
    if (opts.enabled && !linkRef.current) {
      const stored = readStoredDriveLink();
      if (stored) {
        linkRef.current = stored;
        setLink(stored);
      }
    }
  }, [opts.enabled]);

  useEffect(() => {
    setStatus((s) => ({
      ...s,
      clientId,
      linked: !!link,
      email: link?.email ?? s.email,
    }));
  }, [clientId, link]);

  useEffect(() => {
    if (!opts.enabled || !opts.hydrated || !link) return;
    void pullDernier();
    const interval = window.setInterval(() => {
      void pullDernier();
    }, 5 * 60_000);
    const onFocus = () => {
      void pullDernier();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [opts.enabled, opts.hydrated, link, pullDernier]);

  useEffect(() => {
    if (!opts.enabled || !link) return;
    if (opts.pendingMoves.length === 0) return;
    void pushPending();
  }, [opts.enabled, link, opts.pendingMoves, pushPending]);

  useEffect(() => {
    if (!opts.enabled || !link) return;
    const onOnline = () => {
      if (pendingRef.current.length > 0) void pushPending();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [opts.enabled, link, pushPending]);

  return {
    status: {
      ...status,
      clientId,
      linked: !!link,
    },
    link,
    connect,
    disconnect,
    pullDernier,
    pushPending,
    repairPending,
  };
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Drive indisponible — état local conservé.";
}
