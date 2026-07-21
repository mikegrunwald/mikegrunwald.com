import { describe, it, expect } from 'vitest';
import { computeRingRadius } from '../carousel/ringGeometry.js';

// The property that actually matters: the planes must tile the ring leaving
// exactly the requested proportion of each slot empty, at any count.
const angularWidth = (planeWidth, radius) => 2 * Math.atan(planeWidth / 2 / radius);
const slot = (count) => (2 * Math.PI) / count;

// Frustum helpers, mirroring what the camera does.
const fovH = (fovDeg, aspect) => 2 * Math.atan(Math.tan((fovDeg * Math.PI) / 180 / 2) * aspect);
const fovV = (fovDeg) => (fovDeg * Math.PI) / 180;

const DESKTOP = { fovDeg: 50, aspect: 1440 / 900, fit: 0.9 };
const PHONE = { fovDeg: 50, aspect: 430 / 930, fit: 0.9 };

describe('computeRingRadius — frustum fitting', () => {
	it('fits a teaser inside a portrait phone viewport on both axes', () => {
		const W = 2.6;
		const H = 1.46;
		const r = computeRingRadius({
			planeWidth: W,
			planeHeight: H,
			count: 4,
			gap: 0.1,
			...PHONE
		});
		expect(angularWidth(W, r)).toBeLessThanOrEqual(fovH(PHONE.fovDeg, PHONE.aspect));
		expect(angularWidth(H, r)).toBeLessThanOrEqual(fovV(PHONE.fovDeg));
	});

	it('is the constraint that binds on a phone, not ring tiling', () => {
		const args = { planeWidth: 2.6, planeHeight: 1.46, count: 4, gap: 0.1 };
		const ringOnly = computeRingRadius(args);
		const fitted = computeRingRadius({ ...args, ...PHONE });
		// Ring tiling alone puts the plane at 1.52, deep inside the frustum.
		expect(fitted).toBeGreaterThan(ringOnly * 3);
	});

	it('leaves a wide desktop viewport untouched — ring tiling still binds', () => {
		const args = { planeWidth: 3.6, planeHeight: 2.03, count: 8, gap: 0.1 };
		const ringOnly = computeRingRadius(args);
		const fitted = computeRingRadius({ ...args, ...DESKTOP });
		expect(fitted).toBeCloseTo(ringOnly, 10);
	});

	it('fits across a spread of real viewport aspects', () => {
		const W = 2.6;
		const H = 1.46;
		const viewports = [
			[375, 812],
			[430, 930],
			[390, 844],
			[768, 1024],
			[1024, 768],
			[1440, 900],
			[2560, 1080]
		];
		for (const [vw, vh] of viewports) {
			const aspect = vw / vh;
			const r = computeRingRadius({
				planeWidth: W,
				planeHeight: H,
				count: 4,
				gap: 0.1,
				fovDeg: 50,
				aspect,
				fit: 0.9
			});
			expect(angularWidth(W, r)).toBeLessThanOrEqual(fovH(50, aspect) + 1e-9);
			expect(angularWidth(H, r)).toBeLessThanOrEqual(fovV(50) + 1e-9);
		}
	});

	it('pushes the ring further out as the viewport narrows', () => {
		const args = { planeWidth: 2.6, planeHeight: 1.46, count: 4, gap: 0.1, fovDeg: 50, fit: 0.9 };
		const wide = computeRingRadius({ ...args, aspect: 16 / 9 });
		const square = computeRingRadius({ ...args, aspect: 1 });
		const tall = computeRingRadius({ ...args, aspect: 430 / 930 });
		expect(square).toBeGreaterThan(wide);
		expect(tall).toBeGreaterThan(square);
	});

	it('respects fit as the on-screen size control once the frustum binds', () => {
		const args = { planeWidth: 2.6, planeHeight: 1.46, count: 4, gap: 0.1, ...PHONE };
		const loose = computeRingRadius({ ...args, fit: 0.6 });
		const tight = computeRingRadius({ ...args, fit: 0.95 });
		// A smaller fit means a smaller teaser, i.e. pushed further away.
		expect(loose).toBeGreaterThan(tight);
	});

	it('falls back to ring tiling when the frustum is unknown or degenerate', () => {
		const args = { planeWidth: 2.6, planeHeight: 1.46, count: 4, gap: 0.1 };
		const ringOnly = computeRingRadius(args);
		for (const bad of [
			{},
			{ fovDeg: 0, aspect: 1 },
			{ fovDeg: 50, aspect: 0 },
			{ fovDeg: NaN, aspect: 1 },
			{ fovDeg: 50, aspect: NaN },
			{ fovDeg: -50, aspect: 1 }
		]) {
			expect(computeRingRadius({ ...args, ...bad })).toBeCloseTo(ringOnly, 10);
		}
	});

	it('never returns a non-finite radius for bad frustum input', () => {
		const args = { planeWidth: 2.6, planeHeight: 1.46, count: 4, gap: 0.1 };
		for (const bad of [
			{ fovDeg: 50, aspect: 0.01, fit: 1 },
			{ fovDeg: 179, aspect: 1, fit: 1 },
			{ fovDeg: 50, aspect: 1, fit: NaN },
			{ fovDeg: 50, aspect: 1, fit: 0 },
			{ fovDeg: 50, aspect: 1, fit: 99 },
			{ fovDeg: 50, aspect: 1e6, fit: 0.9 }
		]) {
			const r = computeRingRadius({ ...args, ...bad });
			expect(Number.isFinite(r)).toBe(true);
			expect(r).toBeGreaterThanOrEqual(0.5);
		}
	});
});

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
