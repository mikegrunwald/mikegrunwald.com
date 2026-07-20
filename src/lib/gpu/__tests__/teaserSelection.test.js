import { describe, it, expect } from 'vitest';
import { selectFeaturedTeasers } from '../carousel/teaserSelection.js';

function item(slug, meta) {
	return { slug, html: '', meta };
}

describe('selectFeaturedTeasers', () => {
	it('keeps only featuredList entries, sorted by order', () => {
		const result = selectFeaturedTeasers([
			item('b', { showIn: { featuredList: true }, order: 2, title: 'B', media: ['b.mp4'] }),
			item('skip', { showIn: { featuredList: false }, order: 0, title: 'Skip', media: ['s.mp4'] }),
			item('a', { showIn: { featuredList: true }, order: 1, title: 'A', media: ['a.mp4'] })
		]);
		expect(result.map((r) => r.slug)).toEqual(['a', 'b']);
	});

	it('treats missing order as 0', () => {
		const result = selectFeaturedTeasers([
			item('later', { showIn: { featuredList: true }, order: 1, media: ['x.mp4'] }),
			item('first', { showIn: { featuredList: true }, media: ['y.mp4'] }) // no order field
		]);
		expect(result.map((r) => r.slug)).toEqual(['first', 'later']);
	});

	it('prefers the explicit teaser field over media', () => {
		const [result] = selectFeaturedTeasers([
			item('x', {
				showIn: { featuredList: true },
				teaser: 'https://assets.example.com/teaser.mp4',
				media: ['https://assets.example.com/full.mp4']
			})
		]);
		expect(result.teaserUrl).toBe('https://assets.example.com/teaser.mp4');
	});

	it('falls back to the first VIDEO url in media, skipping leading images', () => {
		const [result] = selectFeaturedTeasers([
			item('x', {
				showIn: { featuredList: true },
				media: ['/uploads/still.jpg', 'https://assets.example.com/clip.mov', '/uploads/other.png']
			})
		]);
		expect(result.teaserUrl).toBe('https://assets.example.com/clip.mov');
	});

	it('returns teaserUrl null (not dropped) when no video exists anywhere', () => {
		const [result] = selectFeaturedTeasers([
			item('x', {
				showIn: { featuredList: true },
				title: 'No Video',
				media: ['/uploads/still.jpg']
			})
		]);
		expect(result.teaserUrl).toBeNull();
		expect(result.slug).toBe('x');
	});

	it('builds href from slug and defaults title/subtitle', () => {
		const [result] = selectFeaturedTeasers([item('x', { showIn: { featuredList: true } })]);
		expect(result.href).toBe('/work/x');
		expect(result.title).toBe('x');
		expect(result.subtitle).toBe('');
	});

	it('does not mutate the input array or its items', () => {
		const input = [item('x', { showIn: { featuredList: true }, order: 1, media: ['x.mp4'] })];
		const snapshot = JSON.stringify(input);
		selectFeaturedTeasers(input);
		expect(JSON.stringify(input)).toBe(snapshot);
	});
});
