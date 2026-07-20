import { loadCollection } from '$lib/server/markdown';
import { selectFeaturedTeasers } from '$lib/gpu/carousel/teaserSelection.js';

export async function load() {
	const work = loadCollection('src/content/work');
	const teasers = selectFeaturedTeasers(work);
	return { teasers };
}
