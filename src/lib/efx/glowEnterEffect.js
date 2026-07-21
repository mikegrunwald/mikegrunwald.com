import { gsap } from 'gsap/dist/gsap';
import { prefersReducedMotion } from './reducedMotion.js';
import { ENTER_START } from './enterTrigger.js';

// ScrollTrigger is deliberately NOT imported or registered here — `+layout.svelte`
// registers it app-wide from the `gsap/ScrollTrigger` specifier, which is a
// different module instance from `gsap/dist/ScrollTrigger`. See the note in
// scrambleEnterEffect.js. Passing `scrollTrigger` in tween vars is all that is
// needed, which is what blurScrollEffect and linesScrollEffect already do.

// Blooms the glow on a group of award logos into place, one after another, on
// scroll-in. Unlike StaggerEnterEffect, position and opacity are left alone —
// awards are visible and unmoved throughout; only `--award-glow` animates.
// Animating a custom property, rather than reaching into AwardLink for its
// `.logo` element, keeps AwardLink owning its own styling: this effect sets
// the property on the `dd` elements it is handed, and it inherits down to
// whatever reads it.
export class GlowEnterEffect {
	constructor(elements) {
		this.elements = Array.from(elements ?? []);
		this.tween = null;

		if (this.elements.length === 0) return;

		if (prefersReducedMotion()) {
			// Leave `--award-glow` unset rather than gsap.set-ing it to 14px: the
			// CSS fallback in AwardLink's `.logo` filter (`var(--award-glow, 14px)`)
			// already renders the same end state, and this is exactly the case
			// that fallback exists for — no animation, nothing to undo.
			return;
		}

		this.tween = gsap.fromTo(
			this.elements,
			{ '--award-glow': '0px' },
			{
				'--award-glow': '14px',
				duration: 0.6,
				ease: 'power2.out',
				stagger: 0.06,
				scrollTrigger: {
					// Triggered off the first element rather than each individually:
					// these sit on one row, so per-element triggers would fire at
					// effectively the same moment and fight the stagger.
					trigger: this.elements[0],
					start: ENTER_START,
					once: true
				}
			}
		);
	}

	destroy() {
		this.tween?.scrollTrigger?.kill();
		this.tween?.kill();
		this.tween = null;
	}
}
