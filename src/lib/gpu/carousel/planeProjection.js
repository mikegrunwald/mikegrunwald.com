// Local-space corners of the VIDEO inside a carousel plane's padded quad.
//
// PlaneGeometry's vertices span -1..1, and the carousel's quad is deliberately
// larger than the video it shows so the fragment shader has room to draw an
// outer glow (see quadGeometry.js). So -1..1 is the outer edge of the PADDING,
// not of the video — projecting those corners to find where the video sits on
// screen overstates it by the glow padding on every side, about 8% at the
// default 0.15 pad.
//
// Returned in the order (-x,-y), (+x,-y), (-x,+y), (+x,+y).

function finiteOr(value, fallback) {
	return Number.isFinite(value) ? value : fallback;
}

export function videoCorners({ videoHalfX, videoHalfY, quadHalfX, quadHalfY }) {
	const qx = finiteOr(quadHalfX, 0);
	const qy = finiteOr(quadHalfY, 0);
	// Without a usable quad extent there is no meaningful ratio; fall back to
	// the full quad rather than emitting NaN corners that would become a NaN
	// CSS rect downstream.
	const rx = qx > 0 ? Math.min(1, Math.abs(finiteOr(videoHalfX, qx)) / qx) : 1;
	const ry = qy > 0 ? Math.min(1, Math.abs(finiteOr(videoHalfY, qy)) / qy) : 1;
	return [
		[-rx, -ry],
		[rx, -ry],
		[-rx, ry],
		[rx, ry]
	];
}
