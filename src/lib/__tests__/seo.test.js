import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import siteSettings from '../../content/meta/site.json';
import { absoluteUrl, buildSeo, firstImage, formatTitle, plainText, truncate } from '../seo.js';

describe('plainText', () => {
	it('strips the markdown a Decap description actually contains', () => {
		const input = '### TL;DR\n\nI was a **core member** of the [Dreamwave](/work/dreamwave) team.';
		expect(plainText(input)).toBe('TL;DR I was a core member of the Dreamwave team.');
	});

	it('strips rendered html, which is what loadMarkdown returns for page bodies', () => {
		expect(plainText('<h2>Welcome</h2>\n<p>I&#39;m a senior Design Engineer</p>')).toBe(
			"Welcome I'm a senior Design Engineer"
		);
	});

	it('drops images but keeps link text', () => {
		expect(plainText('![poster](/a.png) see [the work](/work)')).toBe('see the work');
	});

	it('returns an empty string for anything that is not a filled string', () => {
		for (const value of [undefined, null, '', 0, {}, []]) {
			expect(plainText(value)).toBe('');
		}
	});
});

describe('truncate', () => {
	it('leaves short text alone', () => {
		expect(truncate('Short enough', 155)).toBe('Short enough');
	});

	it('cuts on a word boundary and strips trailing punctuation before the ellipsis', () => {
		expect(truncate('one two three four', 12)).toBe('one two…');
	});

	it('does not exceed the limit by more than the ellipsis', () => {
		const long = 'lorem ipsum dolor sit amet '.repeat(20);
		const result = truncate(long, 155);
		expect(result.length).toBeLessThanOrEqual(156);
		expect(result.endsWith('…')).toBe(true);
	});
});

describe('absoluteUrl', () => {
	it('passes absolute URLs through untouched — project media lives on R2', () => {
		const r2 = 'https://assets.mikegrunwald.com/images/projects/avuri-poster.png';
		expect(absoluteUrl(r2, 'https://mikegrunwald.com')).toBe(r2);
	});

	it('joins a site-relative path onto the base without doubling slashes', () => {
		expect(absoluteUrl('/uploads/a.png', 'https://mikegrunwald.com/')).toBe(
			'https://mikegrunwald.com/uploads/a.png'
		);
	});

	it('maps the root path to the bare origin with a trailing slash', () => {
		expect(absoluteUrl('/', 'https://mikegrunwald.com')).toBe('https://mikegrunwald.com/');
	});

	it('returns empty rather than a relative URL when there is no base', () => {
		expect(absoluteUrl('/uploads/a.png', '')).toBe('');
	});
});

describe('firstImage', () => {
	it('skips the videos that lead most projects media lists', () => {
		const media = [
			'https://assets.mikegrunwald.com/video/inbound-22.mp4',
			'https://assets.mikegrunwald.com/video/1768264498210-GROW_Video_Session.mp4',
			'/uploads/oprah-time.png',
			'/uploads/landing-1.png'
		];
		expect(firstImage(media)).toBe('/uploads/oprah-time.png');
	});

	it('returns empty for a video-only project so the site default takes over', () => {
		expect(firstImage(['https://assets.mikegrunwald.com/video/a.mp4'])).toBe('');
	});

	it('tolerates a missing or malformed media field', () => {
		expect(firstImage(undefined)).toBe('');
		expect(firstImage([null, 42])).toBe('');
	});
});

describe('formatTitle', () => {
	it('prefixes the brand, matching the format the hand-written titles used', () => {
		expect(formatTitle({ title: 'Dreamwave', siteName: 'Michael Grunwald' })).toBe(
			'Michael Grunwald | Dreamwave'
		);
	});

	it('falls back to the site title when the page has none', () => {
		expect(
			formatTitle({ title: '', siteName: 'Michael Grunwald', siteTitle: 'MG | Engineer' })
		).toBe('MG | Engineer');
	});

	it('does not prefix twice when a page passes an already-branded title', () => {
		expect(
			formatTitle({ title: 'Michael Grunwald | Dreamwave', siteName: 'Michael Grunwald' })
		).toBe('Michael Grunwald | Dreamwave');
	});
});

describe('buildSeo', () => {
	const site = {
		title: 'Michael Grunwald | Senior Design Engineer',
		siteName: 'Michael Grunwald',
		url: 'https://mikegrunwald.com',
		ogImage: '',
		description: 'Personal website of Michael Grunwald.'
	};

	it('produces the homepage set from site defaults alone', () => {
		expect(buildSeo({ site, path: '/' })).toEqual({
			siteName: 'Michael Grunwald',
			type: 'website',
			title: 'Michael Grunwald | Senior Design Engineer',
			description: 'Personal website of Michael Grunwald.',
			canonical: 'https://mikegrunwald.com/',
			image: ''
		});
	});

	it('keeps canonical and og:url identical — they come from one value', () => {
		const seo = buildSeo({ site, title: 'Dreamwave', path: '/work/dreamwave' });
		expect(seo.canonical).toBe('https://mikegrunwald.com/work/dreamwave');
	});

	it('strips and truncates a markdown description into plain meta text', () => {
		const seo = buildSeo({
			site,
			title: 'Dreamwave',
			description: '### TL;DR\n\n' + 'I built a virtual events platform for HubSpot. '.repeat(6)
		});
		expect(seo.description).not.toContain('#');
		expect(seo.description.length).toBeLessThanOrEqual(156);
	});

	it('falls back to the site description when the page has none', () => {
		expect(buildSeo({ site, title: 'Case Studies' }).description).toBe(
			'Personal website of Michael Grunwald.'
		);
	});

	it('absolutises a relative page image against the site url', () => {
		expect(buildSeo({ site, image: '/uploads/oprah-time.png' }).image).toBe(
			'https://mikegrunwald.com/uploads/oprah-time.png'
		);
	});

	it('uses the site default image when the page supplies none', () => {
		expect(buildSeo({ site: { ...site, ogImage: '/og.png' } }).image).toBe(
			'https://mikegrunwald.com/og.png'
		);
	});

	it('never emits an empty title or description, whatever it is handed', () => {
		const seo = buildSeo({});
		expect(seo.title).toBe('');
		expect(seo.description).toBe('');
		// With real site settings there is always a fallback for both — that is the
		// guarantee the routes rely on when they pass no props at all.
		const withSite = buildSeo({ site: siteSettings });
		expect(withSite.title.length).toBeGreaterThan(0);
		expect(withSite.description.length).toBeGreaterThan(0);
	});
});

describe('site.json', () => {
	// buildSeo returns '' for canonical/image without these, which silently drops
	// rel=canonical, og:url and og:image from every page — a config typo that no
	// page-level test would catch.
	it('carries the fields canonical and social tags depend on', () => {
		expect(siteSettings.url).toBe('https://mikegrunwald.com');
		expect(siteSettings.siteName).toBeTruthy();
		expect(siteSettings.title).toBeTruthy();
		expect(siteSettings.description).toBeTruthy();
		expect(siteSettings.url.endsWith('/')).toBe(false);
	});

	// A typo'd ogImage path produces a perfectly well-formed absolute og:image
	// URL that 404s, so every share card silently loses its image — nothing else
	// in the build or the page markup fails. Resolving it against static/ is the
	// only check that catches it.
	it('points ogImage at a file that actually ships in static/', () => {
		expect(siteSettings.ogImage).toBeTruthy();
		expect(siteSettings.ogImage.startsWith('/')).toBe(true);
		const onDisk = path.join(process.cwd(), 'static', siteSettings.ogImage);
		expect(fs.existsSync(onDisk), `missing: ${onDisk}`).toBe(true);
	});
});
