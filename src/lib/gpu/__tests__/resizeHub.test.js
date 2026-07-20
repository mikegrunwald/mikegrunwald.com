import { describe, it, expect } from 'vitest';
import { createResizeHub } from '../utils/resizeHub.js';

describe('createResizeHub', () => {
	it('dispatches to all subscribers in add order', () => {
		const hub = createResizeHub();
		const calls = [];
		hub.add(() => calls.push('a'));
		hub.add(() => calls.push('b'));
		hub.dispatch();
		expect(calls).toEqual(['a', 'b']);
	});

	it('unsubscribe removes only that subscriber', () => {
		const hub = createResizeHub();
		const calls = [];
		const unsubA = hub.add(() => calls.push('a'));
		hub.add(() => calls.push('b'));
		unsubA();
		hub.dispatch();
		expect(calls).toEqual(['b']);
	});

	it('a subscriber that throws does not block the others', () => {
		const hub = createResizeHub();
		const calls = [];
		hub.add(() => {
			throw new Error('boom');
		});
		hub.add(() => calls.push('b'));
		expect(() => hub.dispatch()).not.toThrow();
		expect(calls).toEqual(['b']);
	});

	it('clear() removes everything', () => {
		const hub = createResizeHub();
		const calls = [];
		hub.add(() => calls.push('a'));
		hub.clear();
		hub.dispatch();
		expect(calls).toEqual([]);
	});
});
