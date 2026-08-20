import { describe, it, expect } from 'vitest';
import { orderWork } from '../order.js';

const item = (slug) => ({ slug, meta: { title: slug } });

describe('orderWork', () => {
	it('orders items by the manifest slug order', () => {
		const items = [item('c'), item('a'), item('b')];
		const result = orderWork(items, ['a', 'b', 'c']);
		expect(result.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
	});

	it('appends items missing from the manifest at the end, in input order', () => {
		const items = [item('new2'), item('a'), item('new1')];
		const result = orderWork(items, ['a']);
		expect(result.map((i) => i.slug)).toEqual(['a', 'new2', 'new1']);
	});

	it('returns input order when the manifest is empty', () => {
		const items = [item('b'), item('a')];
		expect(orderWork(items, []).map((i) => i.slug)).toEqual(['b', 'a']);
	});

	it('does not mutate the input array', () => {
		const items = [item('b'), item('a')];
		const snapshot = items.slice();
		orderWork(items, ['a', 'b']);
		expect(items).toEqual(snapshot);
	});
});
