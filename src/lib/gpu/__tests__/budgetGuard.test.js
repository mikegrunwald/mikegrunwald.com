import { describe, it, expect } from 'vitest';
import { createBudgetGuard } from '../particles/budgetGuard.js';

describe('createBudgetGuard', () => {
	describe('ok path', () => {
		it('returns "ok" for healthy frames with no heap reading', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 5 });
			for (let i = 0; i < 200; i++) {
				expect(guard.sample({ frameMs: 10 })).toBe('ok');
			}
		});

		it('returns "ok" when heap stays flat after baseline is established', () => {
			const guard = createBudgetGuard({ checkEvery: 10, heapGrowthMB: 50 });
			for (let i = 0; i < 100; i++) {
				expect(guard.sample({ frameMs: 5, heapMB: 100 + (i % 3) })).toBe('ok');
			}
		});

		it('tolerates an occasional bad frame under the limit', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 5, windowSize: 120 });
			// Exactly 5 bad frames (i = 0, 20, 40, 60, 80) scattered across a
			// 100-frame span, all still inside the 120-frame window — never
			// exceeds the limit (isOver requires MORE than badFrameLimit, i.e. 6+).
			for (let i = 0; i < 100; i++) {
				const frameMs = i % 20 === 0 ? 50 : 10;
				expect(guard.sample({ frameMs })).toBe('ok');
			}
		});

		it('missing frameMs/heapMB never throws and stays ok', () => {
			const guard = createBudgetGuard();
			for (let i = 0; i < 50; i++) {
				expect(() => guard.sample({})).not.toThrow();
			}
			expect(guard.sample({})).toBe('ok');
		});
	});

	describe('degrade -> kill escalation', () => {
		it('returns "degrade" exactly once on the rising edge past the limit', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 5, windowSize: 50 });
			const results = [];
			for (let i = 0; i < 8; i++) {
				results.push(guard.sample({ frameMs: 50 })); // all bad frames
			}
			// count crosses "> 5" on the 6th bad frame.
			expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'degrade', 'ok', 'ok']);
		});

		it('does not re-degrade while the window stays continuously over the limit', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 3, windowSize: 200 });
			const results = [];
			for (let i = 0; i < 50; i++) {
				results.push(guard.sample({ frameMs: 50 }));
			}
			expect(results.filter((r) => r === 'degrade')).toHaveLength(1);
			expect(results.filter((r) => r === 'kill')).toHaveLength(0);
		});

		it('escalates to "kill" on a second breach after the window recovers', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 3, windowSize: 10 });
			const results = [];
			// First breach: 4 bad frames within a 10-frame window -> degrade.
			for (let i = 0; i < 4; i++) results.push(guard.sample({ frameMs: 50 }));
			expect(results.at(-1)).toBe('degrade');

			// Recover: enough good frames for the window to fully age out the
			// bad ones and drop back under the limit (isOver -> false).
			for (let i = 0; i < 20; i++) results.push(guard.sample({ frameMs: 5 }));
			expect(results.slice(-20)).not.toContain('kill');
			expect(results.slice(-20)).not.toContain('degrade');

			// Second breach -> kill.
			let killIndex = -1;
			for (let i = 0; i < 4; i++) {
				const r = guard.sample({ frameMs: 50 });
				results.push(r);
				if (r === 'kill') killIndex = results.length - 1;
			}
			expect(killIndex).toBeGreaterThan(-1);
			expect(results[killIndex]).toBe('kill');
		});

		it('once killed, stays "kill" forever regardless of subsequent healthy input', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 1, windowSize: 5 });
			for (let i = 0; i < 3; i++) guard.sample({ frameMs: 50 }); // -> degrade
			for (let i = 0; i < 10; i++) guard.sample({ frameMs: 5 }); // recover
			for (let i = 0; i < 3; i++) guard.sample({ frameMs: 50 }); // -> kill
			expect(guard.sample({ frameMs: 5, heapMB: 1 })).toBe('kill');
			expect(guard.sample({ frameMs: 5, heapMB: 1 })).toBe('kill');
		});
	});

	describe('heap-growth kill', () => {
		it('establishes the baseline as the median of the first checkEvery samples', () => {
			const guard = createBudgetGuard({ checkEvery: 5, heapGrowthMB: 100, badFrameLimit: 1000 });
			// Median of [100, 102, 101, 99, 100] is 100.
			const readings = [100, 102, 101, 99, 100];
			const results = readings.map((heapMB) => guard.sample({ frameMs: 1, heapMB }));
			expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
			// A sample within budget of the baseline (100) stays ok...
			expect(guard.sample({ frameMs: 1, heapMB: 100 + 99 })).toBe('ok');
			// ...but exceeding baseline + heapGrowthMB kills.
			expect(guard.sample({ frameMs: 1, heapMB: 100 + 101 })).toBe('kill');
		});

		it('a single early outlier does not skew the median baseline much', () => {
			const guard = createBudgetGuard({ checkEvery: 5, heapGrowthMB: 50, badFrameLimit: 1000 });
			// Median of [50, 50, 50, 50, 5000] is 50, not dragged up by the outlier.
			for (const heapMB of [50, 50, 50, 50, 5000]) guard.sample({ frameMs: 1, heapMB });
			expect(guard.sample({ frameMs: 1, heapMB: 50 + 60 })).toBe('kill');
		});

		it('kills immediately once heap growth is detected, independent of frame time', () => {
			const guard = createBudgetGuard({ checkEvery: 3, heapGrowthMB: 10, badFrameLimit: 1000 });
			guard.sample({ frameMs: 1, heapMB: 10 });
			guard.sample({ frameMs: 1, heapMB: 10 });
			guard.sample({ frameMs: 1, heapMB: 10 }); // baseline = 10
			expect(guard.sample({ frameMs: 1, heapMB: 21 })).toBe('kill'); // +11 > 10
		});

		it('never kills on heap growth when heapMB is never provided (non-Chrome)', () => {
			const guard = createBudgetGuard({ checkEvery: 3, heapGrowthMB: 1, badFrameLimit: 1000 });
			for (let i = 0; i < 200; i++) {
				expect(guard.sample({ frameMs: 1 })).toBe('ok');
			}
		});
	});

	describe('window expiry resets bad-frame count', () => {
		it('stale bad frames outside the rolling window no longer count toward a breach', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 5, windowSize: 120 });
			// Exactly at the limit (5 bad frames) — not yet a breach (isOver needs > 5).
			for (let i = 0; i < 5; i++) {
				expect(guard.sample({ frameMs: 50 })).toBe('ok');
			}
			// Advance far enough past the window that all 5 have aged out.
			for (let i = 0; i < 120; i++) {
				expect(guard.sample({ frameMs: 5 })).toBe('ok');
			}
			// If the old 5 were still counted, these 5 new ones would total 10
			// and breach the limit. Since they aged out, this stays exactly at
			// the limit again (5 fresh bad frames) -> still "ok".
			for (let i = 0; i < 5; i++) {
				expect(guard.sample({ frameMs: 50 })).toBe('ok');
			}
		});

		it('one more bad frame after expiry still breaches normally', () => {
			const guard = createBudgetGuard({ badFrameMs: 16, badFrameLimit: 5, windowSize: 120 });
			for (let i = 0; i < 5; i++) guard.sample({ frameMs: 50 });
			for (let i = 0; i < 120; i++) guard.sample({ frameMs: 5 });
			for (let i = 0; i < 5; i++) guard.sample({ frameMs: 50 });
			// A 6th fresh bad frame breaches (count 6 > 5).
			expect(guard.sample({ frameMs: 50 })).toBe('degrade');
		});
	});
});
