// Source crop rect reproducing CSS `object-fit: cover` for a manual drawImage.
//
// The transition overlay paints the carousel's live video into a canvas rather
// than mounting a second <video>: a fresh element needs ~460ms just to reach
// metadata, which is longer than the whole zoom, so it renders transparent for
// the entire animation. The carousel's element is already decoded and playing.
//
// drawImage has no object-fit, so the crop has to be computed: take the largest
// centred region of the source with the destination's aspect ratio.

function finiteOr(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function coverRect({ srcW, srcH, dstW, dstH }) {
	const sw0 = finiteOr(srcW, 1);
	const sh0 = finiteOr(srcH, 1);
	const dw = finiteOr(dstW, 1);
	const dh = finiteOr(dstH, 1);

	const srcAspect = sw0 / sh0;
	const dstAspect = dw / dh;

	if (srcAspect > dstAspect) {
		// Source is wider than the destination — crop the sides.
		const sw = sh0 * dstAspect;
		return { sx: (sw0 - sw) / 2, sy: 0, sw, sh: sh0 };
	}
	// Source is taller (or equal) — crop top and bottom.
	const sh = sw0 / dstAspect;
	return { sx: 0, sy: (sh0 - sh) / 2, sw: sw0, sh };
}
