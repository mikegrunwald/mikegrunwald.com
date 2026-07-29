import { describe, it, expect } from 'vitest';
import { shouldPlay } from '../engine.js';

const ready = { muted: false, unlocked: true };

describe('shouldPlay', () => {
	it('plays a real sound when ready', () => {
		expect(shouldPlay('modal-open', ready)).toBe(true);
	});

	it('never plays the none sentinel', () => {
		expect(shouldPlay('none', ready)).toBe(false);
	});

	it('never plays null/undefined/empty', () => {
		expect(shouldPlay(null, ready)).toBe(false);
		expect(shouldPlay(undefined, ready)).toBe(false);
		expect(shouldPlay('', ready)).toBe(false);
	});

	it('stays silent while muted', () => {
		expect(shouldPlay('modal-open', { muted: true, unlocked: true })).toBe(false);
	});

	it('stays silent before the audio context is unlocked', () => {
		expect(shouldPlay('modal-open', { muted: false, unlocked: false })).toBe(false);
	});
});
