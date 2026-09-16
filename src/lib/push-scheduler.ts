/**
 * Anti-rafale des envois automatiques du carnet (R8.5).
 *
 * L'auto-push est déclenché par le tableau `pendingMoves` : une rafale de
 * modifications (plusieurs sorties saisies d'affilée sur le téléphone) lançait
 * autant d'envois successifs, chacun étant un *read-merge-write* complet du
 * carnet distant. On regroupe désormais les modifications rapprochées en un
 * seul envoi, avec un intervalle minimal entre deux envois.
 *
 * Horloge et minuteurs sont injectables : la logique est testable sans React
 * (voir `push-scheduler.test.ts`).
 */

export type PushSchedulerOptions = {
  /** Regroupement des modifications rapprochées (ms). */
  delayMs?: number;
  /** Intervalle minimal entre deux envois effectifs (ms). */
  minIntervalMs?: number;
  /** Envoi effectif (idempotent côté appelant). */
  onPush: () => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export const PUSH_DEBOUNCE_MS = 1_200;
export const PUSH_MIN_INTERVAL_MS = 5_000;

export type PushScheduler = {
  /** Programme un envoi ; les appels rapprochés sont regroupés. */
  schedule: () => void;
  /** Annule l'envoi programmé (démontage, déconnexion). */
  cancel: () => void;
  /** Un envoi est-il programmé ? (diagnostic, tests) */
  isPending: () => boolean;
  /** Délai d'attente qui serait appliqué maintenant (diagnostic, tests). */
  nextDelayMs: () => number;
};

export function createPushScheduler(opts: PushSchedulerOptions): PushScheduler {
  const delayMs = Math.max(0, opts.delayMs ?? PUSH_DEBOUNCE_MS);
  const minIntervalMs = Math.max(0, opts.minIntervalMs ?? PUSH_MIN_INTERVAL_MS);
  const now = opts.now ?? (() => Date.now());
  const setTimer =
    opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    opts.clearTimer ??
    ((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });

  let handle: unknown = null;
  let lastRunAt = 0;

  const waitFor = (): number => {
    const sinceLast = lastRunAt === 0 ? Number.POSITIVE_INFINITY : now() - lastRunAt;
    return Math.max(delayMs, minIntervalMs - sinceLast);
  };

  return {
    schedule() {
      if (handle !== null) clearTimer(handle);
      handle = setTimer(() => {
        handle = null;
        lastRunAt = now();
        opts.onPush();
      }, waitFor());
    },
    cancel() {
      if (handle !== null) {
        clearTimer(handle);
        handle = null;
      }
    },
    isPending() {
      return handle !== null;
    },
    nextDelayMs: waitFor,
  };
}
