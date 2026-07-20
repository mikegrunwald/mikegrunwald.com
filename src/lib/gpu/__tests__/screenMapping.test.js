import { describe, it, expect } from 'vitest';
import { logoLocalToNdc } from '../particles/particleRenderer.js';

const CANVAS = { width: 1000, height: 800 };

describe('logoLocalToNdc', () => {
	it('maps the center of a centered box to NDC origin-ish', () => {
		const rect = { left: 250, top: 200, width: 500, height: 400 }; // centered
		const c = logoLocalToNdc({ px: 0.5, py: 0.5, rect, canvas: CANVAS });
		expect(c.ok).toBe(true);
		expect(c.x).toBeCloseTo(0, 5); // sx=0.5 -> 0
		expect(c.y).toBeCloseTo(0, 5); // sy=0.5 -> 0
	});

	it('flips y (top-left logo origin -> NDC y up)', () => {
		const rect = { left: 0, top: 0, width: 1000, height: 800 };
		const top = logoLocalToNdc({ px: 0.5, py: 0.0, rect, canvas: CANVAS });
		const bot = logoLocalToNdc({ px: 0.5, py: 1.0, rect, canvas: CANVAS });
		expect(top.y).toBeCloseTo(1, 5); // logo top -> NDC +1
		expect(bot.y).toBeCloseTo(-1, 5); // logo bottom -> NDC -1
	});

	it('rejects a degenerate (zero-size) rect', () => {
		const rect = { left: 100, top: 100, width: 0, height: 400 };
		expect(logoLocalToNdc({ px: 0.5, py: 0.5, rect, canvas: CANVAS }).ok).toBe(false);
	});

	it('rejects non-finite inputs (NaN rect)', () => {
		const rect = { left: NaN, top: 0, width: 500, height: 400 };
		expect(logoLocalToNdc({ px: 0.5, py: 0.5, rect, canvas: CANVAS }).ok).toBe(false);
	});

	it('rejects non-finite canvas', () => {
		const rect = { left: 0, top: 0, width: 500, height: 400 };
		expect(logoLocalToNdc({ px: 0.5, py: 0.5, rect, canvas: { width: 0, height: 800 } }).ok).toBe(
			false
		);
	});
});
