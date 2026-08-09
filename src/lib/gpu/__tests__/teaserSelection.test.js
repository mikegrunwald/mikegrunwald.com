import { describe, it, expect } from 'vitest';
import {
	toTeaser,
	selectTeasersByFlag,
	selectFeaturedTeasers
} from '../carousel/teaserSelection.js';

const item = (slug, meta) => ({ slug, html: '', meta });

describe('toTeaser', () => {
	it('prefers the teaser field, else the first video in media', () => {
		expect(toTeaser(item('a', { title: 'A', teaser: 't.mp4', media: ['m.mp4'] })).teaserUrl).toBe(
			't.mp4'
		);
		expect(toTeaser(item('b', { title: 'B', media: ['still.png', 'clip.mp4'] })).teaserUrl).toBe(
			'clip.mp4'
		);
	});

	it('returns teaserUrl null (not dropped) when no video exists anywhere', () => {
		const t = toTeaser(item('x', { title: 'No Video', media: ['/uploads/still.jpg'] }));
		expect(t.teaserUrl).toBeNull();
		expect(t.slug).toBe('x');
	});

	it('builds the detail href and falls back title→slug', () => {
		const t = toTeaser(item('my-slug', { media: [] }));
		expect(t.href).toBe('/work/my-slug');
		expect(t.title).toBe('my-slug');
	});
});

describe('selectTeasersByFlag', () => {
	it('keeps only entries with the flag, in manifest order', () => {
		const result = selectTeasersByFlag(
			[
				item('b', { showIn: { workList: true }, title: 'B', media: ['b.mp4'] }),
				item('skip', { showIn: { workList: false }, title: 'Skip', media: ['s.mp4'] }),
				item('a', { showIn: { workList: true }, title: 'A', media: ['a.mp4'] })
			],
			'workList',
			['a', 'b']
		);
		expect(result.map((r) => r.slug)).toEqual(['a', 'b']);
	});

	it('appends flagged entries missing from the manifest at the end', () => {
		const result = selectTeasersByFlag(
			[
				item('listed', { showIn: { featuredList: true }, title: 'L', media: ['l.mp4'] }),
				item('unlisted', { showIn: { featuredList: true }, title: 'U', media: ['u.mp4'] })
			],
			'featuredList',
			['listed']
		);
		expect(result.map((r) => r.slug)).toEqual(['listed', 'unlisted']);
	});
});

describe('selectFeaturedTeasers', () => {
	it('is selectTeasersByFlag bound to featuredList', () => {
		const result = selectFeaturedTeasers(
			[
				item('a', { showIn: { featuredList: true }, title: 'A', media: ['a.mp4'] }),
				item('no', { showIn: { featuredList: false }, title: 'N', media: ['n.mp4'] })
			],
			['a']
		);
		expect(result.map((r) => r.slug)).toEqual(['a']);
	});
});
