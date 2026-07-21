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

// `gap` is the fraction of each angular slot left EMPTY between planes:
//   0     — planes meet edge to edge, touching
//   0.1   — a tenth of every slot is empty space
//
// Expressed as a fraction of the slot rather than a fixed angle or a world
// distance, so it stays proportional: the plane occupies (1 - gap) of its slot
// at every count, which fixes the gap-to-plane ratio no matter how many entries
// are featured. A fixed angular gap would look generous at 5 entries and
// cramped at 12; a fixed world distance would additionally drift as planeWidth
// changed.
export function computeRingRadius({ planeWidth, count, gap }) {
	const width = finiteOr(planeWidth, 1);
	const n = Math.max(1, Math.floor(finiteOr(count, 1)));
	// Clamped below 1 because a full-slot gap leaves the plane no angular width
	// at all, which solves to an infinite radius.
	const g = Math.min(0.9, Math.max(0, finiteOr(gap, 0)));

	// Half the angular slot this plane may occupy, after the gap is removed.
	const halfSlot = Math.min(Math.PI / n, MAX_HALF_ANGLE) * (1 - g);
	const t = Math.tan(halfSlot);
	// tan goes to infinity approaching 90deg and negative past it; either way a
	// non-positive or non-finite tangent means "no sensible radius", so fall back
	// to the floor rather than emitting a garbage transform.
	if (!Number.isFinite(t) || t <= 0) return MIN_RADIUS;

	return Math.max(MIN_RADIUS, width / 2 / t);
}
