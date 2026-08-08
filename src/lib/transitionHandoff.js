// One in-flight carousel -> detail-page handoff.
//
// Module-level rather than a store or a URL param: it is read exactly once, by
// the page being navigated to, immediately after the navigation. Putting it in
// the URL would make it survive sharing and reloads, which is precisely wrong —
// a timestamp is only meaningful for the transition that produced it.

let record = null;

export function setHandoff({ slug, currentTime, srcUrl }) {
	// A NaN currentTime would reach video.currentTime and throw, or silently
	// reset the video to 0. Refuse the whole record instead — no seed is a
	// better outcome than a broken one.
	if (!Number.isFinite(currentTime)) return;
	if (!slug || !srcUrl) return;
	record = { slug, currentTime, srcUrl, at: Date.now() };
}

export function readHandoff() {
	return record;
}

export function clearHandoff() {
	record = null;
}

// Whether a handoff record may seed the video now being mounted.
//
// All three checks earn their place:
// - slug: a record from one project must not seed another's page.
// - srcUrl: the carousel and the header must be the same clip. Either the exact
//   same file, OR a `/teasers/` re-encode of it — the ring now plays a smaller,
//   ≤16s teaser (encode-teasers.js) while the header plays full-res media[0].
//   A teaser is the same clip from t=0, so the carousel currentTime maps to the
//   same frame in the header; slug already proved they're the same project.
//   A foreign NON-teaser url is still refused — seeking to it would be nonsense.
// - age: a record left behind by an abandoned navigation must not seed a
//   direct visit minutes later.
export function shouldSeed({ record, slug, srcUrl, now, maxAgeMs = 5000 }) {
	if (!record) return false;
	if (!Number.isFinite(now) || !Number.isFinite(record.at)) return false;
	if (record.slug !== slug) return false;
	const fromTeaser = /\/teasers?\//.test(record.srcUrl);
	if (record.srcUrl !== srcUrl && !fromTeaser) return false;
	return now - record.at <= maxAgeMs;
}
