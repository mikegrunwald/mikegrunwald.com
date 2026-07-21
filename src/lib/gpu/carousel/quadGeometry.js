// Padded-quad geometry for the carousel ring planes.
//
// The mesh quad is deliberately LARGER than the video it displays: the
// fragment shader draws an outer glow that has to bleed past the video's
// edge, and there is nowhere to put those pixels unless the geometry extends
// beyond the video area. `planeWidth`/`planeHeight` keep meaning the VIDEO's
// world size — that is the existing param contract and the debug panel
// sliders depend on it — so the padding is added here rather than folded into
// those params.
//
// The halving is not cosmetic: `PlaneGeometry`'s native vertex range is -1..1
// on both axes (a 2x2 quad, confirmed at
// node_modules/gpu-curtains/dist/esm/core/geometries/PlaneGeometry.mjs:102-103),
// so world size = 2 * mesh.scale. Every scale value below is therefore half
// the world size it produces.

// Any non-finite input yields this instead of propagating NaN into a GPU
// transform. A degenerate-but-finite quad renders as a small square; a NaN one
// has historically taken the whole canvas down.
const SAFE_FALLBACK = 1;

function finiteOr(value, fallback) {
	return Number.isFinite(value) ? value : fallback;
}

export function computeQuadGeometry({ planeWidth, planeHeight, glowPad }) {
	const w = finiteOr(planeWidth, SAFE_FALLBACK);
	const h = finiteOr(planeHeight, SAFE_FALLBACK);
	// Negative padding would invert the quad relative to the video and make the
	// SDF's inside/outside test meaningless, so clamp rather than trust the
	// caller (the debug panel can write any value in its bound range).
	const pad = Math.max(0, finiteOr(glowPad, 0));

	const videoHalfX = w / 2;
	const videoHalfY = h / 2;
	const quadHalfX = videoHalfX + pad;
	const quadHalfY = videoHalfY + pad;

	return {
		// mesh.scale — half the padded world size, per the 2x2 quad note above.
		meshScaleX: quadHalfX,
		meshScaleY: quadHalfY,
		// Shader uniforms, both in world units, both measured from the plane's
		// centre. The shader needs both: quadHalf converts uv into world-space
		// local coordinates, videoHalf is the rounded-box SDF's extent.
		videoHalfX,
		videoHalfY,
		quadHalfX,
		quadHalfY
	};
}
