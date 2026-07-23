// Derives link attributes from a CMS `{label, url}` pair, so the shared Decap
// `link` widget (static/admin/widgets/link-widget.js) needs no extra fields to
// express internal / external / document behaviour.
//
// Returns ATTRIBUTE-READY values, not semantic flags: `undefined` means "omit
// this attribute", which is exactly how Svelte treats it. Documents open in a
// new tab like external links rather than downloading, so `download` is always
// `undefined`.

const DOCUMENT_EXTENSION = /\.(pdf|docx?|xlsx?|zip)$/i;
const ABSOLUTE_URL = /^https?:\/\//i;

const EXTERNAL_REL = 'noopener noreferrer';

export function resolveMenuLink(item) {
	const href = item?.url ?? '';
	const label = item?.label ?? '';

	// Strip any query string or hash before testing the extension, so
	// "/resume.pdf?v=2" is still recognised as a document.
	const path = href.split(/[?#]/)[0];

	// Documents are checked BEFORE external: an absolute URL ending in .pdf is
	// a document, and document is the more specific case.
	if (DOCUMENT_EXTENSION.test(path)) {
		return {
			href,
			label,
			target: '_blank',
			rel: EXTERNAL_REL,
			download: undefined,
			isInternal: false
		};
	}

	if (ABSOLUTE_URL.test(href)) {
		return {
			href,
			label,
			target: '_blank',
			rel: EXTERNAL_REL,
			download: undefined,
			isInternal: false
		};
	}

	return {
		href,
		label,
		target: undefined,
		rel: undefined,
		download: undefined,
		isInternal: true
	};
}
