// Pure selection/ordering for the homepage work-teaser carousel. Consumes the
// exact { slug, html, meta } shape loadCollection('src/content/work') returns
// (see src/lib/server/markdown.ts, already used by work/+page.server.ts) — no
// filesystem/server dependency here, so this is unit-testable in isolation.
import { isVideoPath } from '../../utils/media-utils.js';

export function selectFeaturedTeasers(workItems) {
	return (
		workItems
			.filter((item) => item?.meta?.showIn?.featuredList === true)
			.slice() // sort() below would otherwise mutate the filtered array's shared
			// backing store if filter() ever returns the same array reference (it
			// doesn't today, but this keeps the "never mutate input" contract explicit)
			.sort((a, b) => (a.meta.order || 0) - (b.meta.order || 0))
			.map((item) => {
				const media = Array.isArray(item.meta.media) ? item.meta.media : [];
				// teaser field wins; otherwise first VIDEO-typed url in media (not
				// media[0], which is frequently an image for entries with photo-heavy
				// case studies — see reliable-robotics.md/spotify-reniassance.md).
				const teaserUrl = item.meta.teaser || media.find(isVideoPath) || null;
				return {
					slug: item.slug,
					title: item.meta.title || item.slug,
					subtitle: item.meta.subtitle || '',
					teaserUrl,
					href: `/work/${item.slug}`
				};
			})
	);
}
