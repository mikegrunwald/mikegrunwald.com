import { loadCollection } from '$lib/server/markdown';
import { selectFeaturedTeasers } from '$lib/gpu/carousel/teaserSelection.js';
import { getAssetUrl } from '$lib/config.js';

export async function load() {
	const work = loadCollection('src/content/work');
	// teaserUrl is authored as a site-relative `/video/teasers/...` path. Resolve
	// it here so dev serves the local encode (getAssetUrl is a no-op in dev) and
	// prod points at the R2 CDN — the teasers are uploaded to R2, never committed.
	// Absolute media-fallback URLs already pass through getAssetUrl unchanged.
	const teasers = selectFeaturedTeasers(work).map((t) => ({
		...t,
		teaserUrl: t.teaserUrl ? getAssetUrl(t.teaserUrl) : t.teaserUrl
	}));
	return { teasers };
}
