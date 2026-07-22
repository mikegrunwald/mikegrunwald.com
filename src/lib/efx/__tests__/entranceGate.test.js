import { describe, it, expect, vi } from 'vitest';
import { createEntranceGate } from '../entranceGate.js';

describe('createEntranceGate', () => {
	it('runs the callback on the first open', () => {
		const spy = vi.fn();
		createEntranceGate(spy).open();
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('ignores every later open, so racing signals cannot double-play', () => {
		const spy = vi.fn();
		const gate = createEntranceGate(spy);
		gate.open();
		gate.open();
		gate.open();
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('does not run the callback before it is opened', () => {
		const spy = vi.fn();
		createEntranceGate(spy);
		expect(spy).not.toHaveBeenCalled();
	});

	it('reports its state', () => {
		const gate = createEntranceGate(() => {});
		expect(gate.isOpen()).toBe(false);
		gate.open();
		expect(gate.isOpen()).toBe(true);
	});

	it('marks itself open even if the callback throws, so a failure cannot cause a replay', () => {
		const gate = createEntranceGate(() => {
			throw new Error('boom');
		});
		expect(() => gate.open()).toThrow('boom');
		expect(gate.isOpen()).toBe(true);
	});
});
