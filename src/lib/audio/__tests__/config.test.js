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

	it('has a sane default volume and unmuted state', () => {
		expect(soundConfig.volume).toBeGreaterThan(0);
		expect(soundConfig.volume).toBeLessThanOrEqual(1);
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
