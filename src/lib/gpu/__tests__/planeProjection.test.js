import { describe, it, expect } from 'vitest';
import { videoCorners } from '../carousel/planeProjection.js';

// Defaults from CarouselScene.params: 3.6 x 2.03 video, 0.15 pad per side.
const DEFAULTS = { videoHalfX: 1.8, videoHalfY: 1.015, quadHalfX: 1.95, quadHalfY: 1.165 };

describe('videoCorners', () => {
	it('returns the video extent, not the padded quad', () => {
		const corners = videoCorners(DEFAULTS);
		const xs = corners.map(([x]) => x);
		const ys = corners.map(([, y]) => y);
		// 1.8 / 1.95 and 1.015 / 1.165 — inside the -1..1 quad, not at its edge.
		expect(Math.max(...xs)).toBeCloseTo(0.923077, 5);
		expect(Math.max(...ys)).toBeCloseTo(0.871245, 5);
	});

	it('is symmetric about the origin', () => {
		const corners = videoCorners(DEFAULTS);
		const xs = corners.map(([x]) => x);
		const ys = corners.map(([, y]) => y);
		expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 10);
		expect(Math.min(...ys)).toBeCloseTo(-Math.max(...ys), 10);
	});

	it('returns exactly four distinct corners', () => {
		const corners = videoCorners(DEFAULTS);
		expect(corners).toHaveLength(4);
		expect(new Set(corners.map((c) => c.join(','))).size).toBe(4);
	});

	it('collapses to the quad edge when there is no padding', () => {
		const corners = videoCorners({
			videoHalfX: 1.8,
			videoHalfY: 1.015,
			quadHalfX: 1.8,
			quadHalfY: 1.015
		});
		for (const [x, y] of corners) {
			expect(Math.abs(x)).toBeCloseTo(1, 10);
			expect(Math.abs(y)).toBeCloseTo(1, 10);
		}
	});

	it('never exceeds the quad, even if padding is reported as negative', () => {
		const corners = videoCorners({ videoHalfX: 3, videoHalfY: 3, quadHalfX: 1, quadHalfY: 1 });
		for (const [x, y] of corners) {
			expect(Math.abs(x)).toBeLessThanOrEqual(1);
			expect(Math.abs(y)).toBeLessThanOrEqual(1);
		}
	});

	it('falls back to the full quad on non-finite or zero input', () => {
		for (const bad of [
			{ videoHalfX: NaN, videoHalfY: 1, quadHalfX: 1, quadHalfY: 1 },
			{ videoHalfX: 1, videoHalfY: 1, quadHalfX: 0, quadHalfY: 1 },
			{ videoHalfX: 1, videoHalfY: 1, quadHalfX: 1, quadHalfY: NaN }
		]) {
			const corners = videoCorners(bad);
			expect(corners).toHaveLength(4);
			for (const [x, y] of corners) {
				expect(Number.isFinite(x)).toBe(true);
				expect(Number.isFinite(y)).toBe(true);
			}
		}
	});
});
