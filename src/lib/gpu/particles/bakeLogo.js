// Reproduces the hero logo's CSS layering as pixels (HeroHeader.svelte:48-66):
//   box aspect-ratio: 1.153594844873037 / 1
//   background: logo.svg, size 80%, centered
//   mask: pop-smoke.webp, size 100%, centered
const BOX_ASPECT = 1.153594844873037;

function loadImage(url) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`bakeLogoImage: failed to load ${url}`));
		img.src = url;
	});
}

// Draw an image centered inside (w,h) scaled to `fraction` of the box,
// preserving the image's own aspect ratio (CSS background-size: NN% contain-like
// behavior for a percentage smaller than the box).
function drawCentered(ctx, img, w, h, fraction) {
	const scale = Math.min((w * fraction) / img.width, (h * fraction) / img.height);
	const dw = img.width * scale;
	const dh = img.height * scale;
	ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export async function bakeLogoImage({
	logoUrl = '/images/logo.svg',
	maskUrl = '/images/pop-smoke.webp',
	size = 1024
} = {}) {
	if (typeof document === 'undefined') {
		throw new Error('bakeLogoImage is browser-only');
	}
	const [logo, mask] = await Promise.all([loadImage(logoUrl), loadImage(maskUrl)]);

	const w = size;
	const h = Math.round(size / BOX_ASPECT);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	// Mask first, then keep logo only where mask has alpha (source-in).
	drawCentered(ctx, mask, w, h, 1.0);
	ctx.globalCompositeOperation = 'source-in';
	drawCentered(ctx, logo, w, h, 0.8);

	return ctx.getImageData(0, 0, w, h);
}
