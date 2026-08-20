import { coverRect } from '../carousel/coverFit.js';

// Pointer (CSS px, top-left origin) → normalized device coords (−1..1, y up).
export function pointerToNdc(x, y, width, height) {
	return {
		ndcX: (x / width) * 2 - 1,
		// `+ 0` normalizes -0 → 0 (the y-flip yields -0 at vertical center).
		ndcY: -((y / height) * 2 - 1) + 0
	};
}

// Frame-rate-independent exponential approach, same shape as CarouselScene's
// hover ease: fraction moved per frame = 1 - exp(-rate*dt).
export function followStep(current, target, rate, dt) {
	if (dt <= 0) return current;
	const k = 1 - Math.exp(-rate * dt);
	return current + (target - current) * k;
}

// Cover-fit the source image into the plane by scaling UVs — reuses coverRect.
// Returns per-axis UV scale (>=1) applied around the center in the shader.
export function revealPlaneScale({ imgW, imgH, planeW, planeH }) {
	const { sw, sh } = coverRect({ srcW: imgW, srcH: imgH, dstW: planeW, dstH: planeH });
	return { sx: imgW / sw, sy: imgH / sh };
}
