// Orders a work collection by an explicit slug manifest, appending any item
// whose slug is absent from the manifest to the end in original input order —
// so a newly-created Work entry is never dropped from a view, it just lands
// last until it is placed in the Decap "Work Order" editor. Pure: never
// mutates `items`.
export function orderWork(items, manifestSlugs) {
	const rank = new Map(manifestSlugs.map((slug, i) => [slug, i]));
	const end = manifestSlugs.length;
	return items
		.map((item, i) => ({ item, i })) // keep input index for a stable tiebreak
		.sort((a, b) => {
			const ra = rank.has(a.item.slug) ? rank.get(a.item.slug) : end;
			const rb = rank.has(b.item.slug) ? rank.get(b.item.slug) : end;
			return ra - rb || a.i - b.i;
		})
		.map(({ item }) => item);
}
