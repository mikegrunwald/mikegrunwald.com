// Ring radius derived from how many teasers are on the ring.
//
// The camera sits AT the ring's centre, so a plane's on-screen size is purely
// angular: a plane of width W at radius r subtends 2*atan(W / 2r), regardless
// of anything else. Each plane also owns an angular slot of 2*pi / count.
//
// Those two facts collide as soon as the number of featured entries changes.
// At a hardcoded radius, adding entries shrinks the slot while the plane's
// angular width stays put, so past a certain count the planes overlap; removing
// entries opens a dark gap. Both were real: 5 entries at radius 4 left a 23.6deg
// gap, and 8 entries at the same radius overlap by 3.4deg.
//
// Solving 2*atan(W / 2r) = slot for r gives a radius that always fits the ring
// exactly, whatever the count.

// Half of the widest angular slot a single plane is allowed to fill. Only binds
// for count 1 and 2, where the true half-slot (180deg / 90deg) would drive the
// radius to zero or negative. Above that, pi/count is already under this.
const MAX_HALF_ANGLE = Math.PI / 3; // 60deg

// Radius floor. The camera's near plane is 0.1 (GPUCameraRenderer default), so
// a plane must never end up closer than this or it clips through the viewer.
const MIN_RADIUS = 0.5;

function finiteOr(value, fallback) {
	return Number.isFinite(value) ? value : fallback;
}

// `fill` is how much of its angular slot each plane occupies:
//   1   — planes exactly meet edge to edge, no gap and no overlap
//   <1  — leaves a gap between planes
//   >1  — planes deliberately overlap
export function computeRingRadius({ planeWidth, count, fill }) {
	const width = finiteOr(planeWidth, 1);
	const n = Math.max(1, Math.floor(finiteOr(count, 1)));
	const f = Math.max(0.01, finiteOr(fill, 1));

	// Half the angular slot this plane may occupy.
	const halfSlot = Math.min(Math.PI / n, MAX_HALF_ANGLE) * f;
	const t = Math.tan(halfSlot);
	// tan goes to infinity approaching 90deg and negative past it; either way a
	// non-positive or non-finite tangent means "no sensible radius", so fall back
	// to the floor rather than emitting a garbage transform.
	if (!Number.isFinite(t) || t <= 0) return MIN_RADIUS;

	return Math.max(MIN_RADIUS, width / 2 / t);
}
