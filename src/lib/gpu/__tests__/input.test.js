import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { correctDeltaX, correctDeltaY, createPointerInput } from '../input.js';

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

describe('pointer input lifecycle — timer cleanup regression', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('stop() clears pending mousemove timer, preventing listener leak', () => {
		const addEventListenerSpy = vi.fn();
		const removeEventListenerSpy = vi.fn();

		vi.stubGlobal('document', {
			addEventListener: addEventListenerSpy,
			removeEventListener: removeEventListenerSpy
		});

		vi.stubGlobal('window', {
			devicePixelRatio: 1
		});

		const input = createPointerInput({ getSize: () => ({ width: 100, height: 100 }) });

		input.start();
		input.stop();

		// Advance time past the 500ms setTimeout
		vi.advanceTimersByTime(600);

		// Count mousemove addEventListener calls after stop()
		const mousemoveCalls = addEventListenerSpy.mock.calls.filter(
			(call) => call[0] === 'mousemove'
		);

		// If timer wasn't cleared, mousemove listener would be attached after stop()
		expect(mousemoveCalls.length).toBe(0);
	});
});
