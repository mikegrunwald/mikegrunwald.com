import fs from 'node:fs';
import path from 'node:path';
import { loadCollection } from '$lib/server/markdown';
import { orderWork } from '$lib/work/order.js';
import { selectTeasersByFlag } from '$lib/gpu/carousel/teaserSelection.js';
import { getAssetUrl } from '$lib/config.js';
import { firstImage } from '$lib/seo.js';
import workOrder from '$content/meta/work-order.json';

const orderSlugs = workOrder.order.map((e) => e.project);

// Archive hover reveal source: the 768px thumb from `npm run media`
// when it exists (a few tens of KB — the reveal preloads all of them), else the
// full-res still, which is several MB and stalls the reveal on first hover.
// Build-time only; /work is prerendered.
function archiveImage(slug: string, media: unknown) {
	const thumb = `/images/projects/archive/${slug}.webp`;
	if (fs.existsSync(path.join(process.cwd(), 'static', thumb))) return thumb;
	return firstImage(media) || null;
}

export async function load() {
	const work = loadCollection('src/content/work');

	// Case Studies: caseStudiesList subset, manifest order, teaser URLs resolved for dev/R2.
	const caseStudies = selectTeasersByFlag(work, 'caseStudiesList', orderSlugs).map((t) => ({
		...t,
		teaserUrl: t.teaserUrl ? getAssetUrl(t.teaserUrl) : t.teaserUrl
	}));

	// Archive: ALL work, sorted by year (newest first). The sort is stable, so
	// same-year rows keep their manifest order as the tiebreak; undated rows sink
	// to the bottom. Row link is the first authored link, or null (row is then not
	// a link — Plan C). Image is the first still in media.
	const archive = orderWork(work, orderSlugs)
		.map((item) => {
			const m = item.meta;
			const showIn = m.showIn || {};
			const links = Array.isArray(m.links) ? m.links : [];
			// Projects with a detail page (featured or case study) link to it;
			// everything else links out to its first authored link, or nothing.
			const hasDetailPage = showIn.featuredList === true || showIn.caseStudiesList === true;
			return {
				slug: item.slug,
				title: m.title || item.slug,
				agency: m.agency || '',
				role: m.role || '',
				year: m.year ?? '',
				link: hasDetailPage ? `/work/${item.slug}` : (links[0]?.url ?? null),
				image: (() => {
					const img = archiveImage(item.slug, m.media);
					return img ? getAssetUrl(img) : null;
				})(),
				hasCaseStudy: showIn.caseStudiesList === true
			};
		})
		.sort((a, b) => (Number(b.year) || -Infinity) - (Number(a.year) || -Infinity));

	return { caseStudies, archive };
}
