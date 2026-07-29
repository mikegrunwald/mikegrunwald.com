import { ensureReady } from '@web-kits/audio';
import { SOUNDS } from './core/index.js';
import { soundConfig, NONE } from './config.js';

// Pure: the single decision point for whether a play should make noise.
export function shouldPlay(name, { muted, unlocked }) {
	return Boolean(name) && name !== NONE && !muted && unlocked;
}

let unlocked = false;

export function isUnlocked() {
	return unlocked;
}

// Idempotent. Called from the first user gesture (wired in Task 4). The library
// owns the AudioContext; ensureReady() creates/resumes it. Guarded so importing
// this module in a non-browser (test) env never triggers audio.
export async function unlock() {
	if (unlocked || typeof window === 'undefined') return;
	await ensureReady();
	unlocked = true;
}

// Fire-and-forget. Reads live config so panel edits take effect on the next call.
export function play(name) {
	if (!shouldPlay(name, { muted: soundConfig.muted, unlocked })) return;
	SOUNDS[name]?.({ volume: soundConfig.volume });
}
