import { describe, it, expect } from 'vitest';
import { soundConfig, EVENTS, NONE } from '../config.js';
import { SOUND_NAMES } from '../core/index.js';

describe('soundConfig', () => {
	it('exposes the three cursor events in order', () => {
		expect(EVENTS).toEqual(['enter', 'leave', 'click']);
	});

	it('has a value for every event that is a string', () => {
		for (const e of EVENTS) {
			expect(typeof soundConfig[e]).toBe('string');
		}
	});

	// The upper bound is 10, not 1: `volume` is passed straight through to the
	// @web-kits/audio patch (engine.js), which treats it as a gain multiplier
	// rather than a normalised 0..1 level, and the committed value is tuned in
	// the ?debug Sounds panel. The assertion is a guard against a paste-back
	// typo putting an absurd value into production, not a claim about the range.
	it('has a sane default volume and unmuted state', () => {
		expect(soundConfig.volume).toBeGreaterThan(0);
		expect(soundConfig.volume).toBeLessThanOrEqual(10);
		expect(soundConfig.muted).toBe(false);
	});

	it('exports the none sentinel', () => {
		expect(NONE).toBe('none');
	});

	it('every event default is a known sound or none', () => {
		for (const e of EVENTS) {
			expect([...SOUND_NAMES, NONE]).toContain(soundConfig[e]);
		}
	});
});
