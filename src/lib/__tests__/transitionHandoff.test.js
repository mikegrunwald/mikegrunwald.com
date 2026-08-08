import { describe, it, expect, beforeEach } from 'vitest';
import { setHandoff, readHandoff, clearHandoff, shouldSeed } from '../transitionHandoff.js';

describe('handoff record', () => {
	beforeEach(() => clearHandoff());

	it('round-trips a record', () => {
		setHandoff({ slug: 'patreon-com', currentTime: 4.2, srcUrl: 'https://x/a.mp4' });
		const r = readHandoff();
		expect(r.slug).toBe('patreon-com');
		expect(r.currentTime).toBe(4.2);
		expect(r.srcUrl).toBe('https://x/a.mp4');
		expect(Number.isFinite(r.at)).toBe(true);
	});

	it('reads null when nothing is in flight', () => {
		expect(readHandoff()).toBeNull();
	});

	it('clears', () => {
		setHandoff({ slug: 'a', currentTime: 1, srcUrl: 'u' });
		clearHandoff();
		expect(readHandoff()).toBeNull();
	});

	it('refuses a non-finite currentTime rather than storing NaN', () => {
		setHandoff({ slug: 'a', currentTime: NaN, srcUrl: 'u' });
		expect(readHandoff()).toBeNull();
	});
});

describe('shouldSeed', () => {
	const record = { slug: 'patreon-com', currentTime: 4.2, srcUrl: 'https://x/a.mp4', at: 1000 };
	const base = {
		record,
		slug: 'patreon-com',
		srcUrl: 'https://x/a.mp4',
		now: 1500,
		maxAgeMs: 5000
	};

	it('seeds when slug and url match and the record is fresh', () => {
		expect(shouldSeed(base)).toBe(true);
	});

	it('refuses when there is no record', () => {
		expect(shouldSeed({ ...base, record: null })).toBe(false);
	});

	it('refuses a different page', () => {
		expect(shouldSeed({ ...base, slug: 'spotify-menu' })).toBe(false);
	});

	it('refuses a different NON-teaser video even on the right page', () => {
		// A foreign file that is not a /teasers/ re-encode: seeking one to the
		// other's timestamp is nonsense.
		expect(shouldSeed({ ...base, srcUrl: 'https://x/DIFFERENT.mp4' })).toBe(false);
	});

	it('seeds across a /teasers/ re-encode of the same project', () => {
		// Ring played the teaser encode; header plays full-res media[0]. Same slug
		// + teaser dir → seed (currentTime maps to the same frame).
		const teaserRecord = { ...record, srcUrl: '/video/teasers/patreon-com.mp4' };
		expect(shouldSeed({ ...base, record: teaserRecord, srcUrl: 'https://x/a.mp4' })).toBe(true);
	});

	it('refuses a stale record', () => {
		expect(shouldSeed({ ...base, now: 1000 + 5001 })).toBe(false);
	});

	it('accepts a record exactly at the age limit', () => {
		expect(shouldSeed({ ...base, now: 1000 + 5000 })).toBe(true);
	});

	it('refuses non-finite timestamps rather than seeding blind', () => {
		expect(shouldSeed({ ...base, now: NaN })).toBe(false);
		expect(shouldSeed({ ...base, record: { ...record, at: NaN } })).toBe(false);
	});
});
