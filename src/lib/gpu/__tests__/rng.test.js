import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../utils/rng.js';

describe('mulberry32', () => {
	it('is deterministic for a given seed', () => {
		const a = mulberry32(1234);
		const b = mulberry32(1234);
		const seqA = [a(), a(), a(), a()];
		const seqB = [b(), b(), b(), b()];
		expect(seqA).toEqual(seqB);
	});

	it('produces different sequences for different seeds', () => {
		const a = mulberry32(1);
		const b = mulberry32(2);
		expect(a()).not.toBe(b());
	});

	it('returns values in [0, 1)', () => {
		const r = mulberry32(42);
		for (let i = 0; i < 1000; i++) {
			const v = r();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});
