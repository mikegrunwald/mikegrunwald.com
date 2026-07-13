import { describe, it, expect } from 'vitest';
import { correctDeltaX, correctDeltaY } from '../input.js';

describe('aspect-corrected pointer deltas (parity with WebGLFluid.js:1560-1576)', () => {
	it('correctDeltaX scales by aspect when aspect < 1 (portrait)', () => {
		expect(correctDeltaX(0.1, 0.5)).toBeCloseTo(0.05);
	});
	it('correctDeltaX passes through when aspect >= 1 (landscape)', () => {
		expect(correctDeltaX(0.1, 2)).toBeCloseTo(0.1);
	});
	it('correctDeltaY divides by aspect when aspect > 1 (landscape)', () => {
		expect(correctDeltaY(0.1, 2)).toBeCloseTo(0.05);
	});
	it('correctDeltaY passes through when aspect <= 1 (portrait)', () => {
		expect(correctDeltaY(0.1, 0.5)).toBeCloseTo(0.1);
	});
});
