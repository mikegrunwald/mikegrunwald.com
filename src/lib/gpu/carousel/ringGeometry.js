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
// Radius that satisfies the ring-tiling constraint alone.
function ringFitRadius(width, n, gap) {
	// Half the angular slot this plane may occupy, after the gap is removed.
	const halfSlot = Math.min(Math.PI / n, MAX_HALF_ANGLE) * (1 - gap);
	const t = Math.tan(halfSlot);
	// tan goes to infinity approaching 90deg and negative past it; either way a
	// non-positive or non-finite tangent means "no sensible radius", so fall back
	// to the floor rather than emitting a garbage transform.
	if (!Number.isFinite(t) || t <= 0) return MIN_RADIUS;
	return width / 2 / t;
}

// Smallest radius at which the plane still fits INSIDE the visible frustum, on
// both axes, filling at most `fit` of it.
//
// Tiling the ring is not enough on its own. Tiling only constrains a plane
// against its neighbours, and on a narrow portrait viewport the tiling solution
// puts the plane far closer than the frustum can show: at 430x930 with four
// teasers it lands at radius 1.52, where the plane spans 81deg against a
// 24.3deg visible arc and 51.2deg against a 50deg vertical fov — cropped on
// every side. Fitting is a second, independent constraint.
function frustumFitRadius(width, height, fovDeg, aspect, fit) {
	const fovV = (fovDeg * Math.PI) / 180;
	// Horizontal fov follows from the vertical one and the viewport aspect —
	// this is the term that collapses on a portrait screen and the whole reason
	// the ring needs to know about the viewport at all.
	const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
	const tH = Math.tan((fovH * fit) / 2);
	const tV = Math.tan((fovV * fit) / 2);
	if (!Number.isFinite(tH) || !Number.isFinite(tV) || tH <= 0 || tV <= 0) return MIN_RADIUS;
	// Whichever axis runs out of room first decides.
	return Math.max(width / 2 / tH, height / 2 / tV);
}

// `gap` is the fraction of each angular slot left EMPTY between planes (see
// above). `fovDeg`/`aspect` describe the camera's visible frustum, and `fit` is
// how much of it a single plane may fill. Omitting the frustum arguments falls
// back to ring-tiling alone.
export function computeRingRadius({ planeWidth, planeHeight, count, gap, fovDeg, aspect, fit }) {
	const width = finiteOr(planeWidth, 1);
	const height = finiteOr(planeHeight, width);
	const n = Math.max(1, Math.floor(finiteOr(count, 1)));
	// Clamped below 1 because a full-slot gap leaves the plane no angular width
	// at all, which solves to an infinite radius.
	const g = Math.min(0.9, Math.max(0, finiteOr(gap, 0)));

	const ring = ringFitRadius(width, n, g);

	// No usable viewport information — keep the ring-only answer rather than
	// inventing a frustum.
	const fov = finiteOr(fovDeg, 0);
	const a = finiteOr(aspect, 0);
	if (fov <= 0 || a <= 0) return Math.max(MIN_RADIUS, ring);

	const f = Math.min(1, Math.max(0.05, finiteOr(fit, 0.9)));
	const frustum = frustumFitRadius(width, height, fov, a, f);

	// The binding constraint wins. On a wide desktop viewport that is the ring
	// term, so this changes nothing there; on a portrait phone it is the frustum
	// term, which pushes the ring out until a single teaser fits the screen.
	return Math.max(MIN_RADIUS, ring, frustum);
}
