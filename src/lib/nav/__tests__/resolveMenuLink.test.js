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
	it('marks a local pdf as a download', () => {
		const link = resolveMenuLink({
			label: 'Resume',
			url: '/documents/Michael-Grunwald-Resume.pdf'
		});
		expect(link.download).toBe('');
		expect(link.target).toBe('_blank');
		expect(link.rel).toBe('noopener noreferrer');
		expect(link.isInternal).toBe(false);
	});

	it('matches the extension case-insensitively', () => {
		expect(resolveMenuLink({ label: 'Doc', url: '/a.PDF' }).download).toBe('');
	});

	it('prefers document over external for an absolute pdf URL', () => {
		const link = resolveMenuLink({ label: 'Spec', url: 'https://example.com/spec.pdf' });
		expect(link.download).toBe('');
	});

	it('matches other document extensions', () => {
		expect(resolveMenuLink({ label: 'D', url: '/a.docx' }).download).toBe('');
		expect(resolveMenuLink({ label: 'D', url: '/a.doc' }).download).toBe('');
		expect(resolveMenuLink({ label: 'X', url: '/a.xlsx' }).download).toBe('');
		expect(resolveMenuLink({ label: 'Z', url: '/a.zip' }).download).toBe('');
	});

	it('ignores a query string when testing the extension', () => {
		expect(resolveMenuLink({ label: 'R', url: '/r.pdf?v=2' }).download).toBe('');
	});

	it('ignores a hash when testing the extension', () => {
		expect(resolveMenuLink({ label: 'R', url: '/r.pdf#page=3' }).download).toBe('');
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
