import { describe, it, expect } from 'vitest';
import { coverRect } from '../carousel/coverFit.js';

// The defining property of cover: the crop has the DESTINATION's aspect ratio,
// stays inside the source, and is centred.
const aspect = (r) => r.sw / r.sh;

describe('coverRect', () => {
	it('crops the sides when the source is wider than the destination', () => {
		// 16:9 source into a portrait phone box.
		const r = coverRect({ srcW: 1920, srcH: 1080, dstW: 430, dstH: 930 });
		expect(aspect(r)).toBeCloseTo(430 / 930, 10);
		expect(r.sh).toBe(1080); // full height used
		expect(r.sw).toBeLessThan(1920);
		expect(r.sx).toBeCloseTo((1920 - r.sw) / 2, 10); // centred
		expect(r.sy).toBe(0);
	});

	it('crops top and bottom when the source is taller than the destination', () => {
		// Square source into a wide box.
		const r = coverRect({ srcW: 1000, srcH: 1000, dstW: 1600, dstH: 900 });
		expect(aspect(r)).toBeCloseTo(1600 / 900, 10);
		expect(r.sw).toBe(1000); // full width used
		expect(r.sh).toBeLessThan(1000);
		expect(r.sy).toBeCloseTo((1000 - r.sh) / 2, 10); // centred
		expect(r.sx).toBe(0);
	});

	it('uses the whole source when the aspects match', () => {
		const r = coverRect({ srcW: 1920, srcH: 1080, dstW: 1280, dstH: 720 });
		expect(r).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
	});

	it('never crops outside the source', () => {
		const cases = [
			{ srcW: 1920, srcH: 1080, dstW: 100, dstH: 3000 },
			{ srcW: 1920, srcH: 1080, dstW: 3000, dstH: 100 },
			{ srcW: 640, srcH: 480, dstW: 1682, dstH: 1274 }
		];
		for (const c of cases) {
			const r = coverRect(c);
			expect(r.sx).toBeGreaterThanOrEqual(0);
			expect(r.sy).toBeGreaterThanOrEqual(0);
			expect(r.sx + r.sw).toBeLessThanOrEqual(c.srcW + 1e-9);
			expect(r.sy + r.sh).toBeLessThanOrEqual(c.srcH + 1e-9);
		}
	});

	it('matches the real transition case: 16:9 video into the measured viewport', () => {
		// The traced run: 1920x1080 source, 1682x1274 fullscreen destination.
		const r = coverRect({ srcW: 1920, srcH: 1080, dstW: 1682, dstH: 1274 });
		expect(aspect(r)).toBeCloseTo(1682 / 1274, 10);
		expect(r.sh).toBe(1080);
	});

	it('returns a usable rect for degenerate input rather than NaN', () => {
		for (const bad of [
			{ srcW: 0, srcH: 1080, dstW: 100, dstH: 100 },
			{ srcW: 1920, srcH: 0, dstW: 100, dstH: 100 },
			{ srcW: 1920, srcH: 1080, dstW: 0, dstH: 100 },
			{ srcW: NaN, srcH: 1080, dstW: 100, dstH: 100 },
			{ srcW: 1920, srcH: 1080, dstW: 100, dstH: NaN }
		]) {
			const r = coverRect(bad);
			for (const v of [r.sx, r.sy, r.sw, r.sh]) {
				expect(Number.isFinite(v)).toBe(true);
			}
			expect(r.sw).toBeGreaterThan(0);
			expect(r.sh).toBeGreaterThan(0);
		}
	});
});
