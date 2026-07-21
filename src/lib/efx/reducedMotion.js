// Isolated so the pure config builders can take `reduceMotion` as a plain
// boolean parameter and stay testable in a DOM-free environment.
//
// `src/lib/gpu/engine.js` reads the same query for the WebGPU canvas. Kept
// separate rather than shared: that one gates whether an expensive renderer
// starts at all, this one gates text animation, and collapsing them would
// couple two unrelated decisions to one call site.
export function prefersReducedMotion() {
	// This module is imported by components that server-render.
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
