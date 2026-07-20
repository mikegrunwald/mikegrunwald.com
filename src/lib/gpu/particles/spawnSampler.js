// Turns a baked logo ImageData into particle spawn data.
// Positions are in 0..1 top-left uv (ImageData row order) — the project-wide
// particle-space convention (see plan Global Constraints).
export function sampleSpawnPoints(imageData, { count, alphaThreshold = 32, rng = Math.random }) {
	const { width, height, data } = imageData;

	// Collect candidate pixel indices above the alpha threshold.
	const candidates = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const a = data[(y * width + x) * 4 + 3];
			if (a > alphaThreshold) candidates.push(y * width + x);
		}
	}
	if (candidates.length === 0) {
		throw new Error('sampleSpawnPoints: no pixels above alphaThreshold');
	}

	const positions = new Float32Array(count * 2);
	const brightness = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		const pick = candidates[Math.floor(rng() * candidates.length)];
		const px = pick % width;
		const py = Math.floor(pick / width);
		// Jitter uniformly inside the pixel cell so particles don't grid-align.
		positions[i * 2] = (px + rng()) / width;
		positions[i * 2 + 1] = (py + rng()) / height;
		const o = pick * 4;
		// Rec. 709 luma, normalized by alpha-weighted white.
		brightness[i] =
			((0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255) *
			(data[o + 3] / 255);
	}
	return { positions, brightness };
}
