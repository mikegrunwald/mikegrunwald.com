// Pure scroll-model math for the carousel ring. Deliberately free of GSAP and
// Lenis imports so it can be unit-tested in the `node` vitest environment.

const TAU = Math.PI * 2;

function finiteOr(value, fallback) {
	return Number.isFinite(value) ? value : fallback;
}

// Total ring rotation in radians, combining the two independent scroll inputs.
//
// `preRoll` (0..1) comes from a scrubbed trigger over the section's APPROACH —
// the stretch between the section entering the viewport and the pin engaging.
// Its job is to have the ring already onscreen and visibly turning before the
// pin takes over, so the first teaser sweeps in from the edge instead of
// popping into the centre.
//
// `progress` (0..1) is the pinned trigger's own progress.
//
// The two are ADDED, not blended: at the handover moment preRoll is exactly 1
// and progress is exactly 0, so rotation is continuous across it.
export function composeRotation({ preRoll, progress, rotationsPerScroll, preRollTurns }) {
	const pre = finiteOr(preRoll, 0);
	const prog = finiteOr(progress, 0);
	const turns = finiteOr(preRollTurns, 0);
	const perScroll = finiteOr(rotationsPerScroll, 1);
	return pre * turns * TAU + prog * perScroll * TAU;
}

// Whether the pinned runway should wrap back to its start.
//
// The section is an asymmetric scroll trap: scrolling DOWN loops forever, so
// the ring rotates without bound and the carousel is the end of the page.
// Scrolling UP is deliberately NOT looped — it unwinds the single rotation the
// runway represents and then releases into the preceding section. That
// asymmetry is the whole feature; do not "fix" it by making this symmetric.
//
// The wrap is invisible because a runway of exactly one rotation puts progress
// 0 and progress 1 at the same ring orientation (0 and 2*pi).
export function shouldLoopRunway({ progress, direction }) {
	if (!Number.isFinite(progress)) return false;
	return progress >= 1 && direction === 1;
}
