// Replicates the CSS filter chain previously applied to the fluid canvas:
//   invert(p) opacity(1 - 0.5p) hue-rotate(180p deg) saturate(0.333p + (1 - p))
// as a single affine transform on straight-alpha sRGB color.
// CSS shorthand filters operate on non-premultiplied sRGB (Filter Effects 1).

export function scrollProgress(scrollY, viewportHeight) {
	if (scrollY <= viewportHeight) return scrollY / viewportHeight;
	return 1;
}

// Standard feColorMatrix hue-rotate, row-major
function hueRotateMatrix(deg) {
	const rad = (deg * Math.PI) / 180;
	const c = Math.cos(rad);
	const s = Math.sin(rad);
	return [
		[0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
		[0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
		[0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]
	];
}

// Standard feColorMatrix saturate, row-major
function saturateMatrix(s) {
	return [
		[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
		[0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
		[0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]
	];
}

function mul3(a, b) {
	const out = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	for (let i = 0; i < 3; i++)
		for (let j = 0; j < 3; j++)
			out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
	return out;
}

export function gradingFromProgress(p) {
	const hue = hueRotateMatrix(180 * p);
	const sat = saturateMatrix(0.333 * p + (1 - p));
	const sh = mul3(sat, hue);

	// color' = SH · (c·(1-2p) + p·[1,1,1]) = (SH·(1-2p))·c + SH·[p,p,p]
	const k = 1 - 2 * p;
	// Column-major, each column padded to vec4 alignment for WGSL mat3x3f
	const mat = new Float32Array(12);
	for (let col = 0; col < 3; col++)
		for (let row = 0; row < 3; row++) mat[col * 4 + row] = sh[row][col] * k;

	const offset = new Float32Array(3);
	for (let row = 0; row < 3; row++) offset[row] = (sh[row][0] + sh[row][1] + sh[row][2]) * p;

	return { mat, offset, alpha: 1 - 0.5 * p };
}
