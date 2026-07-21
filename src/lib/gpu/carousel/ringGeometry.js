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

const TAU = Math.PI * 2;

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
// Hard ceiling on planes. Only reachable on absurdly narrow viewports; exists
// so a degenerate aspect can never ask for thousands of meshes.
const MAX_PLANES = 48;

// Fewest planes for which tiling the ring and fitting the screen are compatible.
//
// Those two constraints fight: tiling wants each plane to fill its 360/N slot,
// while fitting caps a plane at the visible arc. Both hold only when
// 360/N * (1 - gap) <= visible arc, so N is bounded below by the viewport — and
// N is the ONLY free variable. Spacing cannot absorb the difference: a closed
// ring is seamless only if N * step is a multiple of 360, so evenly spaced items
// are locked at exactly 360/N. Plane size cannot absorb it either, which is why
// this formula contains no plane dimensions at all.
//
// At 50deg fov this is ~5 planes on a 16:9 desktop and ~14 on a portrait phone.
export function computeRequiredPlanes({ fovDeg, aspect, gap }) {
	const fov = finiteOr(fovDeg, 0);
	const a = finiteOr(aspect, 0);
	if (fov <= 0 || a <= 0) return 1;
	const g = Math.min(0.9, Math.max(0, finiteOr(gap, 0)));
	const fovV = (fov * Math.PI) / 180;
	const fovH = 2 * Math.atan(Math.tan(fovV / 2) * a);
	if (!Number.isFinite(fovH) || fovH <= 0) return 1;
	const arcDeg = (fovH * 180) / Math.PI;
	return Math.min(MAX_PLANES, Math.max(1, Math.ceil((360 * (1 - g)) / arcDeg)));
}

// How many planes to build, and how many times each teaser repeats around the
// ring to get there.
//
// planeCount is always a whole multiple of teaserCount. That is load-bearing:
// plane j shows teaser `j % teaserCount`, so an exact multiple puts every
// teaser at evenly spaced positions and keeps the ring's repeat period equal to
// one full rotation. A non-multiple would bunch the remainder and make the
// wrap visibly jump.
export function computeRingPlan({ teaserCount, requiredPlanes }) {
	const teasers = Math.max(0, Math.floor(finiteOr(teaserCount, 0)));
	if (teasers === 0) return { repeats: 0, planeCount: 0 };
	const required = Math.max(1, Math.floor(finiteOr(requiredPlanes, 1)));
	// Clamp the REPEATS, not the plane count. Clamping planeCount directly would
	// break the whole-multiple invariant — capping 7 teasers x 143 repeats at 48
	// leaves 48, which is not divisible by 7, so the last partial lap would bunch
	// and the wrap would jump. One repeat is always allowed, so a teaser count
	// above the ceiling degrades to one plane each rather than to nothing.
	const maxRepeats = Math.max(1, Math.floor(MAX_PLANES / teasers));
	const repeats = Math.min(maxRepeats, Math.max(1, Math.ceil(required / teasers)));
	return { repeats, planeCount: teasers * repeats };
}

// Signed angle from the view axis to a plane, in radians, wrapped to
// [-pi, pi]. The camera sits at the ring's centre, so a plane at ring angle
// theta appears at screen angle theta — radius cancels out entirely.
function screenAngle(ringAngle) {
	const wrapped = ((ringAngle % TAU) + TAU + Math.PI) % TAU;
	return wrapped - Math.PI;
}

// Which teasers should have their video playing, given where the ring is.
//
// This is what lets the plane count grow with the viewport without the video
// count following it. Only a couple of planes are ever on screen, so decode
// cost tracks the visible arc rather than the size of the ring — a phone can
// carry 16 planes while decoding fewer videos than the old 4-teaser cap did.
//
// Returns a Set of TEASER indices (not plane indices): a teaser repeated around
// the ring plays if ANY of its planes is near the visible arc, and one video
// element feeds all of its planes.
export function selectPlayingTeasers({
	planeCount,
	teaserCount,
	rotation,
	fovDeg,
	aspect,
	marginDeg = 20
}) {
	const planes = Math.max(0, Math.floor(finiteOr(planeCount, 0)));
	const teasers = Math.max(0, Math.floor(finiteOr(teaserCount, 0)));
	const playing = new Set();
	if (planes === 0 || teasers === 0) return playing;

	const rot = finiteOr(rotation, 0);
	const fov = finiteOr(fovDeg, 0);
	const a = finiteOr(aspect, 0);
	// Without a usable frustum, fall back to playing everything rather than
	// silently muting the whole ring.
	if (fov <= 0 || a <= 0) {
		for (let i = 0; i < teasers; i++) playing.add(i);
		return playing;
	}

	const fovV = (fov * Math.PI) / 180;
	const fovH = 2 * Math.atan(Math.tan(fovV / 2) * a);
	// Margin so a teaser is already playing (and past its first frame) before it
	// rotates into view, rather than popping in mid-decode at the edge.
	const limit = fovH / 2 + (Math.max(0, finiteOr(marginDeg, 0)) * Math.PI) / 180;

	for (let j = 0; j < planes; j++) {
		const angle = screenAngle(rot + (j / planes) * TAU);
		if (Math.abs(angle) <= limit) playing.add(j % teasers);
	}
	return playing;
}

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
