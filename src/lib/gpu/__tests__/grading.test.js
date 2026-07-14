import { describe, it, expect } from 'vitest';
import { gradingFromProgress, scrollProgress } from '../fluid/grading.js';

// Unpack padded column-major mat3 into row-major 2D array for assertions
function rows(mat) {
	return [
		[mat[0], mat[4], mat[8]],
		[mat[1], mat[5], mat[9]],
		[mat[2], mat[6], mat[10]]
	];
}

function applyGrading(g, c) {
	const m = rows(g.mat);
	return [0, 1, 2].map((i) => m[i][0] * c[0] + m[i][1] * c[1] + m[i][2] * c[2] + g.offset[i]);
}

describe('scrollProgress', () => {
	it('ramps 0→1 over one viewport height then holds', () => {
		expect(scrollProgress(0, 800)).toBe(0);
		expect(scrollProgress(400, 800)).toBeCloseTo(0.5);
		expect(scrollProgress(800, 800)).toBe(1);
		expect(scrollProgress(5000, 800)).toBe(1);
	});
});

describe('gradingFromProgress', () => {
	it('is identity at p=0', () => {
		const g = gradingFromProgress(0);
		const out = applyGrading(g, [0.2, 0.5, 0.9]);
		expect(out[0]).toBeCloseTo(0.2, 5);
		expect(out[1]).toBeCloseTo(0.5, 5);
		expect(out[2]).toBeCloseTo(0.9, 5);
		expect(g.alpha).toBeCloseTo(1, 5);
	});

	it('maps gray to inverted gray at p=1 (gray is hue/saturate invariant)', () => {
		// hue-rotate and saturate matrices have rows summing to 1,
		// so gray survives them; invert(1) maps g -> 1-g.
		const g = gradingFromProgress(1);
		const out = applyGrading(g, [0.2, 0.2, 0.2]);
		expect(out[0]).toBeCloseTo(0.8, 4);
		expect(out[1]).toBeCloseTo(0.8, 4);
		expect(out[2]).toBeCloseTo(0.8, 4);
	});

	it('has alpha 0.5 at p=1 (opacity(50%))', () => {
		expect(gradingFromProgress(1).alpha).toBeCloseTo(0.5, 5);
	});

	it('rows of S·H sum to 1 at any p (luminance-preserving components)', () => {
		// mat rows sum to (1-2p), offset rows are p * rowSum(S·H) = p
		const g = gradingFromProgress(0.37);
		const m = rows(g.mat);
		for (let i = 0; i < 3; i++) {
			const rowSum = m[i][0] + m[i][1] + m[i][2];
			expect(rowSum).toBeCloseTo(1 - 2 * 0.37, 4);
			expect(g.offset[i]).toBeCloseTo(0.37, 4);
		}
	});

	it('matches hand-computed hue-rotate(180deg) row 0 at p=1', () => {
		// H(180): cos=-1, sin=0 → row0 = [0.213-0.787, 0.715+0.715, 0.072+0.072]
		//                              = [-0.574, 1.430, 0.144]
		// s at p=1: 0.333 → S(0.333) row0 = [0.213+0.787s, 0.715-0.715s, 0.072-0.072s]
		//                                 = [0.4751021, 0.4768345, 0.0480634]
		// (S·H) row0 = S.row0 · H columns; mat row0 = (S·H) row0 * (1-2p) = *(-1)
		const g = gradingFromProgress(1);
		const m = rows(g.mat);
		const S0 = [0.213 + 0.787 * 0.333, 0.715 - 0.715 * 0.333, 0.072 - 0.072 * 0.333];
		const H = [
			[-0.574, 1.43, 0.144],
			[0.426, 0.43, 0.144],
			[0.426, 1.43, -0.856]
		];
		const expected0 = [0, 1, 2].map((j) => -(S0[0] * H[0][j] + S0[1] * H[1][j] + S0[2] * H[2][j]));
		expect(m[0][0]).toBeCloseTo(expected0[0], 3);
		expect(m[0][1]).toBeCloseTo(expected0[1], 3);
		expect(m[0][2]).toBeCloseTo(expected0[2], 3);
	});
});
