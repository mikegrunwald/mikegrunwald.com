import { describe, it, expect } from 'vitest';
import {
	computeRingRadius,
	computeRequiredPlanes,
	computeRingPlan,
	selectPlayingTeasers
} from '../carousel/ringGeometry.js';

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

describe('computeRequiredPlanes', () => {
	const req = (vw, vh, gap = 0.1) => computeRequiredPlanes({ fovDeg: 50, aspect: vw / vh, gap });

	it('demands far more planes on a portrait phone than a desktop', () => {
		expect(req(430, 930)).toBe(14);
		expect(req(375, 812)).toBe(14);
		expect(req(768, 1024)).toBe(9);
		expect(req(1440, 900)).toBe(5);
		expect(req(2560, 1080)).toBe(4);
	});

	it('is satisfiable — the returned count actually fits the frustum', () => {
		for (const [vw, vh] of [
			[375, 812],
			[430, 930],
			[768, 1024],
			[1440, 900],
			[2560, 1080]
		]) {
			const aspect = vw / vh;
			const n = computeRequiredPlanes({ fovDeg: 50, aspect, gap: 0.1 });
			// The whole point: at this count, a plane tiling its slot still fits.
			const arc = fovH(50, aspect);
			expect(((2 * Math.PI) / n) * 0.9).toBeLessThanOrEqual(arc + 1e-9);
		}
	});

	it('grows monotonically as the viewport narrows', () => {
		const wide = computeRequiredPlanes({ fovDeg: 50, aspect: 2.37, gap: 0.1 });
		const square = computeRequiredPlanes({ fovDeg: 50, aspect: 1, gap: 0.1 });
		const tall = computeRequiredPlanes({ fovDeg: 50, aspect: 0.46, gap: 0.1 });
		expect(square).toBeGreaterThanOrEqual(wide);
		expect(tall).toBeGreaterThan(square);
	});

	it('stays bounded and finite for degenerate input', () => {
		for (const args of [
			{ fovDeg: 50, aspect: 0.001, gap: 0.1 },
			{ fovDeg: 0, aspect: 1, gap: 0.1 },
			{ fovDeg: 50, aspect: 0, gap: 0.1 },
			{ fovDeg: NaN, aspect: NaN, gap: NaN }
		]) {
			const n = computeRequiredPlanes(args);
			expect(Number.isInteger(n)).toBe(true);
			expect(n).toBeGreaterThanOrEqual(1);
			expect(n).toBeLessThanOrEqual(48);
		}
	});
});

describe('computeRingPlan', () => {
	it('repeats teasers until the required plane count is met', () => {
		// A phone needs 14 planes; 8 teasers reach it by repeating twice.
		expect(computeRingPlan({ teaserCount: 8, requiredPlanes: 14 })).toEqual({
			repeats: 2,
			planeCount: 16
		});
	});

	it('does not repeat when there are already enough teasers', () => {
		expect(computeRingPlan({ teaserCount: 8, requiredPlanes: 5 })).toEqual({
			repeats: 1,
			planeCount: 8
		});
	});

	it('always yields a whole multiple of the teaser count', () => {
		// Load-bearing: plane j shows teaser j % teaserCount, so a non-multiple
		// would bunch the remainder and make the seamless wrap visibly jump.
		for (let teaserCount = 1; teaserCount <= 12; teaserCount++) {
			for (const requiredPlanes of [1, 5, 9, 14, 21, 40]) {
				const { planeCount, repeats } = computeRingPlan({ teaserCount, requiredPlanes });
				expect(planeCount % teaserCount).toBe(0);
				expect(planeCount).toBe(teaserCount * repeats);
			}
		}
	});

	it('handles having no teasers at all', () => {
		expect(computeRingPlan({ teaserCount: 0, requiredPlanes: 14 })).toEqual({
			repeats: 0,
			planeCount: 0
		});
	});

	it('stays within the plane ceiling', () => {
		const { planeCount } = computeRingPlan({ teaserCount: 7, requiredPlanes: 1000 });
		expect(planeCount).toBeLessThanOrEqual(48 + 7);
		expect(planeCount % 7).toBe(0);
	});
});

describe('selectPlayingTeasers', () => {
	const PHONE = { fovDeg: 50, aspect: 430 / 930 };

	it('plays far fewer teasers than the ring holds', () => {
		const playing = selectPlayingTeasers({
			planeCount: 16,
			teaserCount: 8,
			rotation: 0,
			...PHONE,
			marginDeg: 20
		});
		// This is the whole point: 16 planes on screen, a handful decoding.
		expect(playing.size).toBeGreaterThan(0);
		expect(playing.size).toBeLessThan(8);
	});

	it('only ever returns valid teaser indices', () => {
		for (let i = 0; i < 40; i++) {
			const playing = selectPlayingTeasers({
				planeCount: 16,
				teaserCount: 8,
				rotation: (i / 40) * Math.PI * 2,
				...PHONE
			});
			for (const idx of playing) {
				expect(Number.isInteger(idx)).toBe(true);
				expect(idx).toBeGreaterThanOrEqual(0);
				expect(idx).toBeLessThan(8);
			}
		}
	});

	it('never goes silent as the ring rotates', () => {
		// A rotation that selected nothing would blank the visible teaser.
		for (let i = 0; i < 90; i++) {
			const playing = selectPlayingTeasers({
				planeCount: 16,
				teaserCount: 8,
				rotation: (i / 90) * Math.PI * 2,
				...PHONE
			});
			expect(playing.size).toBeGreaterThan(0);
		}
	});

	it('selects more on a wide viewport than a narrow one', () => {
		const args = { planeCount: 16, teaserCount: 8, rotation: 0, fovDeg: 50 };
		const narrow = selectPlayingTeasers({ ...args, aspect: 430 / 930 });
		const wide = selectPlayingTeasers({ ...args, aspect: 2560 / 1080 });
		expect(wide.size).toBeGreaterThan(narrow.size);
	});

	it('falls back to playing everything when the frustum is unknown', () => {
		// Better a heavy ring than a silently blank one.
		const playing = selectPlayingTeasers({
			planeCount: 16,
			teaserCount: 8,
			rotation: 0,
			fovDeg: 0,
			aspect: 0
		});
		expect(playing.size).toBe(8);
	});

	it('handles an empty ring', () => {
		expect(
			selectPlayingTeasers({ planeCount: 0, teaserCount: 0, rotation: 0, ...PHONE }).size
		).toBe(0);
	});
});
