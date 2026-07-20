import { describe, it, expect } from 'vitest';
import { tiltRamp, tiltFalloff, TILT_MARGIN } from '../particles/tiltFalloff.js';

describe('tiltRamp', () => {
	it('is 1 everywhere inside the box', () => {
		for (const v of [0, 0.25, 0.5, 0.75, 1]) expect(tiltRamp(v)).toBe(1);
	});

	it('ramps linearly to 0 across the margin on both sides', () => {
		expect(tiltRamp(-TILT_MARGIN / 2)).toBeCloseTo(0.5, 6);
		expect(tiltRamp(1 + TILT_MARGIN / 2)).toBeCloseTo(0.5, 6);
		expect(tiltRamp(-TILT_MARGIN)).toBeCloseTo(0, 6);
		expect(tiltRamp(1 + TILT_MARGIN)).toBeCloseTo(0, 6);
	});

	it('stays 0 beyond the margin (never negative — that would invert the tilt)', () => {
		for (const v of [-0.5, -5, 1.5, 12]) expect(tiltRamp(v)).toBe(0);
	});

	// The actual bug this module exists to prevent: the old code jumped from
	// full tilt to zero at the margin edge.
	it('is continuous across the margin edge', () => {
		const eps = 1e-4;
		const inside = tiltRamp(1 + TILT_MARGIN - eps);
		const outside = tiltRamp(1 + TILT_MARGIN + eps);
		expect(Math.abs(inside - outside)).toBeLessThan(1e-3);
	});

	it('never steps by more than the sample distance anywhere in the sweep', () => {
		const step = 1e-3;
		let prev = tiltRamp(-1);
		for (let v = -1; v <= 2; v += step) {
			const cur = tiltRamp(v);
			// slope is at most 1/TILT_MARGIN, so |delta| <= step / TILT_MARGIN
			expect(Math.abs(cur - prev)).toBeLessThanOrEqual(step / TILT_MARGIN + 1e-9);
			prev = cur;
		}
	});

	it('returns 0 for non-finite input instead of propagating NaN', () => {
		expect(tiltRamp(NaN)).toBe(0);
		expect(tiltRamp(Infinity)).toBe(0);
		expect(tiltRamp(-Infinity)).toBe(0);
	});
});

describe('tiltFalloff', () => {
	it('is full strength at the box center and zero outside the margin', () => {
		expect(tiltFalloff(0.5, 0.5)).toBe(1);
		expect(tiltFalloff(2, 0.5)).toBe(0);
		expect(tiltFalloff(0.5, -1)).toBe(0);
	});

	it('multiplies the two axes', () => {
		expect(tiltFalloff(-TILT_MARGIN / 2, 1 + TILT_MARGIN / 2)).toBeCloseTo(0.25, 6);
	});

	it('is zero if either axis is non-finite', () => {
		expect(tiltFalloff(NaN, 0.5)).toBe(0);
		expect(tiltFalloff(0.5, NaN)).toBe(0);
	});
});
