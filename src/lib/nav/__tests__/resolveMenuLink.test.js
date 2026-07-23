import { describe, it, expect } from 'vitest';
import { resolveMenuLink } from '../resolveMenuLink.js';

describe('resolveMenuLink — internal links', () => {
	it('treats a root path as internal', () => {
		const link = resolveMenuLink({ label: 'Home', url: '/' });
		expect(link.href).toBe('/');
		expect(link.label).toBe('Home');
		expect(link.isInternal).toBe(true);
		expect(link.target).toBeUndefined();
		expect(link.rel).toBeUndefined();
		expect(link.download).toBeUndefined();
	});

	it('treats a nested path as internal', () => {
		expect(resolveMenuLink({ label: 'Work', url: '/work' }).isInternal).toBe(true);
		expect(resolveMenuLink({ label: 'Case', url: '/work/dreamwave' }).isInternal).toBe(true);
	});

	it('treats a hash target as internal', () => {
		const link = resolveMenuLink({ label: 'Contact', url: '#contact' });
		expect(link.isInternal).toBe(true);
		expect(link.target).toBeUndefined();
	});

	it('treats a relative path as internal', () => {
		expect(resolveMenuLink({ label: 'About', url: 'about' }).isInternal).toBe(true);
	});
});

describe('resolveMenuLink — external links', () => {
	it('opens https URLs in a new tab with a safe rel', () => {
		const link = resolveMenuLink({
			label: 'LinkedIn',
			url: 'https://linkedin.com/in/mikegrunwald'
		});
		expect(link.isInternal).toBe(false);
		expect(link.target).toBe('_blank');
		expect(link.rel).toBe('noopener noreferrer');
		expect(link.download).toBeUndefined();
	});

	it('opens http URLs in a new tab', () => {
		expect(resolveMenuLink({ label: 'Old', url: 'http://example.com' }).target).toBe('_blank');
	});
});

describe('resolveMenuLink — documents', () => {
	// A recognised document (e.g. the resume PDF) opens in a new tab like an
	// external link — target=_blank, safe rel, never SPA-navigated — and is NOT
	// force-downloaded, so `download` stays undefined. For the extension-matching
	// cases the discriminator is `isInternal: false`: a relative path such as
	// `/a.PDF` would otherwise be an internal SPA link, so isInternal being false
	// proves the extension was detected.
	it('opens a local pdf in a new tab, not a download', () => {
		const link = resolveMenuLink({
			label: 'Resume',
			url: '/documents/Michael-Grunwald-Resume.pdf'
		});
		expect(link.download).toBeUndefined();
		expect(link.target).toBe('_blank');
		expect(link.rel).toBe('noopener noreferrer');
		expect(link.isInternal).toBe(false);
	});

	it('matches the extension case-insensitively', () => {
		const link = resolveMenuLink({ label: 'Doc', url: '/a.PDF' });
		expect(link.isInternal).toBe(false);
		expect(link.target).toBe('_blank');
	});

	it('treats an absolute document URL as a new-tab link', () => {
		const link = resolveMenuLink({ label: 'Spec', url: 'https://example.com/spec.pdf' });
		expect(link.isInternal).toBe(false);
		expect(link.target).toBe('_blank');
		expect(link.download).toBeUndefined();
	});

	it('matches other document extensions', () => {
		expect(resolveMenuLink({ label: 'D', url: '/a.docx' }).isInternal).toBe(false);
		expect(resolveMenuLink({ label: 'D', url: '/a.doc' }).isInternal).toBe(false);
		expect(resolveMenuLink({ label: 'X', url: '/a.xlsx' }).isInternal).toBe(false);
		expect(resolveMenuLink({ label: 'Z', url: '/a.zip' }).isInternal).toBe(false);
	});

	it('ignores a query string when testing the extension', () => {
		expect(resolveMenuLink({ label: 'R', url: '/r.pdf?v=2' }).isInternal).toBe(false);
	});

	it('ignores a hash when testing the extension', () => {
		expect(resolveMenuLink({ label: 'R', url: '/r.pdf#page=3' }).isInternal).toBe(false);
	});

	it('does not match an extension appearing mid-path', () => {
		const link = resolveMenuLink({ label: 'Notes', url: '/notes.pdf.html' });
		expect(link.download).toBeUndefined();
		expect(link.isInternal).toBe(true);
	});
});

describe('resolveMenuLink — defensive input', () => {
	it('does not throw on a missing url', () => {
		const link = resolveMenuLink({ label: 'Broken' });
		expect(link.href).toBe('');
		expect(link.isInternal).toBe(true);
	});

	it('does not throw on undefined input', () => {
		expect(() => resolveMenuLink(undefined)).not.toThrow();
	});
});
