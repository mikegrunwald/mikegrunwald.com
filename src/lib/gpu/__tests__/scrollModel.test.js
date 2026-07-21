import { describe, it, expect } from 'vitest';
import { composeRotation, shouldLoopRunway, wrapScrollPosition } from '../carousel/scrollModel.js';

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

describe('shouldLoopRunway', () => {
	it('loops when the runway is exhausted going down', () => {
		expect(shouldLoopRunway({ progress: 1, direction: 1 })).toBe(true);
	});

	it('does not loop mid-runway going down', () => {
		expect(shouldLoopRunway({ progress: 0.99, direction: 1 })).toBe(false);
	});

	it('does not loop at the runway end going up', () => {
		// Scrolling up is bounded to one rotation and must release into the
		// preceding section, so the upward direction never wraps.
		expect(shouldLoopRunway({ progress: 1, direction: -1 })).toBe(false);
	});

	it('does not loop at the runway start going up', () => {
		expect(shouldLoopRunway({ progress: 0, direction: -1 })).toBe(false);
	});

	it('does not loop on non-finite progress', () => {
		expect(shouldLoopRunway({ progress: NaN, direction: 1 })).toBe(false);
	});
});

describe('wrapScrollPosition', () => {
	const runway = { start: 1000, end: 2400 }; // 1400px runway

	it('preserves the overshoot remainder instead of snapping to start', () => {
		// 300px past the end must land 300px into the runway, not at its start.
		const y = wrapScrollPosition({ current: 2700, ...runway });
		expect(y).toBeCloseTo(1300, 10);
	});

	it('handles an overshoot larger than a full runway', () => {
		// 1.5 runways past the start -> half a runway in.
		const y = wrapScrollPosition({ current: 1000 + 1400 * 1.5, ...runway });
		expect(y).toBeCloseTo(1700, 10);
	});

	it('never lands exactly on the boundary, which would unpin', () => {
		// Exactly one runway past the start -> remainder 0 -> nudged inside.
		const y = wrapScrollPosition({ current: 2400, ...runway });
		expect(y).toBe(1001);
	});

	it('keeps a negative overshoot inside the runway', () => {
		const y = wrapScrollPosition({ current: 900, ...runway });
		expect(y).toBeGreaterThanOrEqual(runway.start);
		expect(y).toBeLessThan(runway.end);
	});

	it('returns null for a degenerate runway rather than teleporting', () => {
		expect(wrapScrollPosition({ current: 1500, start: 1000, end: 1000 })).toBeNull();
		expect(wrapScrollPosition({ current: 1500, start: 2000, end: 1000 })).toBeNull();
		expect(wrapScrollPosition({ current: NaN, ...runway })).toBeNull();
	});
});
