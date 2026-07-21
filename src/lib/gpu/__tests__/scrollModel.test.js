import { describe, it, expect } from 'vitest';
import { composeRotation } from '../carousel/scrollModel.js';

const TAU = Math.PI * 2;

describe('composeRotation', () => {
	const base = { rotationsPerScroll: 1, preRollTurns: 0.2 };

	it('is zero before the section is approached', () => {
		expect(composeRotation({ ...base, preRoll: 0, progress: 0 })).toBeCloseTo(0, 10);
	});

	it('contributes exactly preRollTurns when the approach completes', () => {
		expect(composeRotation({ ...base, preRoll: 1, progress: 0 })).toBeCloseTo(0.2 * TAU, 10);
	});

	it('adds the pinned progress on top of a completed pre-roll', () => {
		// one full pinned rotation plus the 0.2-turn pre-roll
		expect(composeRotation({ ...base, preRoll: 1, progress: 1 })).toBeCloseTo(1.2 * TAU, 10);
	});

	it('scales the pinned contribution by rotationsPerScroll', () => {
		const r = composeRotation({ ...base, preRoll: 0, progress: 0.5, rotationsPerScroll: 2 });
		expect(r).toBeCloseTo(1 * TAU, 10);
	});

	it('is monotonic across the pre-roll/pin handover', () => {
		const justBefore = composeRotation({ ...base, preRoll: 1, progress: 0 });
		const justAfter = composeRotation({ ...base, preRoll: 1, progress: 0.001 });
		expect(justAfter).toBeGreaterThan(justBefore);
	});

	it('treats non-finite inputs as zero rather than propagating NaN', () => {
		expect(composeRotation({ ...base, preRoll: NaN, progress: 0.5 })).toBeCloseTo(0.5 * TAU, 10);
		expect(composeRotation({ ...base, preRoll: 0.5, progress: NaN })).toBeCloseTo(0.1 * TAU, 10);
	});
});
