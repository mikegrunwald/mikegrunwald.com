// Page metadata derivation. Pure functions only — these run during the
// prerender pass (from +page.server.ts loads) and in the browser (from
// Seo.svelte), so nothing here may touch `window`, `fs`, or `page`.
//
// Why a module rather than inline `<svelte:head>` per route: the metadata rules
// want ONE definition per page and no duplicate title/description/canonical
// tags. Every route now hands a `{ title, description, image }` object to
// Seo.svelte, which is the only place that emits head tags.

// Matched against media URLs to find something usable as an og:image. Videos
// are the first entries in most projects' `media` lists, so a naive [0] pick
// would hand scrapers an .mp4.
const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;

// Strips markdown and HTML down to a single line of readable prose. Project
// descriptions are authored as markdown in Decap (headings, bold, links), and
// `meta description` must be plain text — shipping the raw source would put
// `### TL;DR` in search results.
export function plainText(input) {
	if (typeof input !== 'string' || !input) return '';
	return (
		input
			.replace(/```[\s\S]*?```/g, ' ') // fenced code
			.replace(/`([^`]*)`/g, '$1') // inline code
			.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images — alt text is not prose
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
			.replace(/<[^>]*>/g, ' ') // html tags (loadMarkdown also hands us rendered html)
			.replace(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/gm, ' ') // horizontal rules, before bullets
			.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, list markers
			.replace(/(\*\*|__|\*|_)/g, '') // emphasis markers
			// Entities can arrive from rendered html; decode so the description
			// reads as text. Re-escaping for the attribute is Svelte's job.
			.replace(/&nbsp;/g, ' ')
			.replace(/&#39;|&apos;/g, "'")
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

// Trims to a length search engines will actually show, on a word boundary.
export function truncate(text, max = 155) {
	if (typeof text !== 'string' || !text) return '';
	if (text.length <= max) return text;
	const slice = text.slice(0, max + 1);
	const lastSpace = slice.lastIndexOf(' ');
	const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice.slice(0, max);
	return `${cut.replace(/[\s,;:.–—-]+$/, '')}…`;
}

// Resolves a site-relative path against the site origin. Already-absolute URLs
// pass through untouched — project media lives on the R2 domain. Returns '' when
// there is nothing to resolve, so callers can treat it as "no image".
export function absoluteUrl(target, base) {
	if (typeof target !== 'string' || !target) return '';
	if (/^https?:\/\//i.test(target)) return target;
	if (typeof base !== 'string' || !base) return '';
	return `${base.replace(/\/+$/, '')}/${target.replace(/^\/+/, '')}`;
}

// First entry in a Decap `media` list that a social scraper can render.
export function firstImage(media) {
	if (!Array.isArray(media)) return '';
	return media.find((item) => typeof item === 'string' && IMAGE_EXTENSIONS.test(item)) || '';
}

// `{siteName} | {page}` — the order the site's hand-written titles already used
// (e.g. "Michael Grunwald | Dreamwave"), kept so titles stay consistent across
// the pages this replaces. The `startsWith` guard means a page may pass an
// already-prefixed title without getting the brand twice.
export function formatTitle({ title, siteName, siteTitle } = {}) {
	const page = plainText(title);
	if (!page) return siteTitle || siteName || '';
	if (!siteName || page === siteName || page.startsWith(`${siteName} |`)) return page;
	return `${siteName} | ${page}`;
}

/**
 * Builds the full metadata set for one page.
 *
 * `site` is src/content/meta/site.json. Everything else is the page's own
 * override; each falls back to the site default, so a route that passes nothing
 * still gets a valid title and description.
 *
 * `canonical` is built from `site.url` rather than the request URL because this
 * site prerenders — during the build `page.url.origin` is a SvelteKit
 * placeholder, not the real domain.
 */
export function buildSeo({
	site = {},
	title = '',
	description = '',
	image = '',
	type = 'website',
	path = '/'
} = {}) {
	const siteName = site.siteName || site.title || '';
	return {
		siteName,
		type,
		title: formatTitle({ title, siteName, siteTitle: site.title }),
		description: truncate(plainText(description) || plainText(site.description)),
		canonical: absoluteUrl(path, site.url),
		image: absoluteUrl(image || site.ogImage, site.url)
	};
}
