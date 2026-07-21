import { describe, it, expect } from 'vitest';
import { computeRingRadius } from '../carousel/ringGeometry.js';

// The property that actually matters: at fill 1 the planes must exactly tile
// the ring — every plane's angular width equal to its slot, so no gap and no
// overlap at any count.
const angularWidth = (planeWidth, radius) => 2 * Math.atan(planeWidth / 2 / radius);
const slot = (count) => (2 * Math.PI) / count;

describe('computeRingRadius', () => {
	it('makes planes exactly tile the ring at fill 1, for every realistic count', () => {
		for (let count = 3; count <= 20; count++) {
			const r = computeRingRadius({ planeWidth: 3.6, count, fill: 1 });
			expect(angularWidth(3.6, r)).toBeCloseTo(slot(count), 10);
		}
	});

	it('grows the radius as entries are added', () => {
		const five = computeRingRadius({ planeWidth: 3.6, count: 5, fill: 1 });
		const eight = computeRingRadius({ planeWidth: 3.6, count: 8, fill: 1 });
		expect(eight).toBeGreaterThan(five);
	});

	it('matches the hand-computed radius for the current 8 featured entries', () => {
		// 1.8 / tan(22.5deg) = 4.3457
		expect(computeRingRadius({ planeWidth: 3.6, count: 8, fill: 1 })).toBeCloseTo(4.3457, 3);
	});

	it('leaves a gap below fill 1 and overlaps above it', () => {
		const r = (fill) => computeRingRadius({ planeWidth: 3.6, count: 8, fill });
		expect(angularWidth(3.6, r(0.9))).toBeLessThan(slot(8));
		expect(angularWidth(3.6, r(1.1))).toBeGreaterThan(slot(8));
	});

	it('scales with plane width at a fixed count', () => {
		const narrow = computeRingRadius({ planeWidth: 2, count: 8, fill: 1 });
		const wide = computeRingRadius({ planeWidth: 4, count: 8, fill: 1 });
		expect(wide).toBeCloseTo(narrow * 2, 10);
	});

	it('stays clear of the camera near plane for degenerate counts', () => {
		// count 1 and 2 have a half-slot of 180deg/90deg, where the naive solve
		// divides by a zero or negative tangent.
		for (const count of [1, 2]) {
			const r = computeRingRadius({ planeWidth: 3.6, count, fill: 1 });
			expect(Number.isFinite(r)).toBe(true);
			expect(r).toBeGreaterThanOrEqual(0.5);
		}
	});

	it('never returns a non-finite radius for bad input', () => {
		const cases = [
			{ planeWidth: NaN, count: 8, fill: 1 },
			{ planeWidth: 3.6, count: NaN, fill: 1 },
			{ planeWidth: 3.6, count: 8, fill: NaN },
			{ planeWidth: 3.6, count: 0, fill: 1 },
			{ planeWidth: 3.6, count: -5, fill: 1 },
			{ planeWidth: 3.6, count: 8, fill: 0 }
		];
		for (const c of cases) {
			const r = computeRingRadius(c);
			expect(Number.isFinite(r)).toBe(true);
			expect(r).toBeGreaterThanOrEqual(0.5);
		}
	});
});
