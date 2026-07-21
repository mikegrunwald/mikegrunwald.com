import { describe, it, expect } from 'vitest';
import { computeQuadGeometry } from '../carousel/quadGeometry.js';

describe('computeQuadGeometry', () => {
	it('halves the padded size for mesh scale (PlaneGeometry is a 2x2 quad)', () => {
		const g = computeQuadGeometry({ planeWidth: 3.6, planeHeight: 2.03, glowPad: 0.15 });
		// padded size = 3.6 + 2*0.15 = 3.9 wide, 2.03 + 2*0.15 = 2.33 tall
		expect(g.meshScaleX).toBeCloseTo(1.95, 10);
		expect(g.meshScaleY).toBeCloseTo(1.165, 10);
	});

	it('reports the video half-extent in world units, unpadded', () => {
		const g = computeQuadGeometry({ planeWidth: 3.6, planeHeight: 2.03, glowPad: 0.15 });
		expect(g.videoHalfX).toBeCloseTo(1.8, 10);
		expect(g.videoHalfY).toBeCloseTo(1.015, 10);
	});

	it('reports the padded quad half-extent in world units', () => {
		const g = computeQuadGeometry({ planeWidth: 3.6, planeHeight: 2.03, glowPad: 0.15 });
		expect(g.quadHalfX).toBeCloseTo(1.95, 10);
		expect(g.quadHalfY).toBeCloseTo(1.165, 10);
	});

	it('collapses to the unpadded quad when glowPad is 0', () => {
		const g = computeQuadGeometry({ planeWidth: 3.6, planeHeight: 2.03, glowPad: 0 });
		expect(g.quadHalfX).toBeCloseTo(g.videoHalfX, 10);
		expect(g.quadHalfY).toBeCloseTo(g.videoHalfY, 10);
		expect(g.meshScaleX).toBeCloseTo(1.8, 10);
	});

	it('clamps negative padding to zero rather than inverting the quad', () => {
		const g = computeQuadGeometry({ planeWidth: 3.6, planeHeight: 2.03, glowPad: -1 });
		expect(g.quadHalfX).toBeCloseTo(1.8, 10);
		expect(g.quadHalfY).toBeCloseTo(1.015, 10);
	});

	it('falls back to a safe unit quad on non-finite input', () => {
		const g = computeQuadGeometry({ planeWidth: NaN, planeHeight: 2.03, glowPad: 0.15 });
		expect(Number.isFinite(g.meshScaleX)).toBe(true);
		expect(Number.isFinite(g.meshScaleY)).toBe(true);
		expect(Number.isFinite(g.videoHalfX)).toBe(true);
		expect(Number.isFinite(g.quadHalfX)).toBe(true);
	});
});
