// Pure selection/ordering for the homepage work-teaser carousel and the Case
// Studies grid. Consumes the exact { slug, html, meta } shape
// loadCollection('src/content/work') returns (see src/lib/server/markdown.ts) —
// no filesystem/server dependency here, so this is unit-testable in isolation.
import { isVideoPath } from '../../utils/media-utils.js';
import { orderWork } from '../../work/order.js';

// Maps a loaded work item to the teaser shape the carousel and the Case
// Studies grid both consume. teaser field wins; else the first VIDEO-typed url
// in media (NOT media[0], which may be a still — media mixes videos and images).
export function toTeaser(item) {
	const media = Array.isArray(item.meta.media) ? item.meta.media : [];
	const teaserUrl = item.meta.teaser || media.find(isVideoPath) || null;
	return {
		slug: item.slug,
		title: item.meta.title || item.slug,
		subtitle: item.meta.subtitle || '',
		teaserUrl,
		href: `/work/${item.slug}`
	};
}

// Flag-filtered, manifest-ordered teasers. `flag` is a key of meta.showIn.
export function selectTeasersByFlag(workItems, flag, orderSlugs) {
	const filtered = workItems.filter((item) => item?.meta?.showIn?.[flag] === true);
	return orderWork(filtered, orderSlugs).map(toTeaser);
}

// Homepage carousel. Kept as a named wrapper so the homepage import is stable.
export function selectFeaturedTeasers(workItems, orderSlugs) {
	return selectTeasersByFlag(workItems, 'featuredList', orderSlugs);
}
