/**
 * Tests du planificateur d'envoi (R8.5) — horloge et minuteurs injectés,
 * donc aucun test flaky : rien n'attend réellement.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createPushScheduler } from "./push-scheduler.ts";

type Timer = { at: number; fn: () => void };

function fakeClock() {
	let time = 0;
	let seq = 0;
	const timers = new Map<number, Timer>();
	return {
		now: () => time,
		setTimer: (fn: () => void, ms: number) => {
			seq += 1;
			timers.set(seq, { at: time + ms, fn });
			return seq;
		},
		clearTimer: (handle: unknown) => {
			timers.delete(handle as number);
		},
		advance(ms: number) {
			const target = time + ms;
			for (;;) {
				const due = [...timers.entries()]
					.filter(([, t]) => t.at <= target)
					.sort((a, b) => a[1].at - b[1].at)[0];
				if (!due) break;
				timers.delete(due[0]);
				time = due[1].at;
				due[1].fn();
			}
			time = target;
		},
		pending: () => timers.size,
	};
}

function schedulerWith(clock: ReturnType<typeof fakeClock>, pushes: number[]) {
	return createPushScheduler({
		onPush: () => {
			pushes.push(clock.now());
		},
		now: clock.now,
		setTimer: clock.setTimer,
		clearTimer: clock.clearTimer,
	});
}

test("R8.5 — une salve de modifications ne déclenche qu'un seul envoi", () => {
	const clock = fakeClock();
	const pushes: number[] = [];
	const s = schedulerWith(clock, pushes);
	s.schedule();
	clock.advance(300);
	s.schedule();
	clock.advance(300);
	s.schedule();
	assert.equal(pushes.length, 0, "aucun envoi pendant la rafale");
	assert.equal(clock.pending(), 1, "un seul minuteur en attente");
	clock.advance(1_200);
	assert.equal(pushes.length, 1);
});

test("R8.5 — cancel annule l'envoi programmé", () => {
	const clock = fakeClock();
	const pushes: number[] = [];
	const s = schedulerWith(clock, pushes);
	s.schedule();
	assert.equal(s.isPending(), true);
	s.cancel();
	assert.equal(s.isPending(), false);
	clock.advance(60_000);
	assert.equal(pushes.length, 0);
});

test("R8.5 — deux envois respectent l'intervalle minimal", () => {
	const clock = fakeClock();
	const pushes: number[] = [];
	const s = schedulerWith(clock, pushes);
	s.schedule();
	clock.advance(1_200);
	assert.deepEqual(pushes, [1_200]);
	// Nouvelle modification juste après : l'envoi attend l'intervalle minimal.
	s.schedule();
	assert.ok(s.nextDelayMs() >= 5_000, `attente ${s.nextDelayMs()}`);
	clock.advance(3_000);
	assert.equal(pushes.length, 1, "pas de second envoi avant l'intervalle");
	clock.advance(2_200);
	assert.deepEqual(pushes, [1_200, 6_200]);
});

test("R8.5 — le premier envoi n'attend pas l'intervalle minimal", () => {
	const clock = fakeClock();
	const pushes: number[] = [];
	const s = schedulerWith(clock, pushes);
	assert.ok(s.nextDelayMs() <= 1_200);
	s.schedule();
	clock.advance(1_200);
	assert.equal(pushes.length, 1);
});
