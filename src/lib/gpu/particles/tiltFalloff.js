// Pointer-proximity falloff for the hero tilt. Split out of
// LogoParticlesScene.js (which imports gpu-curtains and so can't be unit
// tested in node) for the same reason particleRenderer.js exports the pure
// logoLocalToNdc: this is arithmetic worth pinning with tests.

// How far outside the logo box (in logo-local units, where 1 == the box's own
// width/height) the pointer still tilts the scene.
export const TILT_MARGIN = 0.2;

// Per-axis 1 -> 0 ramp across TILT_MARGIN outside [0, 1].
//
// This exists to remove a discontinuity: tilt used to be gated on a boolean
// "is the pointer within the margin" while the tilt magnitude itself was
// clamped to the box, so the whole margin band sat at FULL tilt and then
// stepped straight to zero when the pointer crossed the invisible margin
// line. Easing (0.067) then smeared that full-magnitude step over ~half a
// second, so sweeping the pointer past the logo made the entire particle
// field lurch. A linear ramp keeps the target continuous everywhere.
//
// Non-finite input returns 0 (no tilt) rather than propagating NaN into the
// eased accumulators — see the finite clamp in LogoParticlesScene.update().
export function tiltRamp(v) {
	if (!Number.isFinite(v)) return 0;
	if (v < 0) return Math.max(0, 1 + v / TILT_MARGIN);
	if (v > 1) return Math.max(0, 1 - (v - 1) / TILT_MARGIN);
	return 1;
}

// Combined falloff for a pointer at logo-local (x, y). 1 inside the box,
// tapering to 0 at the margin edge on either axis.
export function tiltFalloff(x, y) {
	return tiltRamp(x) * tiltRamp(y);
}
