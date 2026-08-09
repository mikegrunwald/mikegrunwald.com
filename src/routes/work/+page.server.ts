import { loadCollection } from '$lib/server/markdown';
import { orderWork } from '$lib/work/order.js';
import { selectTeasersByFlag } from '$lib/gpu/carousel/teaserSelection.js';
import { getAssetUrl } from '$lib/config.js';
import { firstImage } from '$lib/seo.js';
import workOrder from '$content/meta/work-order.json';

const orderSlugs = workOrder.order.map((e) => e.project);

export async function load() {
	const work = loadCollection('src/content/work');

	// Case Studies: workList subset, manifest order, teaser URLs resolved for dev/R2.
	const caseStudies = selectTeasersByFlag(work, 'workList', orderSlugs).map((t) => ({
		...t,
		teaserUrl: t.teaserUrl ? getAssetUrl(t.teaserUrl) : t.teaserUrl
	}));

	// Archive: ALL work, manifest order. Row link is the first authored link, or
	// null (row is then not a link — Plan C). Image is the first still in media.
	const archive = orderWork(work, orderSlugs).map((item) => {
		const m = item.meta;
		const links = Array.isArray(m.links) ? m.links : [];
		return {
			slug: item.slug,
			title: m.title || item.slug,
			agency: m.agency || '',
			role: m.role || '',
			year: m.year ?? '',
			link: links[0]?.url ?? null,
			image: firstImage(m.media) || null
		};
	});

	return { caseStudies, archive };
}
