import { describe, it, expect } from 'vitest';
import { computeRingRadius } from '../carousel/ringGeometry.js';

// The property that actually matters: the planes must tile the ring leaving
// exactly the requested proportion of each slot empty, at any count.
const angularWidth = (planeWidth, radius) => 2 * Math.atan(planeWidth / 2 / radius);
const slot = (count) => (2 * Math.PI) / count;

describe('computeRingRadius', () => {
	it('makes planes exactly meet at gap 0, for every realistic count', () => {
		for (let count = 3; count <= 20; count++) {
			const r = computeRingRadius({ planeWidth: 3.6, count, gap: 0 });
			expect(angularWidth(3.6, r)).toBeCloseTo(slot(count), 10);
		}
	});

	it('leaves exactly the requested fraction of each slot empty', () => {
		for (const gap of [0.05, 0.1, 0.25]) {
			for (const count of [4, 8, 13]) {
				const r = computeRingRadius({ planeWidth: 3.6, count, gap });
				const empty = (slot(count) - angularWidth(3.6, r)) / slot(count);
				expect(empty).toBeCloseTo(gap, 10);
			}
		}
	});

	it('holds the gap-to-plane ratio constant as the count changes', () => {
		// This is what "proportional" buys: the gap reads the same relative to a
		// teaser whether five or fifteen entries are featured.
		const ratio = (count) => {
			const r = computeRingRadius({ planeWidth: 3.6, count, gap: 0.1 });
			const w = angularWidth(3.6, r);
			return (slot(count) - w) / w;
		};
		const five = ratio(5);
		for (const count of [6, 8, 12, 20]) {
			expect(ratio(count)).toBeCloseTo(five, 10);
		}
	});

	it('grows the radius as entries are added', () => {
		const five = computeRingRadius({ planeWidth: 3.6, count: 5, gap: 0.1 });
		const eight = computeRingRadius({ planeWidth: 3.6, count: 8, gap: 0.1 });
		expect(eight).toBeGreaterThan(five);
	});

	it('grows the radius as the gap widens', () => {
		const tight = computeRingRadius({ planeWidth: 3.6, count: 8, gap: 0 });
		const loose = computeRingRadius({ planeWidth: 3.6, count: 8, gap: 0.2 });
		expect(loose).toBeGreaterThan(tight);
	});

	it('matches the hand-computed radius for 8 entries touching', () => {
		// 1.8 / tan(22.5deg) = 4.3457
		expect(computeRingRadius({ planeWidth: 3.6, count: 8, gap: 0 })).toBeCloseTo(4.3457, 3);
	});

	it('scales with plane width at a fixed count', () => {
		const narrow = computeRingRadius({ planeWidth: 2, count: 8, gap: 0.1 });
		const wide = computeRingRadius({ planeWidth: 4, count: 8, gap: 0.1 });
		expect(wide).toBeCloseTo(narrow * 2, 10);
	});

	it('stays clear of the camera near plane for degenerate counts', () => {
		// count 1 and 2 have a half-slot of 180deg/90deg, where the naive solve
		// divides by a zero or negative tangent.
		for (const count of [1, 2]) {
			const r = computeRingRadius({ planeWidth: 3.6, count, gap: 0.1 });
			expect(Number.isFinite(r)).toBe(true);
			expect(r).toBeGreaterThanOrEqual(0.5);
		}
	});

	it('never returns a non-finite radius for bad input', () => {
		const cases = [
			{ planeWidth: NaN, count: 8, gap: 0.1 },
			{ planeWidth: 3.6, count: NaN, gap: 0.1 },
			{ planeWidth: 3.6, count: 8, gap: NaN },
			{ planeWidth: 3.6, count: 0, gap: 0.1 },
			{ planeWidth: 3.6, count: -5, gap: 0.1 },
			// A full-slot gap leaves no angular width, which solves to infinity.
			{ planeWidth: 3.6, count: 8, gap: 1 },
			{ planeWidth: 3.6, count: 8, gap: 5 },
			{ planeWidth: 3.6, count: 8, gap: -1 }
		];
		for (const c of cases) {
			const r = computeRingRadius(c);
			expect(Number.isFinite(r)).toBe(true);
			expect(r).toBeGreaterThanOrEqual(0.5);
		}
	});
});
