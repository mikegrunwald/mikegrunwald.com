import { describe, it, expect } from 'vitest';
import { pointerToNdc, followStep, revealPlaneScale } from '../revealMath.js';

describe('pointerToNdc', () => {
	it('maps center to origin and corners to ±1 (y up)', () => {
		expect(pointerToNdc(50, 25, 100, 50)).toEqual({ ndcX: 0, ndcY: 0 });
		expect(pointerToNdc(100, 0, 100, 50)).toEqual({ ndcX: 1, ndcY: 1 });
		expect(pointerToNdc(0, 50, 100, 50)).toEqual({ ndcX: -1, ndcY: -1 });
	});
});

describe('followStep', () => {
	it('moves toward the target and reaches it in the limit', () => {
		expect(followStep(0, 10, 10, 0)).toBe(0); // dt 0 → no move
		const once = followStep(0, 10, 10, 0.016);
		expect(once).toBeGreaterThan(0);
		expect(once).toBeLessThan(10);
	});
});

describe('revealPlaneScale', () => {
	it('never stretches: wider image crops sides, taller crops top/bottom', () => {
		const wide = revealPlaneScale({ imgW: 200, imgH: 100, planeW: 100, planeH: 100 });
		expect(wide.sy).toBeCloseTo(1);
		expect(wide.sx).toBeGreaterThan(1);
	});
});
